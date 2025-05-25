import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Users, Building, MapPin } from "lucide-react";
import type { AnalysisResult, EntityNode } from "../../types/analysis";

interface EntityNetworkProps {
  analysis: AnalysisResult;
}

export default function EntityNetwork({ analysis }: EntityNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityNode | null>(null);
  const { data } = analysis;

  useEffect(() => {
    if (!data.entities || data.entities.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 500;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Transform entity chains to nodes
    const nodes: EntityNode[] = data.entities.map((chain) => ({
      id: chain.entity.normalizedText,
      label: chain.entity.text,
      type: chain.entity.type,
      mentions: chain.totalMentions,
      totalScore: chain.totalScore,
      sentiment: chain.averageSentiment.overall,
      sentimentScore: chain.averageSentiment.compound,
    }));

    // Create links based on co-occurrence (simplified)
    const links: Array<{ source: string; target: string; strength: number }> =
      [];

    // For now, create links between entities of different types that appear in similar contexts
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        // Create links between different entity types with some randomness for demo
        if (node1.type !== node2.type && Math.random() > 0.7) {
          links.push({
            source: node1.id,
            target: node2.id,
            strength:
              Math.min(node1.mentions, node2.mentions) /
              Math.max(node1.mentions, node2.mentions),
          });
        }
      }
    }

    // Set up SVG
    svg
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#fafafa");

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .strength(0.1)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tooltip")
      .style("opacity", 0);

    // Draw links
    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "d3-link")
      .attr("stroke-width", (d: any) => Math.sqrt(d.strength) * 3)
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const node = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "d3-node")
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
      .attr("r", (d: EntityNode) => Math.sqrt(d.mentions) * 3 + 8)
      .attr("fill", (d: EntityNode) => {
        const colors = {
          PERSON:
            d.sentiment === "positive"
              ? "#10b981"
              : d.sentiment === "negative"
              ? "#ef4444"
              : "#6b7280",
          ORGANIZATION:
            d.sentiment === "positive"
              ? "#059669"
              : d.sentiment === "negative"
              ? "#dc2626"
              : "#4b5563",
          LOCATION:
            d.sentiment === "positive"
              ? "#047857"
              : d.sentiment === "negative"
              ? "#b91c1c"
              : "#374151",
        };
        return colors[d.type];
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add labels
    node
      .append("text")
      .text((d: EntityNode) =>
        d.label.length > 12 ? d.label.slice(0, 12) + "..." : d.label
      )
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#fff")
      .attr("pointer-events", "none");

    // Add event handlers
    node
      .on("mouseover", function (event, d: EntityNode) {
        tooltip.transition().duration(200).style("opacity", 0.9);

        tooltip
          .html(
            `
          <div class="font-semibold">${d.label}</div>
          <div class="text-xs">Type: ${d.type}</div>
          <div class="text-xs">Mentions: ${d.mentions}</div>
          <div class="text-xs">Total Score: ${d.totalScore}</div>
          <div class="text-xs">Sentiment: ${
            d.sentiment
          } (${d.sentimentScore.toFixed(2)})</div>
        `
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(500).style("opacity", 0);
      })
      .on("click", function (event, d: EntityNode) {
        setSelectedEntity(d);
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

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [data.entities]);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "PERSON":
        return <Users className="h-4 w-4" />;
      case "ORGANIZATION":
        return <Building className="h-4 w-4" />;
      case "LOCATION":
        return <MapPin className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (!data.entities || data.entities.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Entity Network
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No entity data available for network visualization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Entity Network</h3>
        <div className="flex items-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Person</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Organization</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Location</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Network Visualization */}
        <div className="lg:col-span-3">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <svg ref={svgRef} className="w-full"></svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click and drag nodes to explore relationships. Node size represents
            mention frequency.
          </p>
        </div>

        {/* Entity Details */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Entity Details</h4>

          {selectedEntity ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                {getEntityIcon(selectedEntity.type)}
                <span className="font-medium">{selectedEntity.label}</span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{selectedEntity.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mentions:</span>
                  <span className="font-medium">{selectedEntity.mentions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Score:</span>
                  <span className="font-medium">
                    {selectedEntity.totalScore}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sentiment:</span>
                  <span
                    className={`font-medium ${
                      selectedEntity.sentiment === "positive"
                        ? "text-green-600"
                        : selectedEntity.sentiment === "negative"
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {selectedEntity.sentiment}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              Click on a node to see details
            </div>
          )}

          {/* Top Entities */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Top Entities
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.entities
                .sort((a, b) => b.totalMentions - a.totalMentions)
                .slice(0, 10)
                .map((chain, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    onClick={() =>
                      setSelectedEntity({
                        id: chain.entity.normalizedText,
                        label: chain.entity.text,
                        type: chain.entity.type,
                        mentions: chain.totalMentions,
                        totalScore: chain.totalScore,
                        sentiment: chain.averageSentiment.overall,
                        sentimentScore: chain.averageSentiment.compound,
                      })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      {getEntityIcon(chain.entity.type)}
                      <span className="truncate">{chain.entity.text}</span>
                    </div>
                    <span className="font-medium">{chain.totalMentions}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
