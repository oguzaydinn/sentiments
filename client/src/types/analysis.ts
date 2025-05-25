export interface SentimentAnalysis {
  positivity: number;
  negativity: number;
  neutrality: number;
  compound: number;
  overall: "positive" | "negative" | "neutral";
}

export interface Entity {
  text: string;
  normalizedText: string;
  type: "PERSON" | "ORGANIZATION" | "LOCATION";
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface EntityChain {
  entity: Entity;
  totalMentions: number;
  uniquePosts: number;
  totalScore: number;
  averageSentiment: SentimentAnalysis;
  sentimentTrend: Array<{
    timestamp: string;
    sentiment: SentimentAnalysis;
    score: number;
  }>;
}

export interface RedditComment {
  id?: string;
  text: string;
  processed?: string;
  normalizedTokens?: string[];
  score: number;
  author?: string;
  timestamp?: string;
  replies: RedditComment[];
  sentiment?: {
    original: {
      neg: number;
      neu: number;
      pos: number;
      compound: number;
    };
    overall: {
      neg: number;
      neu: number;
      pos: number;
      compound: number;
    };
    label: "positive" | "negative" | "neutral";
  };
  entities?: Entity[];
  depth?: number;
}

export interface Discussion {
  id?: string;
  title: string;
  url: string;
  timestamp?: string;
  subreddit: string;
  score: number;
  comments: RedditComment[];
  sentiment?: {
    original: {
      neg: number;
      neu: number;
      pos: number;
      compound: number;
    };
    overall: {
      neg: number;
      neu: number;
      pos: number;
      compound: number;
    };
    label: "positive" | "negative" | "neutral";
  };
  entities?: Entity[];
  commentCount: number;
  weightedSentiment?: number | null; // Score-weighted average sentiment, can be null
}

// Network visualization specific types
export interface QueryNode {
  id: string;
  label: string;
  type: "query";
  x?: number;
  y?: number;
}

export interface SubredditNode {
  id: string;
  label: string;
  type: "subreddit";
  discussionCount: number;
  totalComments: number;
  averageSentiment: number;
  weightedSentiment: number;
  topEntities: Array<{
    entity: Entity;
    mentions: number;
    averageSentiment: number;
  }>;
  x?: number;
  y?: number;
}

export interface TopicNode {
  id: string;
  label: string;
  type: "topic";
  subreddit: string;
  discussion: Discussion;
  commentCount: number;
  averageSentiment: number;
  weightedSentiment: number;
  topComments: Array<{
    comment: RedditComment;
    sentimentImpact: number; // How much this comment affects the average
  }>;
  x?: number;
  y?: number;
}

export interface CommentNode {
  id: string;
  label: string;
  type: "comment";
  comment: RedditComment;
  sentimentScore: number;
  parentId?: string;
  x?: number;
  y?: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  type:
    | "query-subreddit"
    | "subreddit-topic"
    | "topic-comment"
    | "comment-reply";
  strength?: number;
}

export interface NetworkData {
  nodes: (QueryNode | SubredditNode | TopicNode | CommentNode)[];
  links: NetworkLink[];
  centerNode: QueryNode;
}

export interface AnalysisData {
  id: string;
  category: string;
  query: string;
  timeframe: string;
  minPostScore: number;
  totalComments: number;
  totalDiscussions: number;
  scrapedAt: string;
  createdAt: string;
  discussions: Discussion[];
  subreddits: string[];
  networkData: NetworkData;
  entityAnalysis?: {
    query: string;
    timestamp: string;
    totalEntities: number;
    totalMentions: number;
    totalScore: number;
    entityBreakdown: {
      persons: number;
      organizations: number;
      locations: number;
    };
    entityChains: EntityChain[];
  };
  entities?: EntityChain[];
}

export interface AnalysisResult {
  success: boolean;
  cached: boolean;
  data: AnalysisData;
  jobId?: string;
  status?: string;
  message?: string;
}

export interface AnalysisJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message?: string;
  data?: AnalysisData;
}

export interface AnalysisRequest {
  category: string;
  query: string;
  timeframe?: string;
  minPostScore?: number;
  includeEntities?: boolean;
}

// Visualization states
export interface ViewState {
  mode: "overview" | "topic-expanded";
  selectedTopicId?: string;
  hoveredNodeId?: string;
  selectedNodeId?: string;
}

export interface TooltipData {
  type: "subreddit" | "topic" | "comment";
  data: any;
  x: number;
  y: number;
}
