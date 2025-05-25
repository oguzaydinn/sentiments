import type { RedditData, RedditComment } from "./types/reddit";
import type { SentimentScores, SentimentAnalysis } from "./types/sentiment";
import VADER from "vader-sentiment";

function getSentimentLabel(
  compound: number
): "positive" | "negative" | "neutral" {
  if (compound >= 0.05) return "positive";
  if (compound <= -0.05) return "negative";
  return "neutral";
}

function analyzeCommentSentiment(comment: RedditComment): SentimentAnalysis {
  const sentiment = VADER.SentimentIntensityAnalyzer.polarity_scores(
    comment.text
  );

  return {
    original: sentiment,
    overall: sentiment,
    label: getSentimentLabel(sentiment.compound),
  };
}

function calculateWeightedAverageSentiment(
  comments: RedditComment[]
): SentimentScores {
  if (comments.length === 0) {
    return { compound: 0, pos: 0, neu: 0, neg: 0 };
  }

  // Filter out comments with zero or negative scores for weighting
  const validComments = comments.filter((comment) => comment.score > 0);

  if (validComments.length === 0) {
    // If no comments have positive scores, fall back to simple average
    const simpleAvg = comments.reduce(
      (acc, comment) => {
        const sentiment = VADER.SentimentIntensityAnalyzer.polarity_scores(
          comment.text
        );
        return {
          compound: acc.compound + sentiment.compound,
          pos: acc.pos + sentiment.pos,
          neu: acc.neu + sentiment.neu,
          neg: acc.neg + sentiment.neg,
        };
      },
      { compound: 0, pos: 0, neu: 0, neg: 0 }
    );

    return {
      compound: simpleAvg.compound / comments.length,
      pos: simpleAvg.pos / comments.length,
      neu: simpleAvg.neu / comments.length,
      neg: simpleAvg.neg / comments.length,
    };
  }

  let totalScore = 0;
  const weightedSum = validComments.reduce(
    (acc, comment) => {
      const sentiment = VADER.SentimentIntensityAnalyzer.polarity_scores(
        comment.text
      );
      totalScore += comment.score;
      return {
        compound: acc.compound + sentiment.compound * comment.score,
        pos: acc.pos + sentiment.pos * comment.score,
        neu: acc.neu + sentiment.neu * comment.score,
        neg: acc.neg + sentiment.neg * comment.score,
      };
    },
    { compound: 0, pos: 0, neu: 0, neg: 0 }
  );

  return {
    compound: weightedSum.compound / totalScore,
    pos: weightedSum.pos / totalScore,
    neu: weightedSum.neu / totalScore,
    neg: weightedSum.neg / totalScore,
  };
}

export function analyzeRedditData(data: RedditData): RedditData {
  // Recursive function to analyze sentiment for comments and all their replies
  const analyzeCommentSentimentRecursive = (comment: RedditComment) => {
    comment.sentiment = analyzeCommentSentiment(comment);

    // Process replies recursively
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach((reply) => {
        analyzeCommentSentimentRecursive(reply);
      });
    }
  };

  // Analyze sentiment for each comment and all its replies
  data.discussions.forEach((discussion) => {
    discussion.comments.forEach((comment) => {
      analyzeCommentSentimentRecursive(comment);
    });

    // Calculate discussion-level sentiment using weighted average
    const discussionSentiment = calculateWeightedAverageSentiment(
      discussion.comments
    );
    discussion.sentiment = {
      original: discussionSentiment,
      overall: discussionSentiment,
      label: getSentimentLabel(discussionSentiment.compound),
    };
  });

  // Calculate subreddit-level sentiment using weighted average
  const allComments = data.discussions.flatMap((d) => d.comments);
  const subredditSentiment = calculateWeightedAverageSentiment(allComments);
  data.sentiment = {
    original: subredditSentiment,
    overall: subredditSentiment,
    label: getSentimentLabel(subredditSentiment.compound),
  };

  return data;
}
