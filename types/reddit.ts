import type { SentimentAnalysis, SentimentScores } from "./sentiment";

export interface RedditComment {
  text: string;
  processed: string;
  normalizedTokens: string[];
  score: number;
  replies: RedditComment[];
  sentiment?: SentimentAnalysis;
  // Temporary fields for building comment tree
  parentId?: string;
  id?: string;
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
}

export interface Discussion {
  title: string;
  url: string;
  comments: RedditComment[];
  processedComments?: ProcessedComment[];
  sentiment?: SentimentAnalysis;
}

export interface RedditData {
  subredditName: string;
  query: string;
  category: string;
  discussions: Discussion[];
  sentiment?: SentimentAnalysis;
}

export type ProcessedRedditData = RedditData & {
  processedDiscussions: Discussion[];
};
