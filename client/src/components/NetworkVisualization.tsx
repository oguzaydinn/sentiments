import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { MessageSquare, Users, ThumbsUp, Eye } from "lucide-react";
import type {
  AnalysisResult,
  NetworkData,
  QueryNode,
  SubredditNode,
  TopicNode,
  CommentNode,
  ViewState,
  TooltipData,
  Discussion,
  RedditComment,
} from "../types/analysis";

interface NetworkVisualizationProps {
  analysis: AnalysisResult;
}

export default function NetworkVisualization({
  analysis,
}: NetworkVisualizationProps) {
  console.log("🎨 NetworkVisualization received analysis:", analysis);
  console.log("📊 Analysis data:", analysis.data);
  console.log("💬 Discussions:", analysis.data.discussions);
  console.log("📈 Total comments:", analysis.data.totalComments);
  console.log("📋 Total discussions:", analysis.data.totalDiscussions);

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewState, setViewState] = useState<ViewState>({ mode: "overview" });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);

  // Transform analysis data into network structure
  const buildNetworkData = useCallback((data: any): NetworkData => {
    const nodes: (QueryNode | SubredditNode | TopicNode | CommentNode)[] = [];
    const links: any[] = [];

    // Create center query node
    const queryNode: QueryNode = {
      id: "query",
      label: data.query,
      type: "query",
    };
    nodes.push(queryNode);

    // Group discussions by subreddit
    const subredditGroups = data.discussions.reduce(
      (acc: any, discussion: Discussion) => {
        const subreddit = discussion.subreddit || "unknown";
        if (!acc[subreddit]) {
          acc[subreddit] = [];
        }
        acc[subreddit].push(discussion);
        return acc;
      },
      {}
    );

    // Create subreddit nodes
    Object.entries(subredditGroups).forEach(
      ([subredditName, discussions]: [string, any]) => {
        const totalComments = discussions.reduce(
          (sum: number, d: Discussion) => sum + d.commentCount,
          0
        );

        // Calculate top entities for this subreddit using global entity analysis
        let topEntities: any[] = [];
        if (data.entityAnalysis?.entityChains) {
          // Since we don't have per-subreddit entity mapping in the current backend,
          // we'll extract entities from the comments of discussions in this specific subreddit
          const subredditDiscussions = discussions; // These are already filtered for this subreddit
          const subredditEntityMap = new Map();

          // Extract entities mentioned in this subreddit's discussions
          // For now, we'll use a simplified approach by checking if entity names appear in the discussion titles/comments
          data.entityAnalysis.entityChains.forEach((chain: any) => {
            let mentionsInSubreddit = 0;
            let scoreInSubreddit = 0;

            // Check if this entity is mentioned in any of this subreddit's discussions
            subredditDiscussions.forEach((discussion: Discussion) => {
              const discussionText = (
                discussion.title +
                " " +
                discussion.comments.map((c) => c.text).join(" ")
              ).toLowerCase();

              if (discussionText.includes(chain.entity.text.toLowerCase())) {
                mentionsInSubreddit++;
                scoreInSubreddit += discussion.comments.reduce(
                  (sum, c) => sum + c.score,
                  0
                );
              }
            });

            if (mentionsInSubreddit > 0) {
              subredditEntityMap.set(chain.entity.text, {
                text: chain.entity.text,
                type: chain.entity.type,
                mentions: mentionsInSubreddit,
                totalScore: scoreInSubreddit,
                sentiment: chain.averageSentiment?.original?.compound || 0,
              });
            }
          });

          topEntities = Array.from(subredditEntityMap.values())
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5);
        }

        const subredditNode: SubredditNode = {
          id: `subreddit-${subredditName}`,
          label: subredditName,
          type: "subreddit",
          discussionCount: discussions.length,
          totalComments,
          averageSentiment: 0, // Not used for subreddits
          weightedSentiment: 0, // Not used for subreddits
          topEntities,
        };
        nodes.push(subredditNode);

        // Link query to subreddit
        links.push({
          source: "query",
          target: subredditNode.id,
          type: "query-subreddit",
        });

        // Create topic nodes for each discussion
        discussions.forEach((discussion: Discussion, index: number) => {
          const commentSentiments = discussion.comments
            .filter((c) => c.sentiment)
            .map((c) => ({
              sentiment: c.sentiment!.original.compound,
              score: c.score,
            }));

          const weightedSentiment =
            commentSentiments.length > 0
              ? commentSentiments.reduce(
                  (sum, c) => sum + c.sentiment * c.score,
                  0
                ) / commentSentiments.reduce((sum, c) => sum + c.score, 0)
              : discussion.weightedSentiment || 0;

          // Calculate top comments affecting sentiment
          const topComments = discussion.comments
            .filter((c) => c.sentiment)
            .map((c) => ({
              comment: c,
              sentimentImpact:
                Math.abs(c.sentiment!.original.compound) * c.score,
            }))
            .sort((a, b) => b.sentimentImpact - a.sentimentImpact)
            .slice(0, 5);

          // Use a simpler, more reliable ID system based on the discussion's position in the full array
          const globalIndex = analysis.data.discussions.findIndex(
            (d) => d === discussion
          );
          const topicId = `topic-${globalIndex}`;

          console.log("🏷️ Creating topic node:", {
            subredditName,
            localIndex: index,
            globalIndex,
            title: discussion.title,
            topicId,
            discussionSubreddit: (discussion as any).subreddit,
          });

          const topicNode: TopicNode = {
            id: topicId,
            label: discussion.title,
            type: "topic",
            subreddit: subredditName,
            discussion,
            commentCount: discussion.commentCount,
            averageSentiment: discussion.sentiment?.original.compound || 0,
            weightedSentiment,
            topComments,
          };
          nodes.push(topicNode);

          // Link subreddit to topic
          links.push({
            source: subredditNode.id,
            target: topicNode.id,
            type: "subreddit-topic",
          });
        });
      }
    );

    return {
      nodes,
      links,
      centerNode: queryNode,
    };
  }, []);

  // Build comment tree for expanded view
  const buildCommentTree = useCallback(
    (discussion: Discussion): NetworkData => {
      const nodes: (QueryNode | CommentNode)[] = [];
      const links: any[] = [];

      // Create central topic node
      const topicNode: QueryNode = {
        id: "topic-center",
        label: discussion.title,
        type: "query",
      };
      nodes.push(topicNode);

      // Store the discussion data on the topic node for tooltip access
      (topicNode as any).discussion = discussion;
      (topicNode as any).commentCount = discussion.commentCount;
      (topicNode as any).weightedSentiment = discussion.weightedSentiment;
      (topicNode as any).subreddit = (discussion as any).subreddit;

      // Calculate top comments for the tooltip
      const topComments = discussion.comments
        .filter((c) => c.sentiment)
        .map((c) => ({
          comment: c,
          sentimentImpact: Math.abs(c.sentiment!.original.compound) * c.score,
        }))
        .sort((a, b) => b.sentimentImpact - a.sentimentImpact)
        .slice(0, 5);
      (topicNode as any).topComments = topComments;

      const addCommentNodes = (
        comments: RedditComment[],
        parentId?: string,
        depth = 0
      ) => {
        console.log(
          `📝 Processing ${comments.length} comments at depth ${depth}, parentId: ${parentId}`
        );

        comments.forEach((comment, index) => {
          const commentId =
            comment.id ||
            `comment-${depth}-${index}-${comment.text
              .slice(0, 10)
              .replace(/\s+/g, "")}`;

          console.log(`💬 Comment ${index} at depth ${depth}:`, {
            id: commentId,
            text: comment.text.slice(0, 30),
            hasReplies: !!(comment.replies && comment.replies.length > 0),
            repliesCount: comment.replies?.length || 0,
            parentId,
          });

          const commentNode: CommentNode = {
            id: commentId,
            label: comment.text.slice(0, 50) + "...",
            type: "comment",
            comment,
            sentimentScore: comment.sentiment?.original.compound || 0,
            parentId,
          };
          nodes.push(commentNode);

          // Link to parent (either topic center or parent comment)
          if (parentId) {
            links.push({
              source: parentId,
              target: commentId,
              type: "comment-reply",
            });
          } else {
            // Top-level comment - link to topic center
            links.push({
              source: "topic-center",
              target: commentId,
              type: "topic-comment",
            });
          }

          // Process replies recursively
          if (comment.replies && comment.replies.length > 0) {
            console.log(
              `🔄 Processing ${comment.replies.length} replies for comment ${commentId}`
            );
            addCommentNodes(comment.replies, commentId, depth + 1);
          }
        });
      };

      // Add all comments starting from top level
      addCommentNodes(discussion.comments);

      console.log("🌳 Comment tree built:", {
        totalNodes: nodes.length,
        totalLinks: links.length,
        topLevelComments: discussion.comments.length,
        sampleComment: discussion.comments[0]
          ? {
              text: discussion.comments[0].text.slice(0, 50),
              hasReplies: !!(
                discussion.comments[0].replies &&
                discussion.comments[0].replies.length > 0
              ),
              repliesCount: discussion.comments[0].replies?.length || 0,
            }
          : null,
      });

      return {
        nodes: nodes as any,
        links,
        centerNode: topicNode,
      };
    },
    []
  );

  // Handle node interactions
  const handleNodeClick = useCallback(
    (nodeId: string, nodeType: string) => {
      console.log("🖱️ Node clicked:", {
        nodeId,
        nodeType,
        currentMode: viewState.mode,
      });

      if (nodeType === "topic") {
        console.log("📋 Switching to topic-expanded mode for:", nodeId);
        setViewState({
          mode: "topic-expanded",
          selectedTopicId: nodeId,
        });
      } else if (viewState.mode === "topic-expanded") {
        console.log("🔙 Returning to overview mode");
        setViewState({ mode: "overview" });
      }
    },
    [viewState.mode]
  );

  const handleNodeHover = useCallback((event: MouseEvent, nodeData: any) => {
    if (!nodeData) {
      setTooltip(null);
      return;
    }

    // Only show tooltips for subreddit, topic, and comment nodes
    // Skip query nodes as they don't need tooltips (except for central topic in expanded view)
    if (nodeData.type === "query" && nodeData.id !== "topic-center") {
      setTooltip(null);
      return;
    }

    // Get the SVG container's bounding rectangle for proper positioning
    const svgElement = svgRef.current;
    if (!svgElement) {
      setTooltip(null);
      return;
    }

    const svgRect = svgElement.getBoundingClientRect();

    // Calculate initial tooltip position
    let tooltipX = svgRect.left + (event.offsetX || event.layerX || 0) + 10;
    let tooltipY = svgRect.top + (event.offsetY || event.layerY || 0) - 10;

    // Estimate tooltip dimensions (approximate)
    const tooltipWidth = 400; // max-w-md is roughly 400px
    const tooltipHeight = 200; // estimated height for typical tooltip

    // Check if tooltip would go off the right edge of the screen
    if (tooltipX + tooltipWidth > window.innerWidth) {
      tooltipX =
        svgRect.left + (event.offsetX || event.layerX || 0) - tooltipWidth - 10;
    }

    // Check if tooltip would go off the top edge of the screen
    if (tooltipY - tooltipHeight < 0) {
      tooltipY = svgRect.top + (event.offsetY || event.layerY || 0) + 10;
    }

    // Check if tooltip would go off the bottom edge of the screen
    if (tooltipY > window.innerHeight - tooltipHeight) {
      tooltipY = window.innerHeight - tooltipHeight - 10;
    }

    // Check if tooltip would go off the left edge of the screen
    if (tooltipX < 0) {
      tooltipX = 10;
    }

    const tooltipData: TooltipData = {
      type:
        nodeData.type === "subreddit"
          ? "subreddit"
          : nodeData.type === "topic" || nodeData.id === "topic-center"
          ? "topic"
          : "comment",
      data: nodeData,
      x: tooltipX,
      y: tooltipY,
    };
    setTooltip(tooltipData);
  }, []);

  // D3 visualization effect
  useEffect(() => {
    if (!analysis.data.discussions || analysis.data.discussions.length === 0)
      return;

    let currentNetworkData: NetworkData;

    if (viewState.mode === "overview") {
      currentNetworkData = buildNetworkData(analysis.data);
    } else if (viewState.selectedTopicId) {
      console.log(
        "🔍 Looking for discussion with topic ID:",
        viewState.selectedTopicId
      );
      console.log(
        "📋 Available discussions:",
        analysis.data.discussions.map((d, index) => {
          const topicId = `topic-${index}`;
          return {
            index,
            title: d.title,
            topicId,
            subreddit: (d as any).subreddit,
          };
        })
      );

      const selectedDiscussion = analysis.data.discussions.find((d, index) => {
        const topicId = `topic-${index}`;
        return topicId === viewState.selectedTopicId;
      });

      console.log("✅ Found discussion:", selectedDiscussion?.title);

      if (selectedDiscussion) {
        console.log("🌳 Building comment tree for:", selectedDiscussion.title);
        console.log("💬 Comments count:", selectedDiscussion.comments.length);
        console.log(
          "📋 Sample comment structure:",
          selectedDiscussion.comments[0]
            ? {
                id: selectedDiscussion.comments[0].id,
                text: selectedDiscussion.comments[0].text?.slice(0, 50),
                score: selectedDiscussion.comments[0].score,
                hasReplies: !!(
                  selectedDiscussion.comments[0].replies &&
                  selectedDiscussion.comments[0].replies.length > 0
                ),
                repliesCount:
                  selectedDiscussion.comments[0].replies?.length || 0,
                firstReply: selectedDiscussion.comments[0].replies?.[0]
                  ? {
                      text: selectedDiscussion.comments[0].replies[0].text?.slice(
                        0,
                        30
                      ),
                      score: selectedDiscussion.comments[0].replies[0].score,
                    }
                  : null,
              }
            : "No comments"
        );
        currentNetworkData = buildCommentTree(selectedDiscussion);
      } else {
        console.log(
          "❌ No discussion found for topic ID:",
          viewState.selectedTopicId
        );
        return;
      }
    } else {
      return;
    }

    setNetworkData(currentNetworkData);

    console.log("🌐 Network data created:", currentNetworkData);
    console.log(
      "📊 Node types:",
      currentNetworkData.nodes.map((n) => ({ id: n.id, type: n.type }))
    );
    console.log("🔗 Links:", currentNetworkData.links);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 1200;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#fafafa");

    // Create force simulation
    const simulation = d3
      .forceSimulation(currentNetworkData.nodes as any)
      .force(
        "link",
        d3
          .forceLink(currentNetworkData.links)
          .id((d: any) => d.id)
          .distance((d) => {
            if (d.type === "query-subreddit") return 150;
            if (d.type === "subreddit-topic") return 100;
            if (d.type === "topic-comment") return 120; // Distance from topic to top-level comments
            if (d.type === "comment-reply") return 80; // Distance between comment replies
            return 80;
          })
      )
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength(viewState.mode === "topic-expanded" ? -200 : -300)
      )
      .force("center", d3.forceCenter(centerX, centerY))
      .force("collision", d3.forceCollide().radius(30));

    // Draw links
    const link = svg
      .append("g")
      .selectAll("line")
      .data(currentNetworkData.links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2);

    // Draw nodes
    const node = svg
      .append("g")
      .selectAll("g")
      .data(currentNetworkData.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<any, any>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // Add circles for nodes
    node
      .append("circle")
      .attr("r", (d: any) => {
        if (d.type === "query") return 25;
        if (d.type === "subreddit") return 20;
        if (d.type === "topic") return 15;
        return 10;
      })
      .attr("fill", (d: any) => {
        if (d.type === "query") return "#1f2937";
        if (d.type === "subreddit") return "#3b82f6";
        if (d.type === "topic") {
          const sentiment = d.weightedSentiment || 0;
          if (sentiment > 0.1) return "#10b981";
          if (sentiment < -0.1) return "#ef4444";
          return "#6b7280";
        }
        if (d.type === "comment") {
          const sentiment = d.sentimentScore || 0;
          if (sentiment > 0.1) return "#10b981";
          if (sentiment < -0.1) return "#ef4444";
          return "#6b7280";
        }
        return "#6b7280";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add labels
    node
      .append("text")
      .text((d: any) => {
        const maxLength =
          d.type === "query" ? 20 : d.type === "subreddit" ? 15 : 12;
        return d.label.length > maxLength
          ? d.label.slice(0, maxLength) + "..."
          : d.label;
      })
      .attr("x", 0)
      .attr("y", (d: any) =>
        d.type === "query" ? -30 : d.type === "subreddit" ? -25 : -20
      )
      .attr("text-anchor", "middle")
      .attr("font-size", (d: any) => (d.type === "query" ? "14px" : "12px"))
      .attr("font-weight", (d: any) => (d.type === "query" ? "bold" : "normal"))
      .attr("fill", "#374151")
      .attr("pointer-events", "none");

    // Add event handlers
    node
      .on("mouseover", function (event, d: any) {
        handleNodeHover(event, d);
      })
      .on("mouseout", function () {
        setTooltip(null);
      })
      .on("click", function (event, d: any) {
        handleNodeClick(d.id, d.type);
      });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }, [
    analysis.data,
    viewState,
    buildNetworkData,
    buildCommentTree,
    handleNodeClick,
    handleNodeHover,
  ]);

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.1) return "text-green-600";
    if (sentiment < -0.1) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="relative">
      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {viewState.mode === "overview"
              ? "Discussion Network"
              : "Comment Tree"}
          </h3>
          <p className="text-sm text-gray-600">
            {viewState.mode === "overview"
              ? "Click on topics to expand comments. Hover for details."
              : "Click anywhere to return to overview."}
          </p>
        </div>

        {viewState.mode === "topic-expanded" && (
          <button
            onClick={() => setViewState({ mode: "overview" })}
            className="btn-secondary"
          >
            ← Back to Overview
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="mb-4 flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-gray-800"></div>
          <span>Query</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span>Subreddit</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span>Positive</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span>Negative</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-gray-500"></div>
          <span>Neutral</span>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="border border-gray-200 rounded-lg overflow-auto bg-white max-h-[800px]">
        <svg ref={svgRef} className="w-full min-w-[1200px]"></svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg pointer-events-none max-w-md"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.type === "subreddit" && (
            <div>
              <div className="font-semibold mb-1">r/{tooltip.data.label}</div>
              <div className="text-xs space-y-1">
                <div className="flex items-center space-x-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>{tooltip.data.discussionCount} discussions</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>{tooltip.data.totalComments} total comments</span>
                </div>
                {tooltip.data.topEntities.length > 0 && (
                  <div>
                    <div className="font-medium mt-2 mb-1">Top Entities:</div>
                    {tooltip.data.topEntities.map((entity: any, i: number) => (
                      <div key={i} className="mb-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs px-1 py-0.5 rounded bg-gray-700 text-gray-200">
                              {entity.type.charAt(0)}
                            </span>
                            <span className="font-medium">{entity.text}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-xs">
                            <span>{entity.mentions}×</span>
                            <span
                              className={getSentimentColor(entity.sentiment)}
                            >
                              {entity.sentiment > 0 ? "+" : ""}
                              {entity.sentiment.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tooltip.type === "topic" && (
            <div>
              <div className="font-semibold mb-1">{tooltip.data.label}</div>
              <div className="text-xs space-y-1">
                <div className="flex items-center space-x-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>{tooltip.data.commentCount} comments</span>
                </div>
                {tooltip.data.weightedSentiment !== undefined && (
                  <div
                    className={getSentimentColor(
                      tooltip.data.weightedSentiment
                    )}
                  >
                    Sentiment: {tooltip.data.weightedSentiment.toFixed(3)}
                  </div>
                )}
                {tooltip.data.topComments &&
                  tooltip.data.topComments.length > 0 && (
                    <div>
                      <div className="font-medium mt-2 mb-1">Top Comments:</div>
                      {tooltip.data.topComments
                        .slice(0, 3)
                        .map((item: any, i: number) => (
                          <div key={i} className="mb-1">
                            <div className="flex items-center space-x-1">
                              <ThumbsUp className="h-3 w-3" />
                              <span>{item.comment.score}</span>
                              <span
                                className={getSentimentColor(
                                  item.comment.sentiment?.original.compound || 0
                                )}
                              >
                                (
                                {item.comment.sentiment?.original.compound.toFixed(
                                  2
                                )}
                                )
                              </span>
                            </div>
                            <div className="text-xs opacity-75 mt-1">
                              {item.comment.text.length > 300
                                ? item.comment.text.slice(0, 300) + "..."
                                : item.comment.text}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
              </div>
            </div>
          )}

          {tooltip.type === "comment" &&
            (() => {
              console.log("🔍 Comment tooltip data:", tooltip.data);
              console.log("💬 Comment object:", tooltip.data.comment);
              console.log("📊 Comment score:", tooltip.data.comment?.score);
              return (
                <div>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{tooltip.data.comment.score} upvotes</span>
                      </div>
                    </div>
                    <div
                      className={getSentimentColor(tooltip.data.sentimentScore)}
                    >
                      Sentiment: {tooltip.data.sentimentScore.toFixed(3)}
                    </div>
                    <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
                      {tooltip.data.comment.text.length > 300
                        ? tooltip.data.comment.text.slice(0, 300) + "..."
                        : tooltip.data.comment.text}
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}
    </div>
  );
}
