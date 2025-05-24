import nlp from "compromise";
import vader from "vader-sentiment";
import type {
  Entity,
  EntityType,
  EntityChain,
  SubredditEntityAnalysis,
} from "./types/entities";
import type { SentimentAnalysis, SentimentScores } from "./types/sentiment";
import type { RedditComment, RedditData, Discussion } from "./types/reddit";

interface EntityMention {
  entity: Entity;
  sentiment: SentimentAnalysis;
  score: number; // Comment upvote score
  timestamp: string;
  postId: string;
}

export class NERService {
  private initialized: boolean = false;

  constructor() {
    // compromise.js works out of the box, no setup needed
  }

  /**
   * Initialize the NER service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("Initializing compromise.js NER service...");
      // compromise.js is ready to use immediately
      this.initialized = true;
      console.log("✅ Compromise.js NER service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize NER service:", error);
      throw error;
    }
  }

  /**
   * Extract entities using compromise.js built-in NER
   */
  async extractEntities(text: string): Promise<Entity[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const doc = nlp(text);
      const entities: Entity[] = [];

      // Extract people using compromise's built-in people recognition
      const people = doc.people().json();
      for (const person of people) {
        if (person.text && person.text.length > 2) {
          entities.push({
            text: person.text,
            normalizedText: this.normalizeEntityText(person.text),
            type: "PERSON",
            confidence: 0.8, // compromise is generally reliable for people
            startIndex: person.offset?.start || 0,
            endIndex:
              person.offset?.start + person.text.length || person.text.length,
          });
        }
      }

      // Extract places using compromise's built-in place recognition
      const places = doc.places().json();
      for (const place of places) {
        if (place.text && place.text.length > 2) {
          entities.push({
            text: place.text,
            normalizedText: this.normalizeEntityText(place.text),
            type: "LOCATION",
            confidence: 0.8,
            startIndex: place.offset?.start || 0,
            endIndex:
              place.offset?.start + place.text.length || place.text.length,
          });
        }
      }

      // Extract organizations using proper nouns and known patterns
      const organizations = this.extractOrganizations(doc);
      entities.push(...organizations);

      // Deduplicate entities
      const deduplicatedEntities = this.deduplicateEntities(entities);

      return deduplicatedEntities;
    } catch (error) {
      console.error("Error extracting entities:", error);
      return [];
    }
  }

  /**
   * Extract organizations from compromise doc
   */
  private extractOrganizations(doc: any): Entity[] {
    const entities: Entity[] = [];

    // Get organizations using compromise's organization detection
    const orgs = doc.organizations().json();
    for (const org of orgs) {
      if (org.text && org.text.length > 2) {
        entities.push({
          text: org.text,
          normalizedText: this.normalizeEntityText(org.text),
          type: "ORGANIZATION",
          confidence: 0.8,
          startIndex: org.offset?.start || 0,
          endIndex: org.offset?.start + org.text.length || org.text.length,
        });
      }
    }

    // Also look for common organization patterns in proper nouns
    const properNouns = doc.match("#ProperNoun+").json();
    for (const noun of properNouns) {
      const text = noun.text;
      if (!text || text.length < 3) continue;

      // Skip if already captured as person or place
      const isPersonOrPlace =
        doc
          .people()
          .json()
          .some((p: any) => p.text === text) ||
        doc
          .places()
          .json()
          .some((p: any) => p.text === text) ||
        orgs.some((o: any) => o.text === text);

      if (isPersonOrPlace) continue;

      // Check for organization patterns
      if (this.isLikelyOrganization(text)) {
        entities.push({
          text: text,
          normalizedText: this.normalizeEntityText(text),
          type: "ORGANIZATION",
          confidence: 0.6,
          startIndex: noun.offset?.start || 0,
          endIndex: noun.offset?.start + text.length || text.length,
        });
      }
    }

    return entities;
  }

  /**
   * Check if a text is likely an organization
   */
  private isLikelyOrganization(text: string): boolean {
    const orgPatterns = [
      /\b(Inc|LLC|Corp|Ltd|Company|Group|Systems|Technologies|Solutions|Services)\b/i,
      /\b(Microsoft|Google|Apple|Amazon|Meta|Tesla|OpenAI|Anthropic|DeepMind)\b/i,
      /\b(University|College|Institute|School|Department)\b/i,
      /\b(Agency|Commission|Bureau|Ministry|Department)\b/i,
    ];

    return orgPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Normalize entity text for comparison
   */
  private normalizeEntityText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Deduplicate entities based on normalized text and type
   */
  private deduplicateEntities(entities: Entity[]): Entity[] {
    const seen = new Set<string>();
    const deduplicated: Entity[] = [];

    for (const entity of entities) {
      const key = `${entity.type}:${entity.normalizedText}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(entity);
      }
    }

    return deduplicated;
  }

  /**
   * Analyze sentiment for entities in context
   */
  private analyzeEntitySentiment(
    entity: Entity,
    fullText: string
  ): SentimentAnalysis {
    // Extract context around the entity (±50 characters)
    const start = Math.max(0, entity.startIndex - 50);
    const end = Math.min(fullText.length, entity.endIndex + 50);
    const context = fullText.substring(start, end);

    const vaderResult =
      vader.SentimentIntensityAnalyzer.polarity_scores(context);

    return {
      positivity: vaderResult.pos,
      negativity: vaderResult.neg,
      neutrality: vaderResult.neu,
      compound: vaderResult.compound,
      overall: this.classifySentiment(vaderResult.compound),
    };
  }

  /**
   * Classify sentiment based on compound score
   */
  private classifySentiment(
    compound: number
  ): "positive" | "negative" | "neutral" {
    if (compound >= 0.05) return "positive";
    if (compound <= -0.05) return "negative";
    return "neutral";
  }

  /**
   * Process Reddit comments to extract entities with scores for weighting
   */
  async processCommentsForEntities(
    discussions: Discussion[]
  ): Promise<EntityMention[]> {
    const allMentions: EntityMention[] = [];

    for (const discussion of discussions) {
      // Generate missing fields for backward compatibility
      const discussionId =
        discussion.id || discussion.url.split("/").pop() || "unknown";
      const discussionTimestamp =
        discussion.timestamp || new Date().toISOString();

      // Process comments (posts usually don't have scores in our data)
      for (const comment of discussion.comments) {
        // Handle both text and body fields for backward compatibility
        const commentText = (comment as any).body || comment.text || "";
        const commentScore = comment.score || 0;
        const commentTimestamp =
          (comment as any).timestamp || new Date().toISOString();

        if (commentText.trim()) {
          const entities = await this.extractEntities(commentText);
          for (const entity of entities) {
            const sentiment = this.analyzeEntitySentiment(entity, commentText);
            allMentions.push({
              entity,
              sentiment,
              score: commentScore,
              timestamp: commentTimestamp,
              postId: discussionId,
            });
          }
        }
      }
    }

    return allMentions;
  }

  /**
   * Build entity chains with score-weighted sentiment averaging
   */
  buildEntityChains(mentions: EntityMention[]): EntityChain[] {
    const chainMap = new Map<string, EntityChain>();

    for (const mention of mentions) {
      const key = `${mention.entity.type}:${mention.entity.normalizedText}`;

      if (!chainMap.has(key)) {
        chainMap.set(key, {
          entity: mention.entity,
          totalMentions: 0,
          uniquePosts: 0,
          totalScore: 0,
          sentimentTrend: [],
          averageSentiment: {
            positivity: 0,
            negativity: 0,
            neutrality: 0,
            compound: 0,
            overall: "neutral",
          },
        });
      }

      const chain = chainMap.get(key)!;
      chain.totalMentions++;
      chain.totalScore += mention.score;
      chain.sentimentTrend.push({
        timestamp: mention.timestamp,
        sentiment: mention.sentiment,
        score: mention.score,
      });
    }

    // Calculate unique posts count and score-weighted sentiment averages
    for (const chain of chainMap.values()) {
      // Count unique posts
      const uniquePostIds = new Set(
        chain.sentimentTrend.map((trend) => trend.score.toString())
      );
      chain.uniquePosts = uniquePostIds.size;

      // Calculate score-weighted sentiment averages
      const totalScoreWeight = chain.sentimentTrend.reduce(
        (sum, trend) => sum + trend.score,
        0
      );

      if (totalScoreWeight > 0) {
        const weightedSentiment = chain.sentimentTrend.reduce(
          (acc, trend) => {
            const weight = trend.score / totalScoreWeight;
            return {
              positivity: acc.positivity + trend.sentiment.positivity * weight,
              negativity: acc.negativity + trend.sentiment.negativity * weight,
              neutrality: acc.neutrality + trend.sentiment.neutrality * weight,
              compound: acc.compound + trend.sentiment.compound * weight,
            };
          },
          { positivity: 0, negativity: 0, neutrality: 0, compound: 0 }
        );

        chain.averageSentiment = {
          ...weightedSentiment,
          overall: this.classifySentiment(weightedSentiment.compound),
        };
      }
    }

    return Array.from(chainMap.values()).sort(
      (a, b) => b.totalScore - a.totalScore // Sort by total score instead of just mentions
    );
  }

  /**
   * Analyze entities for a specific subreddit
   */
  async analyzeEntities(
    redditData: RedditData
  ): Promise<SubredditEntityAnalysis> {
    // Handle both old and new data structures for backward compatibility
    const subreddit = redditData.subreddit || (redditData as any).subredditName;
    const query = (redditData as any).metadata?.query || redditData.query;

    console.log(`Starting entity analysis for r/${subreddit}...`);

    const mentions = await this.processCommentsForEntities(
      redditData.discussions
    );
    const chains = this.buildEntityChains(mentions);

    const totalScore = mentions.reduce(
      (sum, mention) => sum + mention.score,
      0
    );

    const analysis: SubredditEntityAnalysis = {
      subreddit: subreddit,
      query: query,
      timestamp: new Date().toISOString(),
      totalEntities: chains.length,
      totalMentions: mentions.length,
      totalScore: totalScore,
      entityBreakdown: {
        persons: chains.filter((c) => c.entity.type === "PERSON").length,
        organizations: chains.filter((c) => c.entity.type === "ORGANIZATION")
          .length,
        locations: chains.filter((c) => c.entity.type === "LOCATION").length,
      },
      entityChains: chains,
    };

    console.log(
      `Entity analysis completed. Found ${chains.length} unique entities.`
    );
    console.log(`- Persons: ${analysis.entityBreakdown.persons}`);
    console.log(`- Organizations: ${analysis.entityBreakdown.organizations}`);
    console.log(`- Locations: ${analysis.entityBreakdown.locations}`);
    console.log(`- Total comment score weight: ${totalScore}`);

    return analysis;
  }
}
