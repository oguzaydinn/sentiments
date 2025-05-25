import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { fetchComments, initializeReddit } from "./reddit";
import { categories, type Category } from "./types/categories";
import type { RedditData } from "./types/reddit";

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
function buildNetworkData(data: RedditData) {
  // Calculate comment count recursively
  const countComments = (comments: any[]): number => {
    return comments.reduce((count, comment) => {
      return count + 1 + countComments(comment.replies || []);
    }, 0);
  };

  // Transform discussions to include required fields
  const transformedDiscussions = data.discussions.map((discussion) => {
    const commentCount = countComments(discussion.comments);

    // Calculate weighted sentiment if available
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
      commentCount,
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
    subreddits: [data.subreddit],
    networkData: {
      nodes: [],
      links: [],
      centerNode: { id: "query", label: data.query, type: "query" },
    },
    entities: [],
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

      // Get subreddits for category
      const subreddits = categories[category as Category];
      const allData: RedditData[] = [];

      // Process each subreddit (limit to first 2 for now to keep it fast)
      const subredditsToProcess = subreddits.slice(0, 2);

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

      // Merge all data into a single structure
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
        discussions: allData.flatMap((d) => d.discussions),
      };

      // Transform to network structure
      const networkData = buildNetworkData(consolidatedData);

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
