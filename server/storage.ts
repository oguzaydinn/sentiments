import { PrismaClient } from "./generated/prisma";
import type { RedditData } from "./types/reddit";
import type { SubredditEntityAnalysis, EntityChain } from "./types/entities";

const prisma = new PrismaClient();

export interface CachedAnalysis {
  id: string;
  createdAt: Date;
  query: string;
  category: string;
  timeframe: string;
  minScore: number;
  totalComments: number;
  totalDiscussions: number;
  discussions: any;
  sentimentAnalysis?: any;
  entityAnalysis?: any;
}

export interface RecentQuery {
  id: string;
  query: string;
  category: string;
  createdAt: Date;
  totalComments: number;
  totalDiscussions: number;
}

/**
 * Check if analysis exists in cache (within last 24 hours)
 */
export async function getCachedAnalysis(
  query: string,
  category: string,
  timeframe: string,
  minScore: number
): Promise<CachedAnalysis | null> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const cached = await prisma.redditAnalysis.findFirst({
      where: {
        query: {
          equals: query,
          mode: "insensitive",
        },
        category,
        timeframe,
        minScore,
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!cached) return null;

    console.log(`🎯 Found cached analysis for "${query}" in ${category}`);
    return {
      id: cached.id,
      createdAt: cached.createdAt,
      query: cached.query,
      category: cached.category,
      timeframe: cached.timeframe,
      minScore: cached.minScore,
      totalComments: cached.totalComments,
      totalDiscussions: cached.totalDiscussions,
      discussions: cached.discussions,
      sentimentAnalysis: cached.sentimentAnalysis,
      entityAnalysis: cached.entityAnalysis,
    };
  } catch (error) {
    console.error("Error checking cache:", error);
    return null;
  }
}

/**
 * Save Reddit comment data to database only
 */
export async function saveRedditData(data: RedditData): Promise<string> {
  try {
    const analysis = await prisma.redditAnalysis.create({
      data: {
        subreddit: data.subreddit,
        query: data.query,
        category: data.category,
        timeframe: data.metadata.timeframe,
        minScore: data.metadata.minScore,
        totalComments: data.metadata.totalComments,
        totalDiscussions: data.metadata.totalDiscussions,
        scrapedAt: new Date(data.metadata.scrapedAt),
        discussions: data.discussions as any,
        sentimentAnalysis: data.sentiment as any,
      },
    });

    console.log(`💾 Saved analysis to database with ID: ${analysis.id}`);
    return analysis.id;
  } catch (error) {
    console.error("❌ Failed to save Reddit data to database:", error);
    throw error;
  }
}

/**
 * Save consolidated analysis with entity data
 */
export async function saveConsolidatedAnalysis(
  consolidatedData: RedditData,
  entityAnalyses: SubredditEntityAnalysis[] = []
): Promise<string> {
  try {
    // Prepare entity analysis data
    let entityAnalysisData = null;
    if (entityAnalyses.length > 0) {
      const allEntityChains = entityAnalyses.flatMap(
        (analysis) => analysis.entityChains
      );
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

      entityAnalysisData = {
        query: consolidatedData.query,
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

    // Save main analysis
    const analysis = await prisma.redditAnalysis.create({
      data: {
        subreddit: consolidatedData.subreddit,
        query: consolidatedData.query,
        category: consolidatedData.category,
        timeframe: consolidatedData.metadata.timeframe,
        minScore: consolidatedData.metadata.minScore,
        totalComments: consolidatedData.metadata.totalComments,
        totalDiscussions: consolidatedData.metadata.totalDiscussions,
        scrapedAt: new Date(consolidatedData.metadata.scrapedAt),
        discussions: consolidatedData.discussions as any,
        sentimentAnalysis: consolidatedData.sentiment as any,
        entityAnalysis: entityAnalysisData as any,
      },
    });

    // Save individual entity chains if available
    if (entityAnalysisData?.entityChains) {
      await prisma.entityChain.createMany({
        data: entityAnalysisData.entityChains.map((chain: any) => ({
          analysisId: analysis.id,
          entityText: chain.entity.text,
          entityType: chain.entity.type,
          normalizedText: chain.entity.normalizedText,
          totalMentions: chain.totalMentions,
          uniquePosts: chain.uniquePosts || 1,
          totalScore: chain.totalScore,
          averageSentiment: chain.averageSentiment as any,
          sentimentTrend: chain.sentimentTrend as any,
        })),
      });
    }

    console.log(
      `💾 Saved consolidated analysis to database with ID: ${analysis.id}`
    );
    return analysis.id;
  } catch (error) {
    console.error("Error saving consolidated analysis:", error);
    throw error;
  }
}

/**
 * Save entity analysis to database only
 */
export async function saveEntityAnalysis(
  analysis: SubredditEntityAnalysis
): Promise<void> {
  try {
    // Find the corresponding Reddit analysis
    const redditAnalysis = await prisma.redditAnalysis.findFirst({
      where: {
        subreddit: analysis.subreddit,
        query: analysis.query,
      },
      orderBy: { createdAt: "desc" },
    });

    if (redditAnalysis) {
      // Update the Reddit analysis with entity data
      await prisma.redditAnalysis.update({
        where: { id: redditAnalysis.id },
        data: {
          entityAnalysis: analysis as any,
        },
      });

      // Save individual entity chains
      if (analysis.entityChains.length > 0) {
        const entityChains = analysis.entityChains.map((chain) => ({
          analysisId: redditAnalysis.id,
          entityText: chain.entity.text,
          entityType: chain.entity.type,
          normalizedText: chain.entity.normalizedText,
          totalMentions: chain.totalMentions,
          uniquePosts: chain.uniquePosts,
          totalScore: chain.totalScore,
          averageSentiment: chain.averageSentiment as any,
          sentimentTrend: chain.sentimentTrend as any,
        }));

        await prisma.entityChain.createMany({
          data: entityChains,
        });
      }

      console.log(`✅ Database updated: ${analysis.subreddit} entity analysis`);
    } else {
      console.warn(`⚠️ No matching Reddit analysis found for entity save`);
    }

    console.log(`Found ${analysis.totalEntities} unique entities`);
    console.log(
      `- Persons: ${analysis.entityBreakdown.persons}, Organizations: ${analysis.entityBreakdown.organizations}, Locations: ${analysis.entityBreakdown.locations}`
    );
    console.log(`- Total weighted score: ${analysis.totalScore}`);
  } catch (error) {
    console.error("❌ Failed to save entity analysis:", error);
    throw error;
  }
}

/**
 * Get recent queries for frontend display
 */
export async function getRecentQueries(
  limit: number = 10
): Promise<RecentQuery[]> {
  try {
    const recent = await prisma.redditAnalysis.findMany({
      select: {
        id: true,
        query: true,
        category: true,
        createdAt: true,
        totalComments: true,
        totalDiscussions: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return recent;
  } catch (error) {
    console.error("Error fetching recent queries:", error);
    return [];
  }
}

/**
 * Get analysis by ID
 */
export async function getAnalysisById(
  id: string
): Promise<CachedAnalysis | null> {
  try {
    const analysis = await prisma.redditAnalysis.findUnique({
      where: { id },
      include: {
        EntityChain: true,
      },
    });

    if (!analysis) return null;

    return {
      id: analysis.id,
      createdAt: analysis.createdAt,
      query: analysis.query,
      category: analysis.category,
      timeframe: analysis.timeframe,
      minScore: analysis.minScore,
      totalComments: analysis.totalComments,
      totalDiscussions: analysis.totalDiscussions,
      discussions: analysis.discussions,
      sentimentAnalysis: analysis.sentimentAnalysis,
      entityAnalysis: analysis.entityAnalysis,
    };
  } catch (error) {
    console.error("Error fetching analysis by ID:", error);
    return null;
  }
}

/**
 * Clean up old analyses (older than 7 days)
 */
export async function cleanupOldAnalyses(): Promise<number> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await prisma.redditAnalysis.deleteMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    console.log(`🧹 Cleaned up ${result.count} old analyses`);
    return result.count;
  } catch (error) {
    console.error("Error cleaning up old analyses:", error);
    return 0;
  }
}

/**
 * Close database connection
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
