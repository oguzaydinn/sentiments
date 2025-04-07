/**
 * Text Preprocessing Module for Sentiment Analysis
 *
 * This module handles:
 * - Tokenization: Breaking text into words/tokens
 * - Stopword removal: Filtering out common words that don't carry sentiment
 * - Slang detection: Identifying and normalizing internet slang
 * - Sarcasm detection: Basic detection of sarcastic patterns
 */

import type { RedditData } from "./types";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "at",
  "from",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "of",
  "in",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "should",
  "now",
]);

const SLANG_DICTIONARY: Record<string, string> = {
  afaik: "as far as I know",
  afk: "away from keyboard",
  btw: "by the way",
  fwiw: "for what it's worth",
  iirc: "if I recall correctly",
  imo: "in my opinion",
  imho: "in my humble opinion",
  lol: "laugh out loud",
  rofl: "rolling on the floor laughing",
  lmao: "laughing my ass off",
  smh: "shaking my head",
  tbh: "to be honest",
  tfw: "that feeling when",
  til: "today I learned",
  yolo: "you only live once",
  idk: "I don't know",
  ngl: "not gonna lie",
  ftw: "for the win",
  fomo: "fear of missing out",
  irl: "in real life",
  tldr: "too long didn't read",
  brb: "be right back",
  gtg: "got to go",
  thx: "thanks",
  ty: "thank you",
  np: "no problem",
  rn: "right now",
  omg: "oh my god",
  wtf: "what the fuck",
  af: "as fuck",
  ffs: "for fuck's sake",
  sus: "suspicious",
  based: "agreeable",
  cringe: "embarrassing",
  yeet: "throw forcefully",
  poggers: "excellent",
  pog: "play of the game",
  goat: "greatest of all time",
  cap: "lie",
  "no cap": "no lie",
  lit: "exciting",
  fire: "excellent",
  salty: "upset",
  toxic: "harmful",
  simp: "overly devoted",
  stan: "obsessive fan",
  woke: "socially aware",
  ghosted: "ignored",
  triggered: "upset",
  boomer: "older person",
  karen: "entitled person",
  chad: "alpha male",
  incel: "involuntary celibate",
  normie: "mainstream person",
  noob: "newbie",
  troll: "provocateur",
  meme: "internet joke",
  copypasta: "copied text",
  doomscrolling: "consuming negative news",
  facepalm: "disappointment gesture",
  feels: "emotions",
  flex: "show off",
  lowkey: "subtly",
  highkey: "obviously",
  mood: "relatable",
  ratio: "negative response",
  "rent free": "obsessively thinking about",
  vibe: "atmosphere",
  vibing: "enjoying",
  yikes: "expression of dismay",
  oof: "expression of discomfort",
};

const SARCASM_INDICATORS = [
  /\b(yeah right|sure thing|totally)\b/i,
  /\b(of course|obviously)\s+.*\s+(not|never)\b/i,
  /\b(right|sure)\s+\w+\s+\w+\s+(not|never)\b/i,
  /\b(oh great|fantastic|wonderful|brilliant)\s+.*\s+(fail|broke|wrong|bad)\b/i,
  /\b(thanks|thank you)\s+.*\s+(nothing|useless|broken)\b/i,
  /\b(just|exactly)\s+what\s+(I|we)\s+(need|want|love)\b.*\s+(not|never)\b/i,
  /\"/g,
  /\*.*\*/g,
  /\b[A-Z][a-z]*([A-Z][a-z]*)+\b/g,
  /\b([a-z]+[A-Z])+[a-z]*\b/g,
  /\b(lol|lmao|rofl|haha)\s+.*\s+(terrible|awful|worst|bad|stupid)\b/i,
];

export function tokenize(text: string): string[] {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");

  return withoutUrls
    .replace(/[^\w\s']|_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter((token) => token.length > 0);
}

export function removeStopwords(tokens: string[]): string[] {
  return tokens.filter((token) => !STOPWORDS.has(token));
}

export function normalizeSlang(tokens: string[]): string[] {
  return tokens.map((token) => {
    const normalized = SLANG_DICTIONARY[token.toLowerCase()];
    return normalized ? normalized : token;
  });
}

export function detectSarcasm(text: string): {
  isSarcastic: boolean;
  confidence: number;
} {
  let sarcasmScore = 0;
  const maxScore = SARCASM_INDICATORS.length;

  SARCASM_INDICATORS.forEach((pattern) => {
    if (pattern.test(text)) {
      sarcasmScore++;
    }
  });

  if (/(!{2,}|\?{2,})/g.test(text)) {
    sarcasmScore += 0.5;
  }

  if (/\.{3,}/g.test(text)) {
    sarcasmScore += 0.5;
  }

  if (/\b(yeah|sure|right)[\s,]+(yeah|sure|right)\b/i.test(text)) {
    sarcasmScore += 1;
  }

  const confidence = (sarcasmScore / maxScore) * 100;

  return {
    isSarcastic: confidence > 30,
    confidence,
  };
}

export function preprocessText(text: string): {
  original: string;
  processed: string;
  tokens: string[];
  tokensWithoutStopwords: string[];
  normalizedTokens: string[];
  sarcasm: { isSarcastic: boolean; confidence: number };
} {
  if (!text || text.trim() === "") {
    return {
      original: text || "",
      processed: "",
      tokens: [],
      tokensWithoutStopwords: [],
      normalizedTokens: [],
      sarcasm: { isSarcastic: false, confidence: 0 },
    };
  }

  const tokens = tokenize(text);
  const tokensWithoutStopwords = removeStopwords(tokens);
  const normalizedTokens = normalizeSlang(tokensWithoutStopwords);
  const sarcasm = detectSarcasm(text);
  const processed = normalizedTokens.join(" ");

  return {
    original: text,
    processed,
    tokens,
    tokensWithoutStopwords,
    normalizedTokens,
    sarcasm,
  };
}

export function preprocessRedditData(data: RedditData): RedditData {
  const processedDiscussions = data.discussions.map((discussion) => {
    const processedComments = discussion.comments.map((comment) => {
      const processed = preprocessText(comment.text);
      return {
        ...processed,
        score: comment.score,
      };
    });

    return {
      title: discussion.title,
      url: discussion.url,
      comments: discussion.comments,
      processedComments,
    };
  });

  return {
    ...data,
    processedDiscussions,
  };
}

export default {
  tokenize,
  removeStopwords,
  normalizeSlang,
  detectSarcasm,
  preprocessText,
  preprocessRedditData,
};
