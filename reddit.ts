import { Buffer } from "buffer";
import dotenv from "dotenv";
import axios from "axios";
import snoowrap from "snoowrap";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Load environment variables
dotenv.config();

// Ensure environment variables are set
if (
  !process.env.CLIENT_ID ||
  !process.env.CLIENT_SECRET ||
  !process.env.USER_AGENT
) {
  console.error("❌ Missing required environment variables in .env file.");
  process.exit(1);
}

// 🔹 Reddit API Credentials
const CLIENT_ID = process.env.CLIENT_ID as string;
const CLIENT_SECRET = process.env.CLIENT_SECRET as string;
const USER_AGENT = process.env.USER_AGENT as string;

// 🔹 Reddit OAuth Token Endpoint
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

// 🔹 Function to Get an Access Token
async function getAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "client_credentials",
      }),
      {
        auth: {
          username: CLIENT_ID,
          password: CLIENT_SECRET,
        },
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    console.log("✅ Access Token:", response.data.access_token);
    return response.data.access_token;
  } catch (error: any) {
    console.error(
      "❌ Failed to get access token:",
      error.response?.data || error.message
    );
    return null;
  }
}

// 🔹 List of Subreddits & Search Query
const subreddits: string[] = [
  "artificial",
  "MachineLearning",
  "OpenAI",
  "GPT3",
];
const searchQuery: string = "grok";

// 🔹 Directory for storing JSON files
const OUTPUT_DIR: string = "reddit_comments";

// 🔹 Ensure Directory Exists
async function ensureDirExists(dir: string) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    console.error("❌ Error creating directory: ", error);
  }
}

// 🔹 Function to Fetch Reddit Comments
async function fetchComments(
  accessToken: string,
  subredditName: string,
  query: string
) {
  try {
    console.log(`🔍 Searching in r/${subredditName} for "${query}"...`);
    const reddit = new snoowrap({
      accessToken,
      userAgent: USER_AGENT,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN ?? "",
    });

    const subreddit = reddit.getSubreddit(subredditName);
    const posts = await subreddit.search({ query, sort: "hot", limit: 10 });

    const postData: Record<string, any> = {};

    for (const post of posts) {
      const postTitle = post.title;
      const postUrl = `https://www.reddit.com${post.permalink}`;
      const postId = post.id;

      console.log(`📌 Fetching comments for: ${postTitle}`);

      // Retrieve top comments
      const rawComments = await post.comments.fetchMore({
        amount: 50,
        skipReplies: false,
      });
      const commentsArray = rawComments.map((comment) => ({
        text: comment.body,
        score: comment.score,
      }));

      postData[postTitle] = {
        post_id: postId,
        post_url: postUrl,
        num_comments: commentsArray.length,
        comments: commentsArray,
      };
    }

    return postData;
  } catch (error) {
    console.error(`❌ Error fetching from r/${subredditName}:`, error);
    return {};
  }
}

// 🔹 Save Data as JSON File
async function saveToJson(subreddit: string, data: any) {
  const filePath = path.join(OUTPUT_DIR, `${subreddit}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`✅ Data saved to ${filePath}`);
}

// 🔹 Export Functions for Use in `index.ts`
export {
  getAccessToken,
  fetchComments,
  saveToJson,
  ensureDirExists,
  subreddits,
  searchQuery,
  OUTPUT_DIR,
};
