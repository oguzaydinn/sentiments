import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { fetchComments, initializeReddit } from "./reddit";
import { categories, type Category } from "./types/categories";
import type { RedditData } from "./types/reddit";
import { NERService } from "./ner";

// Initialize Hono app
const app = new Hono();

// Initialize NER service
let nerService: NERService | null = null;

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
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Reddit Sentiment Network API is running",
  });
});

// Simple test endpoint
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

// Helper function to transform Reddit data into network structure
async function buildNetworkData(data: RedditData, entityAnalyses: any[] = []) {
  // Calculate comment count recursively
  const countComments = (comments: any[]): number => {
    return comments.reduce((count, comment) => {
      return count + 1 + countComments(comment.replies || []);
    }, 0);
  };

  // Consolidate entity analyses from all subreddits
  let consolidatedEntityAnalysis = null;
  if (entityAnalyses.length > 0) {
    // Merge all entity chains from different subreddits
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

  // Transform discussions to include required fields
  const transformedDiscussions = data.discussions.map((discussion, index) => {
    const commentCount = countComments(discussion.comments);

    // Calculate weighted sentiment if available
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
      // The subreddit field is now available from the discussion object
      score: 0, // Default score since we don't have post scores yet
      commentCount,
      weightedSentiment,
    };
  });

  // Extract unique subreddits from discussions
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
    entities: consolidatedEntityAnalysis?.entityChains.slice(0, 20) || [], // Top 20 entities overall
    entityAnalysis: consolidatedEntityAnalysis
      ? {
          query: consolidatedEntityAnalysis.query,
          timestamp: consolidatedEntityAnalysis.timestamp,
          totalEntities: consolidatedEntityAnalysis.totalEntities,
          totalMentions: consolidatedEntityAnalysis.totalMentions,
          totalScore: consolidatedEntityAnalysis.totalScore,
          entityBreakdown: consolidatedEntityAnalysis.entityBreakdown,
          entityChains: consolidatedEntityAnalysis.entityChains.slice(0, 10), // Top 10 for detailed analysis
        }
      : undefined,
  };
}

// Main analysis endpoint
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

    console.log(`🔍 Starting analysis for "${query}" in ${category}`);

    try {
      // Initialize Reddit client
      const reddit = await initializeReddit();

      // Initialize NER service if entities are requested and not already initialized
      if (includeEntities && !nerService) {
        console.log("🤖 Initializing NER service for entity analysis...");
        nerService = new NERService();
        await nerService.initialize();
      }

      // Get subreddits for category
      const subreddits = categories[category as Category];
      const allData: RedditData[] = [];

      // Process all subreddits in the category for comprehensive results
      const subredditsToProcess = subreddits;
      const allEntityAnalyses: any[] = [];

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
            5 // Limit posts per subreddit for faster response
          );

          if (data) {
            // Process entities for this individual subreddit if requested
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
          // Continue with other subreddits
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

      // Merge all data into a single structure, preserving subreddit info for each discussion
      const allDiscussions = allData.flatMap((subredditData) =>
        subredditData.discussions.map((discussion) => ({
          ...discussion,
          subreddit: subredditData.subreddit, // Preserve the original subreddit for each discussion
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

      // Transform to network structure
      const networkData = await buildNetworkData(
        consolidatedData,
        allEntityAnalyses
      );

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

// Get available categories
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

// Start server
const port = process.env.PORT || 3001;

console.log(`🚀 Reddit Sentiment Network API starting on port ${port}`);
console.log(`🎯 Available endpoints:`);
console.log(`   GET  /health - Health check`);
console.log(`   GET  /api/test - Test endpoint`);
console.log(`   GET  /api/categories - Get available categories`);
console.log(`   POST /api/analyze - Start Reddit analysis`);
console.log(
  `🔗 CORS enabled for: http://localhost:3000, http://localhost:5173`
);

// Start the server
Bun.serve({
  port: Number(port),
  fetch: app.fetch,
});

console.log(`✅ Server running on http://localhost:${port}`);
