import type { RedditData, RedditComment } from "./types/reddit";
import type { SentimentScores, SentimentAnalysis } from "./types/sentiment";
import VADER from "vader-sentiment";

function getSentimentLabel(compound: number): string {
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

  let totalScore = 0;
  const weightedSum = comments.reduce(
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
  // Analyze sentiment for each comment
  data.discussions.forEach((discussion) => {
    discussion.comments.forEach((comment) => {
      comment.sentiment = analyzeCommentSentiment(comment);

      // Process replies recursively
      if (comment.replies) {
        comment.replies.forEach((reply) => {
          reply.sentiment = analyzeCommentSentiment(reply);
        });
      }
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
