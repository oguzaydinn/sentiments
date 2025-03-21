import { fetchComments, saveToMongo, initializeReddit } from "./reddit";

const categories = {
  technology: ["technology", "Futurology", "OpenAI"],
  science: ["science", "Physics", "Space"],
  politics: ["politics", "worldnews", "geopolitics"],
  finance: ["finance", "cryptocurrency", "stocks"],
  gaming: ["gaming", "pcgaming", "gamedev"],
  health: ["health", "medicine", "Fitness"],
};

const categoryArg = process.argv[2];
const searchQuery = process.argv[3];

if (!categoryArg || !searchQuery) {
  console.error("❌ Usage: bun run index.ts <category> ");
  console.error("Available categories:", Object.keys(categories).join(", "));
  process.exit(1);
}

const subreddits = categories[categoryArg as keyof typeof categories];
if (!subreddits) {
  console.error(
    `❌ Invalid category "${categoryArg}". Choose from:`,
    Object.keys(categories).join(", ")
  );
  process.exit(1);
}

async function run() {
  console.log("🚀 Starting Reddit Scraper...");

  const reddit = await initializeReddit();

  for (const subreddit of subreddits) {
    const data = await fetchComments(
      reddit,
      subreddit,
      searchQuery,
      categoryArg
    );
    if (data) {
      await saveToMongo(data);
    }
  }

  console.log("✅ Done! All discussions stored.");
  process.exit(0);
}

run();
