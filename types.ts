export type RedditData = {
  subredditName: string;
  query: string;
  category: string;
  date?: string;
  discussions: Discussion[];
  processedDiscussions?: Discussion[];
};

export type ProcessedRedditData = RedditData & {
  processedDiscussions: Discussion[];
};

export type Discussion = {
  title: string;
  url: string;
  comments: Comment[];
  processedComments?: ProcessedComment[];
};

export type Comment = {
  text: string;
  score: number;
};

export type ProcessedComment = {
  original: string;
  processed: string;
  tokens: string[];
  tokensWithoutStopwords: string[];
  normalizedTokens: string[];
  sarcasm: { isSarcastic: boolean; confidence: number };
  score: number;
};
