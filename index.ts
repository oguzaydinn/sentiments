import { fetchComments, saveToFile, initializeReddit } from "./reddit";
import { categories, type Category } from "./types/categories";
import { NERService } from "./ner";
import { saveEntityAnalysis, saveEntityVisualizationData } from "./storage";

const timeFilters = ["hour", "day", "week", "month", "year", "all"] as const;
type TimeFilter = (typeof timeFilters)[number];

const categoryArg = process.argv[2];
const searchQuery = process.argv[3];
const timeFilterArg = (process.argv[4] as TimeFilter) || "week";
const minPostScoreArg = parseInt(process.argv[5] || "50", 10);
const enableEntityAnalysis = process.argv.includes("--entities");

if (!categoryArg || !searchQuery) {
  console.error(
    "❌ Usage: bun run index.ts <category> <search_query> [time_filter] [min_post_score] [--entities]"
  );
  console.error("\nAvailable categories:");
  Object.keys(categories).forEach((category) => {
    console.error(`\n${category.toUpperCase()}:`);
    console.error(
      `  Subreddits: ${categories[category as Category].join(", ")}`
    );
  });
  console.error("\nTime filters:", timeFilters.join(", "), "(default: week)");
  console.error(
    "Min post score: Minimum upvotes for posts (default: 50, comments are unfiltered)"
  );
  console.error(
    "Add --entities flag to enable entity recognition using compromise.js"
  );
  process.exit(1);
}

if (process.argv[4] && !timeFilters.includes(timeFilterArg)) {
  console.error(
    `❌ Invalid time filter "${timeFilterArg}". Choose from:`,
    timeFilters.join(", ")
  );
  process.exit(1);
}

const subreddits = categories[categoryArg as Category];
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
    `📊 Settings: Category: ${categoryArg}, Query: "${searchQuery}", Time Filter: ${timeFilterArg}, Min Post Score: ${minPostScoreArg}`
  );

  if (enableEntityAnalysis) {
    console.log(
      "🔍 Entity analysis enabled - using compromise.js for automatic NER"
    );
  }

  const reddit = await initializeReddit();
  let nerService: NERService | null = null;

  // Initialize NER service if entity analysis is enabled
  if (enableEntityAnalysis) {
    console.log("🤖 Initializing compromise.js NER service...");
    nerService = new NERService();
    await nerService.initialize();
  }

  for (const subreddit of subreddits) {
    try {
      console.log(`\n📱 Processing r/${subreddit}...`);

      const data = await fetchComments(
        reddit,
        subreddit,
        searchQuery,
        categoryArg,
        timeFilterArg,
        minPostScoreArg,
        10
      );

      if (data) {
        // Save original comment data
        await saveToFile(data);

        // Perform entity analysis if enabled
        if (enableEntityAnalysis && nerService) {
          console.log(`🔍 Starting entity analysis for r/${subreddit}...`);

          try {
            const entityAnalysis = await nerService.analyzeEntities(data);

            // Update the data with entity analysis
            data.entityAnalysis = entityAnalysis;

            // Save entity analysis using consolidated storage
            await saveEntityAnalysis(entityAnalysis);
            await saveEntityVisualizationData(entityAnalysis);

            // Log summary
            console.log(`✅ Entity analysis completed for r/${subreddit}:`);
            console.log(
              `   📊 Found ${entityAnalysis.totalEntities} unique entities`
            );
            console.log(
              `   🔗 ${entityAnalysis.totalMentions} total mentions across ${entityAnalysis.totalScore} total upvotes`
            );
            console.log(
              `   👤 ${entityAnalysis.entityBreakdown.persons} persons, 🏢 ${entityAnalysis.entityBreakdown.organizations} organizations, 📍 ${entityAnalysis.entityBreakdown.locations} locations`
            );

            // Show top entities by score (simplified)
            const topChains = entityAnalysis.entityChains.slice(0, 3);
            if (topChains.length > 0) {
              console.log(
                `   🔥 Top entities: ${topChains
                  .map((c) => `${c.entity.text} (${c.totalScore} score)`)
                  .join(", ")}`
              );
            }
          } catch (entityError) {
            console.error(
              `❌ Error during entity analysis for r/${subreddit}:`,
              entityError
            );
            console.log(
              "⚠️ Continuing without entity analysis for this subreddit..."
            );
          }
        }
      } else {
        console.log(`⚠️ No data fetched for r/${subreddit}`);
      }
    } catch (error) {
      console.error(`❌ Error processing r/${subreddit}:`, error);
      console.log("⚠️ Continuing with next subreddit...");
    }
  }

  console.log("\n✅ Done! All discussions processed.");

  if (enableEntityAnalysis) {
    console.log("\n📊 Entity Analysis Summary:");
    console.log(
      `   🗂️  Data organized in logs/DDMMYYYY/${searchQuery.toLowerCase()}/`
    );
    console.log("   📄 Entity analysis: *_entities.json");
    console.log("   📊 Visualization data: *_entities_viz.json");
    console.log("   💬 Comment data: *.json");
    console.log("\n💡 Compromise.js automatically detected:");
    console.log("   - People (using built-in person recognition)");
    console.log("   - Organizations (using patterns + known companies)");
    console.log("   - Locations (using built-in place recognition)");
    console.log("\n📈 Visualization data ready for frontend:");
    console.log("   - Entity network graphs showing relationships");
    console.log("   - Sentiment analysis charts by entity");
    console.log("   - Most discussed persons/organizations/locations");
  }

  process.exit(0);
}

run();
