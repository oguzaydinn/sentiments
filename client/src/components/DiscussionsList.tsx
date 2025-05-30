import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  Clock,
  User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type {
  Discussion,
  RedditComment,
  SentimentAnalysis,
} from "../types/analysis";

interface DiscussionsListProps {
  discussions: Discussion[];
}

interface CommentItemProps {
  comment: RedditComment;
  depth?: number;
}

function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasReplies = comment.replies && comment.replies.length > 0;

  const getSentimentColor = (sentiment?: SentimentAnalysis) => {
    if (!sentiment) return "text-gray-600 bg-gray-50 border-gray-200";
    switch (sentiment.label) {
      case "positive":
        return "text-green-600 bg-green-50 border-green-200";
      case "negative":
        return "text-red-600 bg-red-50 border-red-200";
      case "neutral":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getSentimentIcon = (sentiment?: SentimentAnalysis) => {
    if (!sentiment) return "😐";
    switch (sentiment.label) {
      case "positive":
        return "😊";
      case "negative":
        return "😞";
      case "neutral":
        return "😐";
      default:
        return "😐";
    }
  };

  return (
    <div
      className={`${depth > 0 ? "ml-4 border-l-2 border-gray-200 pl-4" : ""}`}
    >
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
        {/* Comment Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            {comment.author && (
              <div className="flex items-center space-x-1">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 font-medium">
                  {comment.author}
                </span>
              </div>
            )}
            {comment.timestamp && (
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {format(parseISO(comment.timestamp), "MMM d, yyyy")}
                </span>
              </div>
            )}
            <div className="flex items-center space-x-1">
              <ThumbsUp className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {comment.score} upvotes
              </span>
            </div>
          </div>

          {comment.sentiment && (
            <div
              className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor(
                comment.sentiment
              )}`}
            >
              <span className="mr-1">
                {getSentimentIcon(comment.sentiment)}
              </span>
              {comment.sentiment.label} (
              {comment.sentiment.overall.compound.toFixed(2)})
            </div>
          )}
        </div>

        {/* Comment Text */}
        <div className="text-gray-800 text-sm mb-3 leading-relaxed">
          {comment.text.length > 300 ? (
            <>
              {comment.text.slice(0, 300)}...
              <button className="text-blue-600 hover:text-blue-800 ml-1">
                read more
              </button>
            </>
          ) : (
            comment.text
          )}
        </div>

        {/* Entities */}
        {comment.entities && comment.entities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {comment.entities.slice(0, 5).map((entity, index) => (
              <span
                key={index}
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  entity.type === "PERSON"
                    ? "bg-blue-100 text-blue-700"
                    : entity.type === "ORGANIZATION"
                    ? "bg-green-100 text-green-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {entity.text}
              </span>
            ))}
            {comment.entities.length > 5 && (
              <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                +{comment.entities.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Replies Toggle */}
        {hasReplies && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>{comment.replies.length} replies</span>
          </button>
        )}
      </div>

      {/* Replies */}
      {hasReplies && isExpanded && (
        <div className="space-y-2">
          {comment.replies.map((reply, replyIndex) => (
            <CommentItem
              key={reply.id || `reply-${replyIndex}`}
              comment={reply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiscussionsList({ discussions }: DiscussionsListProps) {
  const [expandedDiscussion, setExpandedDiscussion] = useState<string | null>(
    null
  );
  const [sortBy, setSortBy] = useState<"timestamp" | "score" | "comments">(
    "timestamp" // Default to sorting by timestamp since it's now available
  );

  const sortedDiscussions = [...discussions].sort((a, b) => {
    switch (sortBy) {
      case "timestamp":
        // Parse timestamps and sort newest first
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      case "comments":
        return b.comments.length - a.comments.length;
      case "score":
        return b.score - a.score;
      default:
        return 0;
    }
  });

  const getSentimentColor = (sentiment?: SentimentAnalysis) => {
    if (!sentiment) return "text-gray-600 bg-gray-50 border-gray-200";
    switch (sentiment.label) {
      case "positive":
        return "text-green-600 bg-green-50 border-green-200";
      case "negative":
        return "text-red-600 bg-red-50 border-red-200";
      case "neutral":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Discussions ({discussions.length})
        </h3>

        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="timestamp">Most Recent</option>
            <option value="comments">Most Comments</option>
          </select>
        </div>
      </div>

      {/* Discussions */}
      <div className="space-y-4">
        {sortedDiscussions.map((discussion, index) => {
          // Use URL or index as unique key since id might not exist
          const discussionKey =
            discussion.id || discussion.url || `discussion-${index}`;
          const isExpanded = expandedDiscussion === discussionKey;
          const commentCount = discussion.comments.length;

          return (
            <div key={discussionKey} className="card">
              {/* Discussion Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {discussion.title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">
                        r/{discussion.subreddit}
                      </span>
                    </div>
                    {discussion.timestamp && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {format(
                            parseISO(discussion.timestamp),
                            "MMM d, yyyy"
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{commentCount} comments</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <ThumbsUp className="h-4 w-4" />
                      <span>{discussion.score} score</span>
                    </div>
                    <a
                      href={discussion.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>View on Reddit</span>
                    </a>
                  </div>
                </div>

                {discussion.sentiment && (
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(
                      discussion.sentiment
                    )}`}
                  >
                    {discussion.sentiment.label} (
                    {discussion.sentiment.overall.compound.toFixed(2)})
                  </div>
                )}
              </div>

              {/* Entities */}
              {discussion.entities && discussion.entities.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {discussion.entities.slice(0, 8).map((entity, index) => (
                    <span
                      key={index}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        entity.type === "PERSON"
                          ? "bg-blue-100 text-blue-700"
                          : entity.type === "ORGANIZATION"
                          ? "bg-green-100 text-green-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {entity.text}
                    </span>
                  ))}
                  {discussion.entities.length > 8 && (
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                      +{discussion.entities.length - 8} more
                    </span>
                  )}
                </div>
              )}

              {/* Comments Toggle */}
              {commentCount > 0 && (
                <button
                  onClick={() =>
                    setExpandedDiscussion(isExpanded ? null : discussionKey)
                  }
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <span>
                    {isExpanded ? "Hide" : "Show"} {commentCount} comments
                  </span>
                </button>
              )}

              {/* Comments */}
              {isExpanded && commentCount > 0 && (
                <div className="mt-6 space-y-3">
                  {discussion.comments.map((comment, commentIndex) => (
                    <CommentItem
                      key={comment.id || `comment-${commentIndex}`}
                      comment={comment}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {discussions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p>No discussions found for this analysis.</p>
        </div>
      )}
    </div>
  );
}
