import snoowrap from "snoowrap";
import dotenv from "dotenv";
import { RedditModel } from "./models";
import type { RedditData } from "./types";
import axios from "axios";
import type Snoowrap from "snoowrap";
import { connectDB } from "./database";
import { preprocessRedditData } from "./preprocessing";

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
  category: string,
  timeFilter: "hour" | "day" | "week" | "month" | "year" | "all" = "week",
  minScore: number = 50,
  limit: number = 10
): Promise<RedditData | null> {
  try {
    console.log(
      `🔍 Fetching posts from r/${subredditName} for query: "${query}" (last ${timeFilter}, min score: ${minScore})`
    );
    const subreddit = reddit.getSubreddit(subredditName);
    const searchOptions: any = {
      query,
      sort: "relevance",
      time: timeFilter,
      limit: limit * 2,
    };
    const posts = await subreddit.search(searchOptions);

    const filteredPosts = posts.filter((post) => post.score >= minScore);

    const sortedPosts = filteredPosts
      .sort((a, b) => b.created_utc - a.created_utc)
      .slice(0, limit);

    if (!sortedPosts.length) {
      console.log(
        `⚠ No posts found for "${query}" in r/${subredditName} with minimum score ${minScore} in the last ${timeFilter}`
      );
      return null;
    }

    const postData: RedditData = {
      subredditName,
      query,
      category: category,
      discussions: [],
    };

    for (const post of sortedPosts) {
      const postTitle = post.title;
      const postUrl = `https://www.reddit.com${post.permalink}`;
      const postDate = new Date(post.created_utc * 1000)
        .toISOString()
        .split("T")[0];
      const postScore = post.score;

      console.log(
        `📌 Fetching comments for: ${postTitle} (Score: ${postScore}, Date: ${postDate})`
      );

      const fetchOptions: any = {
        amount: 25, // Reduced from 50 to focus on top comments
        sort: "top", // Get the highest-rated comments
        skipReplies: false,
      };
      const rawComments = await post.comments.fetchMore(fetchOptions);

      // Filter comments by minimum score (half of post minimum to ensure we get some comments)
      const commentMinScore = Math.max(5, Math.floor(minScore / 5));
      const filteredComments = rawComments
        .filter((comment) => comment.score >= commentMinScore)
        .map((comment) => ({
          text: comment.body,
          score: comment.score,
        }));

      postData.discussions.push({
        title: postTitle,
        url: postUrl,
        comments: filteredComments,
      });
    }

    console.log(`🔄 Preprocessing data from r/${subredditName}...`);
    const processedData = preprocessRedditData(postData);

    return processedData;
  } catch (error) {
    console.error(`❌ Error fetching from r/${subredditName}:`, error);
    return null;
  }
}

async function saveToMongo(data: RedditData) {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

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

      if (data.processedDiscussions) {
        existingDoc.processedDiscussions = [
          ...(existingDoc.processedDiscussions || []),
          ...data.processedDiscussions,
        ];
      }

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
