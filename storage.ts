import fs from "fs-extra";
import path from "path";
import type { RedditData } from "./types";

const DATA_DIR = "data";

export async function saveRedditData(data: RedditData): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const dateDirPath = path.join(DATA_DIR, today);
    await fs.ensureDir(dateDirPath);
    const sanitizedQuery = data.query
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .toLowerCase();
    const filename = `${sanitizedQuery}.json`;

    const filePath = path.join(dateDirPath, filename);
    let existingData: { subreddits: RedditData[] } = { subreddits: [] };

    try {
      if (await fs.pathExists(filePath)) {
        const fileData = await fs.readJson(filePath);
        if (fileData && typeof fileData === "object") {
          if (!Array.isArray(fileData.subreddits)) {
            existingData.subreddits = fileData.subreddits ? [fileData] : [];
          } else {
            existingData = fileData;
          }
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not read existing file ${filePath}, starting fresh`
      );
    }

    const existingSubredditIndex = existingData.subreddits.findIndex(
      (item) => item.subredditName === data.subredditName
    );

    if (existingSubredditIndex !== -1) {
      existingData.subreddits[existingSubredditIndex] = {
        ...data,
        discussions: [
          ...existingData.subreddits[existingSubredditIndex].discussions,
          ...data.discussions,
        ],
      };
    } else {
      existingData.subreddits.push(data);
    }

    await fs.writeJson(filePath, existingData, { spaces: 2 });

    console.log(`✅ Successfully stored data in ${filePath}`);
  } catch (error) {
    console.error("❌ Failed to save data to file:", error);
    throw error;
  }
}
