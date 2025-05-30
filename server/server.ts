import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { fetchComments, initializeReddit } from "./reddit";
import { categories, type Category } from "./types/categories";
import type { RedditData } from "./types/reddit";
import { NERService } from "./ner";
import {
  getCachedAnalysis,
  saveConsolidatedAnalysis,
  getRecentQueries,
  getAnalysisById,
  cleanupOldAnalyses,
} from "./storage";

const app = new Hono();

let nerService: NERService | null = null;

app.use("*", logger());

// Configure CORS based on environment
app.use(
  "*",
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "*"
        : [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:3001",
          ],
    credentials: true,
  })
);

app.get("/health", (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Reddit Sentiment Network API is running",
  });
});

app.get("/api/test", (c) => {
  return c.json({
    success: true,
    message: "API is working!",
    endpoints: [
      "GET /health - Health check",
      "GET /api/test - Test endpoint",
      "POST /api/analyze - Start Reddit analysis",
    ],
  });
});

// Transform Reddit data into network structure with entity analysis consolidation
async function buildNetworkData(data: RedditData, entityAnalyses: any[] = []) {
  const countComments = (comments: any[]): number => {
    return comments.reduce((count, comment) => {
      return count + 1 + countComments(comment.replies || []);
    }, 0);
  };

  // Consolidate entity analyses from all subreddits
  let consolidatedEntityAnalysis = null;
  if (entityAnalyses.length > 0) {
    const allEntityChains = entityAnalyses.flatMap(
      (analysis) => analysis.entityChains
    );

    // Group entities by normalized text and type, combining scores and mentions
    const entityMap = new Map();
    for (const chain of allEntityChains) {
      const key = `${chain.entity.type}:${chain.entity.normalizedText}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, {
          entity: chain.entity,
          totalMentions: 0,
          totalScore: 0,
          sentimentTrend: [],
          averageSentiment: chain.averageSentiment,
        });
      }
      const existing = entityMap.get(key);
      existing.totalMentions += chain.totalMentions;
      existing.totalScore += chain.totalScore;
      existing.sentimentTrend.push(...chain.sentimentTrend);
    }

    const consolidatedChains = Array.from(entityMap.values()).sort(
      (a, b) => b.totalScore - a.totalScore
    );

    consolidatedEntityAnalysis = {
      query: data.query,
      timestamp: new Date().toISOString(),
      totalEntities: consolidatedChains.length,
      totalMentions: entityAnalyses.reduce(
        (sum, analysis) => sum + analysis.totalMentions,
        0
      ),
      totalScore: entityAnalyses.reduce(
        (sum, analysis) => sum + analysis.totalScore,
        0
      ),
      entityBreakdown: {
        persons: consolidatedChains.filter((c) => c.entity.type === "PERSON")
          .length,
        organizations: consolidatedChains.filter(
          (c) => c.entity.type === "ORGANIZATION"
        ).length,
        locations: consolidatedChains.filter(
          (c) => c.entity.type === "LOCATION"
        ).length,
      },
      entityChains: consolidatedChains,
    };
  }

  const transformedDiscussions = data.discussions.map((discussion, index) => {
    const commentCount = countComments(discussion.comments);

    // Calculate weighted sentiment using comment scores
    const commentSentiments = discussion.comments
      .filter((c) => c.sentiment)
      .map((c) => ({
        sentiment: c.sentiment!.original.compound,
        score: c.score,
      }));

    const weightedSentiment =
      commentSentiments.length > 0
        ? commentSentiments.reduce((sum, c) => sum + c.sentiment * c.score, 0) /
          commentSentiments.reduce((sum, c) => sum + c.score, 0)
        : 0;

    return {
      ...discussion,
      commentCount,
      weightedSentiment,
    };
  });

  const uniqueSubreddits = [
    ...new Set(transformedDiscussions.map((d) => (d as any).subreddit)),
  ];

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
    subreddits: uniqueSubreddits,
    networkData: {
      nodes: [],
      links: [],
      centerNode: { id: "query", label: data.query, type: "query" },
    },
    entities: consolidatedEntityAnalysis?.entityChains.slice(0, 20) || [],
    entityAnalysis: consolidatedEntityAnalysis
      ? {
          query: consolidatedEntityAnalysis.query,
          timestamp: consolidatedEntityAnalysis.timestamp,
          totalEntities: consolidatedEntityAnalysis.totalEntities,
          totalMentions: consolidatedEntityAnalysis.totalMentions,
          totalScore: consolidatedEntityAnalysis.totalScore,
          entityBreakdown: consolidatedEntityAnalysis.entityBreakdown,
          entityChains: consolidatedEntityAnalysis.entityChains.slice(0, 10),
        }
      : undefined,
  };
}

// Main analysis endpoint with caching and entity support
app.post("/api/analyze", async (c) => {
  try {
    const body = await c.req.json();
    const { query, category, timeframe, minPostScore, includeEntities } = body;

    if (!query || !category) {
      return c.json(
        { success: false, error: "Query and category are required" },
        400
      );
    }

    console.log(`🔍 Starting analysis for "${query}" in ${category}`);

    // Check cache first (within last 24 hours)
    const cachedResult = await getCachedAnalysis(
      query,
      category,
      timeframe || "week",
      minPostScore || 50
    );

    if (cachedResult) {
      console.log(`🎯 Returning cached result for "${query}"`);

      const networkData = await buildNetworkData(
        {
          subreddit: cachedResult.discussions
            .map((d: any) => d.subreddit)
            .join(", "),
          query: cachedResult.query,
          category: cachedResult.category,
          metadata: {
            query: cachedResult.query,
            timeframe: cachedResult.timeframe,
            minScore: cachedResult.minScore,
            totalComments: cachedResult.totalComments,
            totalDiscussions: cachedResult.totalDiscussions,
            scrapedAt: cachedResult.createdAt.toISOString(),
          },
          discussions: cachedResult.discussions,
          sentiment: cachedResult.sentimentAnalysis,
        },
        cachedResult.entityAnalysis ? [cachedResult.entityAnalysis] : []
      );

      return c.json({
        success: true,
        cached: true,
        data: networkData,
        message: `Cached analysis for "${query}" in ${category}`,
      });
    }

    console.log(`🔄 No cache found, fetching fresh data for "${query}"`);

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

    try {
      const reddit = await initializeReddit();

      // Initialize NER service if entities are requested
      if (includeEntities && !nerService) {
        console.log("🤖 Initializing NER service for entity analysis...");
        nerService = new NERService();
        await nerService.initialize();
      }

      const subreddits = categories[category as Category];
      const allData: RedditData[] = [];
      const subredditsToProcess = subreddits;
      const allEntityAnalyses: any[] = [];

      // Process all subreddits in the category
      for (const subreddit of subredditsToProcess) {
        try {
          console.log(`📱 Processing r/${subreddit}...`);

          const data = await fetchComments(
            reddit,
            subreddit,
            query,
            category,
            timeframe as any,
            minPostScore,
            5
          );

          if (data) {
            if (includeEntities && nerService) {
              try {
                console.log(
                  `🔍 Starting entity analysis for r/${subreddit}...`
                );
                const entityAnalysis = await nerService.analyzeEntities(data);
                allEntityAnalyses.push(entityAnalysis);
                console.log(
                  `✅ Found ${entityAnalysis.totalEntities} unique entities in r/${subreddit}`
                );
              } catch (entityError) {
                console.error(
                  `❌ Error during entity analysis for r/${subreddit}:`,
                  entityError
                );
              }
            }

            allData.push(data);
          }
        } catch (error) {
          console.error(`Error processing r/${subreddit}:`, error);
        }
      }

      if (allData.length === 0) {
        return c.json(
          {
            success: false,
            error: "No data found for the given query and category",
          },
          404
        );
      }

      // Merge all data preserving subreddit info for each discussion
      const allDiscussions = allData.flatMap((subredditData) =>
        subredditData.discussions.map((discussion) => ({
          ...discussion,
          subreddit: subredditData.subreddit,
        }))
      );

      const consolidatedData: RedditData = {
        subreddit: allData.map((d) => d.subreddit).join(", "),
        query,
        category,
        metadata: {
          query,
          timeframe,
          minScore: minPostScore,
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
        discussions: allDiscussions,
      };

      const networkData = await buildNetworkData(
        consolidatedData,
        allEntityAnalyses
      );

      // Save to database for caching
      try {
        const analysisId = await saveConsolidatedAnalysis(
          consolidatedData,
          allEntityAnalyses
        );
        console.log(`💾 Analysis saved to database with ID: ${analysisId}`);
      } catch (saveError) {
        console.warn(`⚠️ Failed to save to database (continuing):`, saveError);
      }

      console.log(
        `✅ Analysis completed: ${networkData.totalComments} comments, ${networkData.totalDiscussions} discussions`
      );

      return c.json({
        success: true,
        cached: false,
        data: networkData,
        message: `Analysis completed for "${query}" in ${category}`,
      });
    } catch (error) {
      console.error("Reddit API error:", error);
      return c.json(
        {
          success: false,
          error:
            "Failed to fetch data from Reddit. Please check your API credentials and try again.",
        },
        500
      );
    }
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

app.get("/api/categories", (c) => {
  return c.json({
    success: true,
    data: Object.keys(categories).map((key) => ({
      value: key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      subreddits: categories[key as Category],
    })),
  });
});

app.get("/api/recent", async (c) => {
  try {
    const limit = Number(c.req.query("limit")) || 10;
    const recentQueries = await getRecentQueries(limit);

    return c.json({
      success: true,
      data: recentQueries,
    });
  } catch (error) {
    console.error("Error fetching recent queries:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch recent queries",
      },
      500
    );
  }
});

app.get("/api/analysis/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const analysis = await getAnalysisById(id);

    if (!analysis) {
      return c.json(
        {
          success: false,
          error: "Analysis not found",
        },
        404
      );
    }

    const networkData = await buildNetworkData(
      {
        subreddit: analysis.discussions.map((d: any) => d.subreddit).join(", "),
        query: analysis.query,
        category: analysis.category,
        metadata: {
          query: analysis.query,
          timeframe: analysis.timeframe,
          minScore: analysis.minScore,
          totalComments: analysis.totalComments,
          totalDiscussions: analysis.totalDiscussions,
          scrapedAt: analysis.createdAt.toISOString(),
        },
        discussions: analysis.discussions,
        sentiment: analysis.sentimentAnalysis,
      },
      analysis.entityAnalysis ? [analysis.entityAnalysis] : []
    );

    return c.json({
      success: true,
      cached: true,
      data: networkData,
      message: `Analysis "${analysis.query}" in ${analysis.category}`,
    });
  } catch (error) {
    console.error("Error fetching analysis by ID:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch analysis",
      },
      500
    );
  }
});

app.post("/api/cleanup", async (c) => {
  try {
    const deletedCount = await cleanupOldAnalyses();
    return c.json({
      success: true,
      message: `Cleaned up ${deletedCount} old analyses`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return c.json(
      {
        success: false,
        error: "Failed to cleanup old analyses",
      },
      500
    );
  }
});

// Serve static files from the public directory - must come AFTER all API routes
app.use("/*", serveStatic({ root: "./public" }));

// Serve index.html for all non-API routes (SPA routing)
app.notFound(async (c) => {
  const file = Bun.file("./public/index.html");
  const content = await file.text();
  return c.html(content);
});

const port = process.env.PORT || 3001;

console.log(`🚀 Reddit Sentiment Network API starting on port ${port}`);
console.log(`🎯 Available endpoints:`);
console.log(`   GET  /health - Health check`);
console.log(`   GET  /api/test - Test endpoint`);
console.log(`   GET  /api/categories - Get available categories`);
console.log(`   GET  /api/recent - Get recent queries`);
console.log(`   GET  /api/analysis/:id - Get analysis by ID`);
console.log(`   POST /api/analyze - Start Reddit analysis`);
console.log(`   POST /api/cleanup - Cleanup old analyses`);
console.log(
  process.env.NODE_ENV === "production"
    ? `🔗 CORS enabled for: all origins (production mode)`
    : `🔗 CORS enabled for: http://localhost:3000, http://localhost:5173`
);

Bun.serve({
  port: Number(port),
  fetch: app.fetch,
});

console.log(`✅ Server running on http://localhost:${port}`);
