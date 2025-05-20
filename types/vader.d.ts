declare module "vader-sentiment" {
  export interface SentimentScores {
    compound: number;
    pos: number;
    neu: number;
    neg: number;
  }

  export class SentimentIntensityAnalyzer {
    static polarity_scores(text: string): SentimentScores;
  }
}
