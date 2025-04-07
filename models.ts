import mongoose, { Schema, Document } from "mongoose";
import type { RedditData } from "./types";

export interface RedditDataDocument extends RedditData, Document {}

const commentSchema = new Schema({
  text: String,
  score: Number,
});

const processedCommentSchema = new Schema({
  original: String,
  processed: String,
  tokens: [String],
  tokensWithoutStopwords: [String],
  normalizedTokens: [String],
  sarcasm: {
    isSarcastic: Boolean,
    confidence: Number,
  },
  score: Number,
});

const discussionSchema = new Schema({
  title: String,
  url: String,
  comments: [commentSchema],
});

const processedDiscussionSchema = new Schema({
  title: String,
  url: String,
  comments: [commentSchema],
  processedComments: [processedCommentSchema],
});

const redditDataSchema = new Schema({
  subredditName: String,
  query: String,
  category: String,
  date: String,
  discussions: [discussionSchema],
  processedDiscussions: [processedDiscussionSchema],
});

export const RedditModel = mongoose.model<RedditDataDocument>(
  "RedditData",
  redditDataSchema
);
