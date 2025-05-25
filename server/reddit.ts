import snoowrap from "snoowrap";
import dotenv from "dotenv";
import type { RedditData, RedditComment } from "./types/reddit";
import axios from "axios";
import type Snoowrap from "snoowrap";
import { preprocessRedditData } from "./preprocessing";
import { saveRedditData } from "./storage";
import { analyzeRedditData } from "./sentiment";

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
  minPostScore: number = 50,
  limit: number = 10
): Promise<RedditData | null> {
  try {
    console.log(
      `🔍 Fetching posts from r/${subredditName} for query: "${query}" (last ${timeFilter}, min post score: ${minPostScore})`
    );
    const subreddit = reddit.getSubreddit(subredditName);
    const searchOptions: any = {
      query,
      sort: "relevance",
      time: timeFilter,
      limit: limit * 2,
    };
    const posts = await subreddit.search(searchOptions);

    const filteredPosts = posts.filter((post) => post.score >= minPostScore);

    const sortedPosts = filteredPosts
      .sort((a, b) => b.created_utc - a.created_utc)
      .slice(0, limit);

    if (!sortedPosts.length) {
      console.log(
        `⚠ No posts found for "${query}" in r/${subredditName} with minimum score ${minPostScore} in the last ${timeFilter}`
      );
      return null;
    }

    const postData: RedditData = {
      subreddit: subredditName,
      query,
      category: category,
      metadata: {
        query,
        timeframe: timeFilter,
        minScore: minPostScore,
        totalComments: 0,
        totalDiscussions: 0,
        scrapedAt: new Date().toISOString(),
      },
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
        amount: 50,
        sort: "top",
        skipReplies: false,
      };
      const rawComments = await post.comments.fetchMore(fetchOptions);

      console.log(
        `📝 Processing ${rawComments.length} comments (all scores included)`
      );

      const allComments = rawComments.map((comment) => {
        const commentData: RedditComment = {
          id: comment.id,
          text: comment.body,
          body: comment.body,
          processed: "",
          normalizedTokens: [],
          score: comment.score,
          author: comment.author ? comment.author.name : "[deleted]",
          timestamp: new Date(comment.created_utc * 1000).toISOString(),
          parentId: comment.parent_id,
          replies: [],
        };
        return commentData;
      });

      const commentMap = new Map<string, RedditComment>();
      const rootComments: RedditComment[] = [];

      allComments.forEach((comment) => {
        if (comment.id) {
          commentMap.set(comment.id, comment);
        }
      });

      allComments.forEach((comment) => {
        if (!comment.parentId) {
          rootComments.push(comment);
          return;
        }

        if (comment.parentId.startsWith("t3_")) {
          rootComments.push(comment);
        } else {
          const parentId = comment.parentId.replace("t1_", "");
          const parent = commentMap.get(parentId);
          if (parent) {
            parent.replies.push(comment);
          } else {
            rootComments.push(comment);
          }
        }
      });

      postData.discussions.push({
        id: post.id,
        title: postTitle,
        url: postUrl,
        timestamp: new Date(post.created_utc * 1000).toISOString(),
        comments: rootComments,
      });
    }

    // Update metadata with actual counts
    const totalComments = postData.discussions.reduce(
      (sum, discussion) => sum + discussion.comments.length,
      0
    );
    postData.metadata.totalComments = totalComments;
    postData.metadata.totalDiscussions = postData.discussions.length;

    console.log(
      `📊 Collected ${postData.discussions.length} discussions with ${totalComments} total comments`
    );
    console.log(`🔄 Preprocessing data from r/${subredditName}...`);
    const processedData = preprocessRedditData(postData);

    console.log(`📊 Analyzing sentiment for r/${subredditName}...`);
    const dataWithSentiment = analyzeRedditData(processedData);

    return dataWithSentiment;
  } catch (error) {
    console.error(`❌ Error fetching from r/${subredditName}:`, error);
    return null;
  }
}

async function saveToFile(data: RedditData) {
  try {
    console.log("💾 Saving data to file system...");
    await saveRedditData(data);
    console.log(`✅ Successfully stored data for r/${data.subreddit}`);
  } catch (error) {
    console.error("❌ Failed to save data to file:", error);
    throw error;
  }
}

export { fetchComments, saveToFile };
