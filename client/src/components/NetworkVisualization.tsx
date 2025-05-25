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
        const weightedSentimentSum = discussions.reduce(
          (sum: number, d: Discussion) =>
            sum + (d.weightedSentiment || 0) * d.commentCount,
          0
        );
        const averageSentiment =
          totalComments > 0 ? weightedSentimentSum / totalComments : 0;

        // Calculate top entities for this subreddit
        const entityMap = new Map();
        discussions.forEach((d: Discussion) => {
          d.entities?.forEach((entity) => {
            const key = entity.text;
            if (!entityMap.has(key)) {
              entityMap.set(key, {
                entity: entity,
                mentions: 0,
                sentimentSum: 0,
                count: 0,
              });
            }
            const existing = entityMap.get(key);
            existing.mentions += 1;
            existing.sentimentSum += entity.confidence || 0;
            existing.count += 1;
          });
        });

        const topEntities = Array.from(entityMap.values())
          .map((item: any) => ({
            entity: item.entity,
            mentions: item.mentions,
            averageSentiment:
              item.count > 0 ? item.sentimentSum / item.count : 0,
          }))
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 5);

        const subredditNode: SubredditNode = {
          id: `subreddit-${subredditName}`,
          label: subredditName,
          type: "subreddit",
          discussionCount: discussions.length,
          totalComments,
          averageSentiment,
          weightedSentiment: averageSentiment,
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
              : 0;

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

          const discussionId =
            discussion.id ||
            `discussion-${subredditName}-${index}-${discussion.title
              .slice(0, 20)
              .replace(/\s+/g, "")}`;
          const topicNode: TopicNode = {
            id: `topic-${discussionId}`,
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
      const nodes: CommentNode[] = [];
      const links: any[] = [];

      const addCommentNodes = (
        comments: RedditComment[],
        parentId?: string,
        depth = 0
      ) => {
        comments.forEach((comment, index) => {
          const commentId =
            comment.id ||
            `comment-${depth}-${index}-${comment.text
              .slice(0, 10)
              .replace(/\s+/g, "")}`;
          const commentNode: CommentNode = {
            id: commentId,
            label: comment.text.slice(0, 50) + "...",
            type: "comment",
            comment,
            sentimentScore: comment.sentiment?.original.compound || 0,
            parentId,
          };
          nodes.push(commentNode);

          if (parentId) {
            links.push({
              source: parentId,
              target: commentId,
              type: "comment-reply",
            });
          }

          if (comment.replies && comment.replies.length > 0) {
            addCommentNodes(comment.replies, commentId, depth + 1);
          }
        });
      };

      addCommentNodes(discussion.comments);

      return {
        nodes: nodes as any,
        links,
        centerNode: {
          id: "topic",
          label: discussion.title,
          type: "query",
        } as QueryNode,
      };
    },
    []
  );

  // Handle node interactions
  const handleNodeClick = useCallback(
    (nodeId: string, nodeType: string) => {
      if (nodeType === "topic") {
        setViewState({
          mode: "topic-expanded",
          selectedTopicId: nodeId,
        });
      } else if (viewState.mode === "topic-expanded") {
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
    // Skip query nodes as they don't need tooltips
    if (nodeData.type === "query") {
      setTooltip(null);
      return;
    }

    const tooltipData: TooltipData = {
      type:
        nodeData.type === "subreddit"
          ? "subreddit"
          : nodeData.type === "topic"
          ? "topic"
          : "comment",
      data: nodeData,
      x: event.pageX,
      y: event.pageY,
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
      const selectedDiscussion = analysis.data.discussions.find((d, index) => {
        const discussionId =
          d.id ||
          `discussion-${d.subreddit}-${index}-${d.title
            .slice(0, 20)
            .replace(/\s+/g, "")}`;
        return `topic-${discussionId}` === viewState.selectedTopicId;
      });
      if (selectedDiscussion) {
        currentNetworkData = buildCommentTree(selectedDiscussion);
      } else {
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
            return 80;
          })
      )
      .force("charge", d3.forceManyBody().strength(-300))
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
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <svg ref={svgRef} className="w-full"></svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg pointer-events-none max-w-sm"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: "translateY(-100%)",
          }}
        >
          {tooltip.type === "subreddit" && (
            <div>
              <div className="font-semibold mb-1">r/{tooltip.data.label}</div>
              <div className="text-xs space-y-1">
                <div>{tooltip.data.discussionCount} discussions</div>
                <div>{tooltip.data.totalComments} total comments</div>
                <div
                  className={getSentimentColor(tooltip.data.weightedSentiment)}
                >
                  Sentiment: {tooltip.data.weightedSentiment.toFixed(3)}
                </div>
                {tooltip.data.topEntities.length > 0 && (
                  <div>
                    <div className="font-medium mt-2 mb-1">Top Entities:</div>
                    {tooltip.data.topEntities
                      .slice(0, 3)
                      .map((entity: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span>{entity.entity.text}</span>
                          <span>{entity.mentions}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tooltip.type === "topic" && (
            <div>
              <div className="font-semibold mb-1">
                {tooltip.data.label.slice(0, 50)}...
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center space-x-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>{tooltip.data.commentCount} comments</span>
                </div>
                <div
                  className={getSentimentColor(tooltip.data.weightedSentiment)}
                >
                  Sentiment: {tooltip.data.weightedSentiment.toFixed(3)}
                </div>
                {tooltip.data.topComments.length > 0 && (
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
                          <div className="text-xs opacity-75">
                            {item.comment.text.slice(0, 60)}...
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
                      {tooltip.data.comment.text.slice(0, 200)}
                      {tooltip.data.comment.text.length > 200 && "..."}
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
