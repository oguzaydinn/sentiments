import type { SentimentAnalysis } from "./sentiment";

// Define the sentiment structure to match the current app structure
interface EntitySentimentAnalysis {
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
}

export interface Entity {
  text: string; // The original text mention
  normalizedText: string; // Cleaned/normalized version
  type: EntityType; // PERSON, ORGANIZATION, LOCATION
  startIndex: number; // Position in original text
  endIndex: number; // Position in original text
  confidence: number; // NER confidence score (0-1)
}

export type EntityType = "PERSON" | "ORGANIZATION" | "LOCATION";

export interface EntityChain {
  entity: Entity;
  totalMentions: number;
  uniquePosts: number; // Changed from Set to number for JSON serialization
  averageSentiment: EntitySentimentAnalysis; // Weighted by comment scores
  totalScore: number; // Sum of all comment scores mentioning this entity
  sentimentTrend: Array<{
    timestamp: string;
    sentiment: EntitySentimentAnalysis;
    score: number; // Comment score for this mention
  }>;
}

export interface SubredditEntityAnalysis {
  subreddit: string;
  query: string;
  timestamp: string;
  totalEntities: number;
  totalMentions: number;
  totalScore: number; // Sum of all comment scores analyzed
  entityBreakdown: {
    persons: number;
    organizations: number;
    locations: number;
  };
  entityChains: EntityChain[]; // Only chains, no individual mentions
}
