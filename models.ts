import mongoose, { Schema, Document } from "mongoose";
import type { RedditData } from "./types";

export interface RedditDataDocument extends RedditData, Document {}

const commentSchema = new Schema({
  text: String,
  score: Number,
});

const discussionSchema = new Schema({
  title: String,
  url: String,
  comments: [commentSchema],
});

const redditDataSchema = new Schema({
  subredditName: String,
  query: String,
  category: String,
  discussions: [discussionSchema],
});

export const RedditModel = mongoose.model<RedditDataDocument>(
  "RedditData",
  redditDataSchema
);
