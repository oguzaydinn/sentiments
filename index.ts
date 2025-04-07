import { fetchComments, saveToMongo, initializeReddit } from "./reddit";

const categories = {
  technology: ["technology", "Futurology", "OpenAI"],
  science: ["science", "Physics", "Space"],
  politics: ["politics", "worldnews", "geopolitics"],
  finance: ["finance", "cryptocurrency", "stocks"],
  gaming: ["gaming", "pcgaming", "gamedev"],
  health: ["health", "medicine", "Fitness"],
};

const timeFilters = ["hour", "day", "week", "month", "year", "all"] as const;
type TimeFilter = (typeof timeFilters)[number];

const categoryArg = process.argv[2];
const searchQuery = process.argv[3];
const timeFilterArg = (process.argv[4] as TimeFilter) || "week";
const minScoreArg = parseInt(process.argv[5] || "50", 10);

if (!categoryArg || !searchQuery) {
  console.error(
    "❌ Usage: bun run index.ts <category> <search_query> [time_filter] [min_score]"
  );
  console.error("Available categories:", Object.keys(categories).join(", "));
  console.error(
    "Available time filters:",
    timeFilters.join(", "),
    "(default: month)"
  );
  console.error("Min score: Minimum score for posts (default: 50)");
  process.exit(1);
}

if (process.argv[4] && !timeFilters.includes(timeFilterArg)) {
  console.error(
    `❌ Invalid time filter "${timeFilterArg}". Choose from:`,
    timeFilters.join(", ")
  );
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
  console.log(`🚀 Starting Reddit Scraper...`);
  console.log(
    `📊 Settings: Category: ${categoryArg}, Query: "${searchQuery}", Time Filter: ${timeFilterArg}, Min Score: ${minScoreArg}`
  );

  const reddit = await initializeReddit();

  for (const subreddit of subreddits) {
    const data = await fetchComments(
      reddit,
      subreddit,
      searchQuery,
      categoryArg,
      timeFilterArg,
      minScoreArg,
      10
    );
    if (data) {
      try {
        await saveToMongo(data);
      } catch (error) {
        console.error(`❌ Error saving data for r/${subreddit}:`, error);
        console.log("⚠️ Continuing with next subreddit...");
      }
    }
  }

  console.log("✅ Done! All discussions stored.");
  process.exit(0);
}

run();
