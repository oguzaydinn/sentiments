import fs from "fs-extra";
import path from "path";
import type { RedditData } from "./types";

const LOGS_DIR = "logs";

export async function saveRedditData(data: RedditData): Promise<void> {
  try {
    // Create date directory in DDMMYYYY format
    const today = new Date();
    const dateStr = today
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "");

    // Create query directory
    const queryDir = data.query.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();

    // Create full path
    const fullPath = path.join(LOGS_DIR, dateStr, queryDir);
    await fs.ensureDir(fullPath);

    // Create file with subreddit name
    const filename = `${data.subredditName}.json`;
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
          processedDiscussions: [
            ...(existingData.processedDiscussions || []),
            ...(data.processedDiscussions || []),
          ],
        }
      : data;

    // Write data to file
    await fs.writeJson(filePath, mergedData, { spaces: 2 });
    console.log(`✅ Successfully stored data in ${filePath}`);
  } catch (error) {
    console.error("❌ Failed to save data to file:", error);
    throw error;
  }
}
