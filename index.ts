import {
  fetchComments,
  saveToMongo,
  subreddits,
  searchQuery,
  initializeReddit,
} from "./reddit";
import { connectDB } from "./database";

async function run() {
  console.log("🚀 Starting Reddit Scraper...");
  await connectDB();

  const redditClient = await initializeReddit();

  for (const subreddit of subreddits) {
    const data = await fetchComments(subreddit, searchQuery, redditClient);
    if (data) {
      await saveToMongo(data);
    }
  }

  console.log("✅ Done! All discussions stored.");
}

run();
