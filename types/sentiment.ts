export interface SentimentScores {
  compound: number;
  pos: number;
  neu: number;
  neg: number;
}

export interface SentimentAnalysis {
  original: SentimentScores;
  processed?: SentimentScores;
  overall: SentimentScores;
  label: string;
}
