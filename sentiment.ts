import type { RedditData, ProcessedComment } from "./types/reddit";
import type { SentimentScores, SentimentAnalysis } from "./types/sentiment";
import VADER from "vader-sentiment";

function getSentimentLabel(compound: number): string {
  if (compound >= 0.05) return "positive";
  if (compound <= -0.05) return "negative";
  return "neutral";
}

function analyzeCommentSentiment(comment: ProcessedComment): SentimentAnalysis {
  const originalSentiment = VADER.SentimentIntensityAnalyzer.polarity_scores(
    comment.original
  );

  return {
    original: originalSentiment,
    overall: originalSentiment,
    label: getSentimentLabel(originalSentiment.compound),
  };
}

function calculateAverageSentiment(
  sentiments: SentimentScores[]
): SentimentScores {
  if (sentiments.length === 0) {
    return { compound: 0, pos: 0, neu: 0, neg: 0 };
  }

  const sum = sentiments.reduce(
    (acc, curr) => ({
      compound: acc.compound + curr.compound,
      pos: acc.pos + curr.pos,
      neu: acc.neu + curr.neu,
      neg: acc.neg + curr.neg,
    }),
    { compound: 0, pos: 0, neu: 0, neg: 0 }
  );

  return {
    compound: sum.compound / sentiments.length,
    pos: sum.pos / sentiments.length,
    neu: sum.neu / sentiments.length,
    neg: sum.neg / sentiments.length,
  };
}

export function analyzeRedditData(data: RedditData): RedditData {
  // Analyze sentiment for each comment
  data.discussions.forEach((discussion) => {
    discussion.comments.forEach((comment) => {
      // Check if comment has all required ProcessedComment properties
      if (
        "original" in comment &&
        "processed" in comment &&
        "tokens" in comment &&
        "tokensWithoutStopwords" in comment &&
        "normalizedTokens" in comment &&
        "sarcasm" in comment
      ) {
        comment.sentiment = analyzeCommentSentiment(
          comment as ProcessedComment
        );
      }
    });

    // Calculate discussion-level sentiment
    const commentSentiments = discussion.comments
      .filter((c) => c.sentiment?.original)
      .map((c) => c.sentiment!.original);
    const discussionSentiment = calculateAverageSentiment(commentSentiments);
    discussion.sentiment = {
      original: discussionSentiment,
      overall: discussionSentiment,
      label: getSentimentLabel(discussionSentiment.compound),
    };
  });

  // Calculate subreddit-level sentiment
  const allCommentSentiments = data.discussions.flatMap((d) =>
    d.comments
      .filter((c) => c.sentiment?.original)
      .map((c) => c.sentiment!.original)
  );
  const subredditSentiment = calculateAverageSentiment(allCommentSentiments);
  data.sentiment = {
    original: subredditSentiment,
    overall: subredditSentiment,
    label: getSentimentLabel(subredditSentiment.compound),
  };

  return data;
}
