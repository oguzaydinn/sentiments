import snoowrap from "snoowrap";
import dotenv from "dotenv";
import { RedditModel } from "./models";
import type { RedditData } from "./types";
import axios from "axios";
import { saveRedditData } from "./storage";
import type Snoowrap from "snoowrap";
import { connectDB } from "./database";

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const USER_AGENT = process.env.USER_AGENT!;

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

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

export async function initializeReddit() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Failed to get access token");
  }

  return new snoowrap({
    userAgent: USER_AGENT,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    accessToken: accessToken,
  });
}

async function fetchComments(
  reddit: Snoowrap,
  subredditName: string,
  query: string,
  category: string
): Promise<RedditData | null> {
  try {
    console.log(
      `🔍 Fetching posts from r/${subredditName} for query: "${query}"`
    );
    const subreddit = reddit.getSubreddit(subredditName);
    const posts = await subreddit.search({ query, sort: "hot" });

    if (!posts.length) {
      console.log(`⚠ No posts found for "${query}" in r/${subredditName}`);
      return null;
    }

    const postData: RedditData = {
      subredditName,
      query,
      category: category,
      discussions: [],
    };

    for (const post of posts) {
      const postTitle = post.title;
      const postUrl = `https://www.reddit.com${post.permalink}`;

      console.log(`📌 Fetching comments for: ${postTitle}`);

      const rawComments = await post.comments.fetchMore({
        amount: 50,
        skipReplies: false,
      });
      const commentsArray = rawComments.map((comment) => ({
        text: comment.body,
        score: comment.score,
      }));

      postData.discussions.push({
        title: postTitle,
        url: postUrl,
        comments: commentsArray,
      });
    }

    return postData;
  } catch (error) {
    console.error(`❌ Error fetching from r/${subredditName}:`, error);
    return null;
  }
}

async function saveToMongo(data: RedditData) {
  try {
    await connectDB();

    const today = new Date().toISOString().split("T")[0];

    const existingDoc = await RedditModel.findOne({
      subredditName: data.subredditName,
      query: data.query,
      category: data.category,
      date: today,
    });

    if (existingDoc) {
      existingDoc.discussions = [
        ...existingDoc.discussions,
        ...data.discussions,
      ];
      await existingDoc.save();
    } else {
      await RedditModel.create({
        ...data,
        date: today,
      });
    }

    console.log(
      `✅ Successfully stored data for r/${data.subredditName} in MongoDB for date: ${today}`
    );
  } catch (error) {
    console.error("❌ Failed to save data to MongoDB:", error);
    throw error;
  }
}

export { fetchComments, saveToMongo };
