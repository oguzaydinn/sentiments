import VADER from "vader-sentiment";
import type { RedditData, ProcessedComment } from "./types/reddit";
import type { SentimentScores, SentimentAnalysis } from "./types/sentiment";

function getSentimentLabel(compound: number): string {
  if (compound >= 0.05) return "positive";
  if (compound <= -0.05) return "negative";
  return "neutral";
}

function calculateOverallSentiment(
  sentiments: SentimentScores[]
): SentimentScores {
  return sentiments.reduce(
    (acc, curr) => ({
      compound: acc.compound + curr.compound,
      pos: acc.pos + curr.pos,
      neu: acc.neu + curr.neu,
      neg: acc.neg + curr.neg,
    }),
    { compound: 0, pos: 0, neu: 0, neg: 0 }
  );
}

function normalizeSentiment(
  sentiment: SentimentScores,
  count: number
): SentimentScores {
  return {
    compound: sentiment.compound / count,
    pos: sentiment.pos / count,
    neu: sentiment.neu / count,
    neg: sentiment.neg / count,
  };
}

export function analyzeSentiment(text: string): SentimentScores {
  const result = VADER.SentimentIntensityAnalyzer.polarity_scores(text);
  return {
    compound: result.compound,
    pos: result.pos,
    neu: result.neu,
    neg: result.neg,
  };
}

export function analyzeCommentSentiment(
  comment: { text: string },
  processedComment?: ProcessedComment
): SentimentAnalysis {
  // Analyze original comment
  const originalSentiment = analyzeSentiment(comment.text);

  // Analyze processed comment if available
  const processedSentiment = processedComment?.processed
    ? analyzeSentiment(processedComment.processed)
    : undefined;

  // Calculate overall sentiment
  const sentiments = [originalSentiment];
  if (processedSentiment) {
    sentiments.push(processedSentiment);
  }

  const overallSentiment = normalizeSentiment(
    calculateOverallSentiment(sentiments),
    sentiments.length
  );

  return {
    original: originalSentiment,
    processed: processedSentiment,
    overall: overallSentiment,
    label: getSentimentLabel(overallSentiment.compound),
  };
}

export function analyzeRedditData(data: RedditData): RedditData {
  const processedDiscussions = data.discussions.map((discussion) => {
    const processedComments = discussion.comments.map((comment, index) => {
      const processedComment = discussion.processedComments?.[index];
      const sentiment = analyzeCommentSentiment(comment, processedComment);

      return {
        ...comment,
        sentiment,
      };
    });

    // Calculate discussion-level sentiment
    const discussionSentiments = processedComments.map(
      (c) => c.sentiment!.overall
    );
    const overallDiscussionSentiment = normalizeSentiment(
      calculateOverallSentiment(discussionSentiments),
      discussionSentiments.length
    );

    return {
      ...discussion,
      comments: processedComments,
      sentiment: {
        original: overallDiscussionSentiment,
        overall: overallDiscussionSentiment,
        label: getSentimentLabel(overallDiscussionSentiment.compound),
      },
    };
  });

  // Calculate subreddit-level sentiment
  const subredditSentiments = processedDiscussions.map(
    (d) => d.sentiment!.overall
  );
  const overallSubredditSentiment = normalizeSentiment(
    calculateOverallSentiment(subredditSentiments),
    subredditSentiments.length
  );

  return {
    ...data,
    discussions: processedDiscussions,
    sentiment: {
      original: overallSubredditSentiment,
      overall: overallSubredditSentiment,
      label: getSentimentLabel(overallSubredditSentiment.compound),
    },
  };
}
