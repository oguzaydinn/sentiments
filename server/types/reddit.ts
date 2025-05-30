import type { SentimentAnalysis, SentimentScores } from "./sentiment";
import type { Entity, EntityChain, SubredditEntityAnalysis } from "./entities";

export interface RedditComment {
  id: string;
  body: string; // Main comment text
  text: string; // Processed version
  processed: string;
  normalizedTokens: string[];
  score: number;
  author: string;
  timestamp: string;
  replies: RedditComment[];
  sentiment?: SentimentAnalysis;
  entities?: Entity[];
  // Temporary fields for building comment tree
  parentId?: string;
}

export interface ProcessedComment {
  text: string;
  original: string;
  processed: string;
  tokens: string[];
  tokensWithoutStopwords: string[];
  normalizedTokens: string[];
  sarcasm: {
    isSarcastic: boolean;
    confidence: number;
  };
  score?: number;
  sentiment?: SentimentAnalysis;
  entities?: Entity[];
}

export interface Discussion {
  id: string;
  title: string;
  url: string;
  content?: string; // Post content (if available)
  timestamp: string;
  score: number; // Reddit post score (upvotes)
  comments: RedditComment[];
  processedComments?: ProcessedComment[];
  sentiment?: SentimentAnalysis;
  entities?: Entity[];
  entityChains?: EntityChain[];
}

export interface RedditData {
  subreddit: string; // Updated from subredditName
  query: string;
  category: string;
  metadata: {
    query: string;
    timeframe: string;
    minScore: number;
    totalComments: number;
    totalDiscussions: number;
    scrapedAt: string;
  };
  discussions: Discussion[];
  sentiment?: SentimentAnalysis;
  entityAnalysis?: SubredditEntityAnalysis;
}

export type ProcessedRedditData = RedditData & {
  processedDiscussions: Discussion[];
};
