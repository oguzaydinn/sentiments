import {
  getAccessToken,
  fetchComments,
  saveToJson,
  ensureDirExists,
  subreddits,
  searchQuery,
  OUTPUT_DIR,
} from "./reddit";

async function run() {
  console.log("🚀 Starting Reddit Scraper...");

  await ensureDirExists(OUTPUT_DIR);

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error("❌ Failed to authenticate with Reddit, exiting.");
    return;
  }

  for (const subreddit of subreddits) {
    const data = await fetchComments(accessToken, subreddit, searchQuery);
    await saveToJson(subreddit, data);
  }

  console.log("✅ Done! All comments saved.");
}

run();
