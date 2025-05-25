export interface SentimentScores {
  compound: number;
  pos: number;
  neu: number;
  neg: number;
}

export interface SentimentAnalysis {
  positivity: number; // VADER pos score
  negativity: number; // VADER neg score
  neutrality: number; // VADER neu score
  compound: number; // VADER compound score
  overall: "positive" | "negative" | "neutral"; // Classification
}
