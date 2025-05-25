export interface SentimentScores {
  compound: number;
  pos: number;
  neu: number;
  neg: number;
}

export interface SentimentAnalysis {
  original: SentimentScores; // VADER scores
  overall: SentimentScores; // Same as original for now
  label: "positive" | "negative" | "neutral"; // Classification
}
