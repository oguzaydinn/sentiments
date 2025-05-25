import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { PrismaClient } from "./generated/prisma";
import { fetchComments, initializeReddit } from "./reddit";
import { categories, type Category } from "./types/categories";
import { NERService } from "./ner";
import { saveRedditData } from "./storage";
import type { RedditData, Discussion, RedditComment } from "./types/reddit";
import type { EntityChain } from "./types/entities";

// Initialize Prisma Client
const prisma = new PrismaClient();

// Initialize Hono app
const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Helper function to transform Reddit data into network structure
function buildNetworkData(data: RedditData) {
  // Group discussions by subreddit
  const subredditGroups = data.discussions.reduce(
    (acc: any, discussion: Discussion) => {
      const subreddit = data.subreddit;
      if (!acc[subreddit]) {
        acc[subreddit] = [];
      }
      acc[subreddit].push(discussion);
      return acc;
    },
    {}
  );

  // Calculate subreddit-level metrics
  const subreddits = Object.keys(subredditGroups);

  // Transform discussions to include required fields
  const transformedDiscussions = data.discussions.map((discussion) => {
    // Calculate comment count recursively
    const countComments = (comments: RedditComment[]): number => {
      return comments.reduce((count, comment) => {
        return count + 1 + countComments(comment.replies || []);
      }, 0);
    };

    // Calculate weighted sentiment (score-weighted average)
    const commentSentiments = discussion.comments
      .filter((c) => c.sentiment)
      .map((c) => ({ sentiment: c.sentiment!.compound, score: c.score }));

    const weightedSentiment =
      commentSentiments.length > 0
        ? commentSentiments.reduce((sum, c) => sum + c.sentiment * c.score, 0) /
          commentSentiments.reduce((sum, c) => sum + c.score, 0)
        : 0;

    return {
      ...discussion,
      subreddit: data.subreddit,
      score: 0, // Post score would come from Reddit API
      commentCount: countComments(discussion.comments),
      weightedSentiment,
    };
  });

  return {
    id: `${data.category}-${data.query}-${Date.now()}`,
    category: data.category,
    query: data.query,
    timeframe: data.metadata.timeframe,
    minPostScore: data.metadata.minScore,
    totalComments: data.metadata.totalComments,
    totalDiscussions: data.metadata.totalDiscussions,
    scrapedAt: data.metadata.scrapedAt,
    createdAt: new Date().toISOString(),
    discussions: transformedDiscussions,
    subreddits,
    networkData: {
      nodes: [], // Will be built on frontend
      links: [], // Will be built on frontend
      centerNode: { id: "query", label: data.query, type: "query" },
    },
    entities: data.entityAnalysis?.entityChains || [],
  };
}

// Background job processing function
async function processAnalysisJob(jobId: string) {
  try {
    const job = await prisma.analysisJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    console.log(
      `🚀 Processing analysis job ${jobId}: "${job.query}" in ${job.category}`
    );

    // Update job status
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "running",
        progress: 10,
        updatedAt: new Date(),
      },
    });

    // Initialize Reddit client
    const reddit = await initializeReddit();

    // Initialize NER service if needed
    let nerService: NERService | null = null;
    if (job.includeNER) {
      console.log("🤖 Initializing NER service...");
      nerService = new NERService();
      await nerService.initialize();
    }

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { progress: 20 },
    });

    // Get subreddits for category
    const subreddits = categories[job.category as Category];
    if (!subreddits) {
      throw new Error(`Invalid category: ${job.category}`);
    }

    const allData: RedditData[] = [];

    // Process each subreddit
    for (let i = 0; i < subreddits.length; i++) {
      const subreddit = subreddits[i];
      const progress = 20 + (i / subreddits.length) * 60; // 20-80%

      await prisma.analysisJob.update({
        where: { id: jobId },
        data: {
          progress: Math.round(progress),
          errorMessage: `Processing r/${subreddit}...`,
        },
      });

      try {
        console.log(`📱 Processing r/${subreddit}...`);

        const data = await fetchComments(
          reddit,
          subreddit,
          job.query,
          job.category,
          job.timeframe as any,
          job.minScore,
          10 // Limit posts per subreddit
        );

        if (data) {
          // Perform entity analysis if enabled
          if (job.includeNER && nerService) {
            console.log(`🔍 Running entity analysis for r/${subreddit}...`);
            try {
              const entityAnalysis = await nerService.analyzeEntities(data);
              data.entityAnalysis = entityAnalysis;
            } catch (entityError) {
              console.error(
                `Entity analysis failed for r/${subreddit}:`,
                entityError
              );
            }
          }

          allData.push(data);
        }
      } catch (error) {
        console.error(`Error processing r/${subreddit}:`, error);
        // Continue with other subreddits
      }
    }

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        progress: 80,
        errorMessage: "Consolidating results...",
      },
    });

    // Consolidate data from all subreddits
    if (allData.length === 0) {
      throw new Error("No data collected from any subreddit");
    }

    // Merge all data into a single structure
    const consolidatedData: RedditData = {
      subreddit: allData.map((d) => d.subreddit).join(", "),
      query: job.query,
      category: job.category,
      metadata: {
        query: job.query,
        timeframe: job.timeframe,
        minScore: job.minScore,
        totalComments: allData.reduce(
          (sum, d) => sum + d.metadata.totalComments,
          0
        ),
        totalDiscussions: allData.reduce(
          (sum, d) => sum + d.metadata.totalDiscussions,
          0
        ),
        scrapedAt: new Date().toISOString(),
      },
      discussions: allData.flatMap((d) => d.discussions),
      entityAnalysis: allData.find((d) => d.entityAnalysis)?.entityAnalysis,
    };

    // Transform to network structure
    const networkData = buildNetworkData(consolidatedData);

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        progress: 90,
        errorMessage: "Saving results...",
      },
    });

    // Save to database
    const savedAnalysis = await prisma.redditAnalysis.create({
      data: {
        category: networkData.category,
        query: networkData.query,
        subreddit: consolidatedData.subreddit,
        timeframe: networkData.timeframe,
        minScore: networkData.minPostScore,
        totalComments: networkData.totalComments,
        totalDiscussions: networkData.totalDiscussions,
        scrapedAt: new Date(networkData.scrapedAt),
        discussions: networkData.discussions as any,
        entityAnalysis: consolidatedData.entityAnalysis as any,
      },
    });

    // Save entity chains if available
    if (networkData.entities && networkData.entities.length > 0) {
      await Promise.all(
        networkData.entities.map((entityChain: EntityChain) =>
          prisma.entityChain.create({
            data: {
              analysisId: savedAnalysis.id,
              entityText: entityChain.entity.text,
              entityType: entityChain.entity.type,
              normalizedText: entityChain.entity.normalizedText,
              totalMentions: entityChain.totalMentions,
              uniquePosts: entityChain.uniquePosts,
              totalScore: entityChain.totalScore,
              averageSentiment: entityChain.averageSentiment as any,
              sentimentTrend: entityChain.sentimentTrend as any,
            },
          })
        )
      );
    }

    // Also save to file system for backup
    await saveRedditData(consolidatedData);

    // Complete the job
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        progress: 100,
        errorMessage: "Analysis completed successfully",
        resultIds: [savedAnalysis.id],
        completedAt: new Date(),
      },
    });

    console.log(`✅ Analysis job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`❌ Analysis job ${jobId} failed:`, error);

    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}

// Main analysis endpoint - handles everything
app.post("/api/analyze", async (c) => {
  try {
    const body = await c.req.json();
    const {
      category,
      query,
      timeframe = "week",
      minPostScore = 50,
      includeEntities = false,
    } = body;

    // Validate required parameters
    if (!category || !query) {
      return c.json(
        {
          success: false,
          error: "Category and query are required",
        },
        400
      );
    }

    // Validate category
    if (!categories[category as Category]) {
      return c.json(
        {
          success: false,
          error: `Invalid category. Choose from: ${Object.keys(categories).join(
            ", "
          )}`,
        },
        400
      );
    }

    // Check if we have recent analysis for this query
    const existingAnalysis = await prisma.redditAnalysis.findFirst({
      where: {
        category,
        query,
        timeframe,
        minScore: minPostScore,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      include: {
        EntityChain: includeEntities
          ? {
              orderBy: { totalScore: "desc" },
              take: 50,
            }
          : false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingAnalysis) {
      console.log(`📋 Returning cached analysis for "${query}" in ${category}`);

      const networkData = {
        id: existingAnalysis.id,
        category: existingAnalysis.category,
        query: existingAnalysis.query,
        timeframe: existingAnalysis.timeframe,
        minPostScore: existingAnalysis.minScore,
        totalComments: existingAnalysis.totalComments,
        totalDiscussions: existingAnalysis.totalDiscussions,
        scrapedAt: existingAnalysis.scrapedAt.toISOString(),
        createdAt: existingAnalysis.createdAt.toISOString(),
        discussions: existingAnalysis.discussions as any,
        subreddits: existingAnalysis.subreddit.split(", "),
        networkData: {
          nodes: [],
          links: [],
          centerNode: {
            id: "query",
            label: existingAnalysis.query,
            type: "query",
          },
        },
        entityAnalysis: existingAnalysis.entityAnalysis,
        entities: existingAnalysis.EntityChain || [],
      };

      return c.json({
        success: true,
        cached: true,
        data: networkData,
      });
    }

    // No recent analysis found - create new analysis job
    console.log(`🔍 Starting new analysis for "${query}" in ${category}`);

    const job = await prisma.analysisJob.create({
      data: {
        category,
        query,
        timeframe,
        minScore: minPostScore,
        includeNER: includeEntities,
        status: "pending",
        progress: 0,
        startedAt: new Date(),
      },
    });

    // Start background processing (don't await)
    processAnalysisJob(job.id).catch((error) => {
      console.error(`Background job ${job.id} failed:`, error);
    });

    return c.json({
      success: true,
      cached: false,
      jobId: job.id,
      status: "pending",
      message: `Analysis started for "${query}" in ${category}. This may take a few minutes.`,
      estimatedTime: "2-5 minutes",
    });
  } catch (error) {
    console.error("Error in analyze endpoint:", error);
    return c.json(
      {
        success: false,
        error: "Failed to process analysis request",
      },
      500
    );
  }
});

// Simple job status check
app.get("/api/job/:id", async (c) => {
  try {
    const jobId = c.req.param("id");

    const job = await prisma.analysisJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return c.json(
        {
          success: false,
          error: "Job not found",
        },
        404
      );
    }

    // If job is completed, return the results
    if (job.status === "completed" && job.resultIds.length > 0) {
      const analysis = await prisma.redditAnalysis.findUnique({
        where: { id: job.resultIds[0] },
        include: {
          EntityChain: job.includeNER
            ? {
                orderBy: { totalScore: "desc" },
                take: 50,
              }
            : false,
        },
      });

      if (analysis) {
        const networkData = {
          id: analysis.id,
          category: analysis.category,
          query: analysis.query,
          timeframe: analysis.timeframe,
          minPostScore: analysis.minScore,
          totalComments: analysis.totalComments,
          totalDiscussions: analysis.totalDiscussions,
          scrapedAt: analysis.scrapedAt.toISOString(),
          createdAt: analysis.createdAt.toISOString(),
          discussions: analysis.discussions as any,
          subreddits: analysis.subreddit.split(", "),
          networkData: {
            nodes: [],
            links: [],
            centerNode: { id: "query", label: analysis.query, type: "query" },
          },
          entityAnalysis: analysis.entityAnalysis,
          entities: analysis.EntityChain || [],
        };

        return c.json({
          success: true,
          status: "completed",
          data: networkData,
        });
      }
    }

    return c.json({
      success: true,
      status: job.status,
      progress: job.progress,
      message: job.errorMessage || "Analysis in progress...",
    });
  } catch (error) {
    console.error("Error checking job status:", error);
    return c.json(
      {
        success: false,
        error: "Failed to check job status",
      },
      500
    );
  }
});

// Optional: Get recent analyses for dashboard
app.get("/api/recent", async (c) => {
  try {
    const { limit = "10" } = c.req.query();

    const analyses = await prisma.redditAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string),
      select: {
        id: true,
        category: true,
        query: true,
        subreddit: true,
        totalComments: true,
        totalDiscussions: true,
        createdAt: true,
        scrapedAt: true,
      },
    });

    return c.json({
      success: true,
      data: analyses.map((analysis: any) => ({
        success: true,
        cached: true,
        data: {
          id: analysis.id,
          category: analysis.category,
          query: analysis.query,
          subreddits: analysis.subreddit.split(", "),
          totalComments: analysis.totalComments,
          totalDiscussions: analysis.totalDiscussions,
          createdAt: analysis.createdAt.toISOString(),
          scrapedAt: analysis.scrapedAt.toISOString(),
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching recent analyses:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch recent analyses",
      },
      500
    );
  }
});

// Start server
const port = process.env.PORT || 3001;

console.log(`🚀 Reddit Sentiment Network API starting on port ${port}`);
console.log(`📊 MongoDB connected via Prisma`);
console.log(`🎯 Network Analysis Endpoints:`);
console.log(`   POST /api/analyze - Start network analysis`);
console.log(`   GET  /api/job/:id - Check analysis job status`);
console.log(`   GET  /api/recent - Get recent analyses`);
console.log(`   GET  /health - Health check`);
console.log(
  `🔗 Frontend CORS enabled for: http://localhost:3000, http://localhost:5173`
);

// Start the server
Bun.serve({
  port: Number(port),
  fetch: app.fetch,
});

console.log(`✅ Server running on http://localhost:${port}`);

export default app;
