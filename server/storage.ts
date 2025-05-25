import fs from "fs-extra";
import path from "path";
import { PrismaClient } from "./generated/prisma";
import type { RedditData } from "./types/reddit";
import type { SubredditEntityAnalysis, EntityChain } from "./types/entities";

const LOGS_DIR = "logs";
const prisma = new PrismaClient();

/**
 * Get the organized directory path for a query
 */
function getQueryPath(query: string): string {
  // Create date directory in DDMMYYYY format
  const today = new Date();
  const dateStr = today
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "");

  // Create query directory (sanitized)
  const queryDir = query.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();

  return path.join(LOGS_DIR, dateStr, queryDir);
}

/**
 * Save Reddit comment data to both file system and database
 */
export async function saveRedditData(data: RedditData): Promise<void> {
  try {
    // Handle both old and new data structures for backward compatibility
    const query = (data as any).metadata?.query || data.query;
    const subreddit = data.subreddit || (data as any).subredditName;

    const fullPath = getQueryPath(query);
    await fs.ensureDir(fullPath);

    const filename = `${subreddit}.json`;
    const filePath = path.join(fullPath, filename);

    // Read existing data if it exists
    let existingData: RedditData | null = null;
    try {
      if (await fs.pathExists(filePath)) {
        existingData = await fs.readJson(filePath);
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not read existing file ${filePath}, starting fresh`
      );
    }

    // Merge new data with existing data if it exists
    const mergedData: RedditData = existingData
      ? {
          ...data,
          discussions: [...existingData.discussions, ...data.discussions],
        }
      : data;

    // Save to file system
    await fs.writeJson(filePath, mergedData, { spaces: 2 });
    console.log(`✅ File saved: ${filePath}`);

    // Save to database
    try {
      await prisma.redditAnalysis.create({
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
        },
      });
      console.log(`✅ Database saved: ${subreddit} analysis`);
    } catch (dbError) {
      console.warn(
        `⚠️ Database save failed (continuing with file only):`,
        dbError
      );
    }
  } catch (error) {
    console.error("❌ Failed to save Reddit data:", error);
    throw error;
  }
}

/**
 * Save entity analysis to both file system and database
 */
export async function saveEntityAnalysis(
  analysis: SubredditEntityAnalysis
): Promise<void> {
  try {
    const fullPath = getQueryPath(analysis.query);
    await fs.ensureDir(fullPath);

    const filename = `${analysis.subreddit}_entities.json`;
    const filePath = path.join(fullPath, filename);

    // Save to file system
    await fs.writeJson(filePath, analysis, { spaces: 2 });
    console.log(`✅ Entity analysis saved to: ${filePath}`);

    // Save to database
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
            skipDuplicates: true,
          });
        }

        console.log(
          `✅ Database updated: ${analysis.subreddit} entity analysis`
        );
      } else {
        console.warn(`⚠️ No matching Reddit analysis found for entity save`);
      }
    } catch (dbError) {
      console.warn(
        `⚠️ Database entity save failed (continuing with file only):`,
        dbError
      );
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
 * Save simplified entity visualization data for frontend use
 */
export async function saveEntityVisualizationData(
  analysis: SubredditEntityAnalysis
): Promise<void> {
  try {
    const fullPath = getQueryPath(analysis.query);
    await fs.ensureDir(fullPath);

    const filename = `${analysis.subreddit}_entities_viz.json`;
    const filePath = path.join(fullPath, filename);

    const visualizationData = {
      subreddit: analysis.subreddit,
      query: analysis.query,
      timestamp: new Date().toISOString(),
      totalScore: analysis.totalScore,

      // For entity network graph
      entityNetwork: {
        nodes: analysis.entityChains.map((chain) => ({
          id: `${chain.entity.normalizedText}-${chain.entity.type}`,
          label: chain.entity.text,
          type: chain.entity.type,
          mentions: chain.totalMentions,
          totalScore: chain.totalScore,
          sentiment: chain.averageSentiment.overall,
          sentimentScore: chain.averageSentiment.compound,
        })),
      },

      // For sentiment visualization
      sentimentBreakdown: {
        positive: analysis.entityChains.filter(
          (c) => c.averageSentiment.overall === "positive"
        ).length,
        negative: analysis.entityChains.filter(
          (c) => c.averageSentiment.overall === "negative"
        ).length,
        neutral: analysis.entityChains.filter(
          (c) => c.averageSentiment.overall === "neutral"
        ).length,
      },

      // For type breakdown
      typeBreakdown: [
        { type: "PERSON", count: analysis.entityBreakdown.persons },
        { type: "ORGANIZATION", count: analysis.entityBreakdown.organizations },
        { type: "LOCATION", count: analysis.entityBreakdown.locations },
      ],

      // Top entities by category (sorted by total score)
      topEntities: {
        persons: analysis.entityChains
          .filter((c) => c.entity.type === "PERSON")
          .slice(0, 10),
        organizations: analysis.entityChains
          .filter((c) => c.entity.type === "ORGANIZATION")
          .slice(0, 10),
        locations: analysis.entityChains
          .filter((c) => c.entity.type === "LOCATION")
          .slice(0, 10),
      },

      // Sentiment summary by entity type
      sentimentSummary: {
        mostPositiveEntities: getTopEntitiesBySentiment(
          analysis,
          "positive",
          5
        ),
        mostNegativeEntities: getTopEntitiesBySentiment(
          analysis,
          "negative",
          5
        ),
        mostInfluentialPersons: analysis.entityChains
          .filter((c) => c.entity.type === "PERSON")
          .slice(0, 5)
          .map((chain) => ({
            name: chain.entity.text,
            mentions: chain.totalMentions,
            totalScore: chain.totalScore,
            sentiment: chain.averageSentiment.overall,
            sentimentScore: chain.averageSentiment.compound,
          })),
        mostInfluentialOrganizations: analysis.entityChains
          .filter((c) => c.entity.type === "ORGANIZATION")
          .slice(0, 5)
          .map((chain) => ({
            name: chain.entity.text,
            mentions: chain.totalMentions,
            totalScore: chain.totalScore,
            sentiment: chain.averageSentiment.overall,
            sentimentScore: chain.averageSentiment.compound,
          })),
      },
    };

    await fs.writeJson(filePath, visualizationData, { spaces: 2 });
    console.log(`✅ Entity visualization data saved to: ${filePath}`);
  } catch (error) {
    console.error("❌ Failed to save entity visualization data:", error);
    throw error;
  }
}

/**
 * Load entity analysis from the organized structure
 */
export async function loadEntityAnalysis(
  subredditName: string,
  query: string
): Promise<SubredditEntityAnalysis | null> {
  try {
    const fullPath = getQueryPath(query);
    const filename = `${subredditName}_entities.json`;
    const filePath = path.join(fullPath, filename);

    if (!(await fs.pathExists(filePath))) {
      console.warn(`Entity analysis file not found: ${filePath}`);
      return null;
    }

    const data = await fs.readJson(filePath);
    return data as SubredditEntityAnalysis;
  } catch (error) {
    console.error("❌ Error loading entity analysis:", error);
    return null;
  }
}

/**
 * List all analysis files for a query
 */
export async function listAnalysisFiles(query: string): Promise<{
  comments: string[];
  entities: string[];
  visualizations: string[];
}> {
  try {
    const fullPath = getQueryPath(query);

    if (!(await fs.pathExists(fullPath))) {
      return { comments: [], entities: [], visualizations: [] };
    }

    const files = await fs.readdir(fullPath);

    return {
      comments: files.filter(
        (f) => f.endsWith(".json") && !f.includes("_entities")
      ),
      entities: files.filter((f) => f.includes("_entities.json")),
      visualizations: files.filter((f) => f.includes("_entities_viz.json")),
    };
  } catch (error) {
    console.error("❌ Error listing analysis files:", error);
    return { comments: [], entities: [], visualizations: [] };
  }
}

// Helper functions

/**
 * Remove circular references and non-serializable objects
 */
function sanitizeForStorage(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (typeof value === "function") {
        return undefined;
      }
      return value;
    })
  );
}

/**
 * Get top entities by sentiment
 */
function getTopEntitiesBySentiment(
  analysis: SubredditEntityAnalysis,
  sentiment: "positive" | "negative",
  limit: number
) {
  const entities = analysis.entityChains.filter(
    (c) => c.averageSentiment.overall === sentiment
  );
  return entities.slice(0, limit).map((entity) => ({
    text: entity.entity.text,
    type: entity.entity.type,
    totalScore: entity.totalScore,
    sentiment: entity.averageSentiment.overall,
    sentimentScore: entity.averageSentiment.compound,
  }));
}
