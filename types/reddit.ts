import type { SentimentAnalysis } from "./sentiment";

export interface Comment {
  text: string;
  score?: number;
  sentiment?: SentimentAnalysis;
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
  comments: Comment[];
  processedComments?: ProcessedComment[];
  sentiment?: SentimentAnalysis;
}

export interface RedditData {
  subredditName: string;
  query: string;
  category: string;
  date?: string;
  discussions: Discussion[];
  processedDiscussions?: Discussion[];
  sentiment?: SentimentAnalysis;
}

export type ProcessedRedditData = RedditData & {
  processedDiscussions: Discussion[];
};
