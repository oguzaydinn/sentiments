import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Users, Building, MapPin } from "lucide-react";
import type { AnalysisResult } from "../../types/analysis";

interface EntityBreakdownProps {
  analysis: AnalysisResult;
}

export default function EntityBreakdown({ analysis }: EntityBreakdownProps) {
  const { data } = analysis;

  if (!data.entities || data.entities.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Entity Breakdown
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No entity data available for breakdown analysis.</p>
        </div>
      </div>
    );
  }

  // Calculate entity type breakdown
  const typeBreakdown = data.entities.reduce(
    (acc, chain) => {
      const type = chain.entity.type;
      if (!acc[type]) {
        acc[type] = {
          type,
          count: 0,
          totalMentions: 0,
          totalScore: 0,
          avgSentiment: 0,
          entities: [],
        };
      }

      acc[type].count++;
      acc[type].totalMentions += chain.totalMentions;
      acc[type].totalScore += chain.totalScore;
      acc[type].avgSentiment += chain.averageSentiment.compound;
      acc[type].entities.push(chain);

      return acc;
    },
    {} as Record<
      string,
      {
        type: string;
        count: number;
        totalMentions: number;
        totalScore: number;
        avgSentiment: number;
        entities: any[];
      }
    >
  );

  // Normalize average sentiment
  Object.values(typeBreakdown).forEach((breakdown) => {
    breakdown.avgSentiment = breakdown.avgSentiment / breakdown.count;
  });

  const pieData = Object.values(typeBreakdown).map((breakdown) => ({
    name: breakdown.type,
    value: breakdown.count,
    color:
      breakdown.type === "PERSON"
        ? "#3b82f6"
        : breakdown.type === "ORGANIZATION"
        ? "#10b981"
        : "#8b5cf6",
  }));

  const barData = Object.values(typeBreakdown).map((breakdown) => ({
    type: breakdown.type,
    mentions: breakdown.totalMentions,
    score: breakdown.totalScore,
    sentiment: breakdown.avgSentiment,
  }));

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "PERSON":
        return <Users className="h-5 w-5 text-blue-500" />;
      case "ORGANIZATION":
        return <Building className="h-5 w-5 text-green-500" />;
      case "LOCATION":
        return <MapPin className="h-5 w-5 text-purple-500" />;
      default:
        return <Users className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "PERSON":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "ORGANIZATION":
        return "bg-green-50 text-green-700 border-green-200";
      case "LOCATION":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Entity Breakdown
        </h3>
        <div className="text-sm text-gray-600">
          {data.entities.length} total entities
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Distribution by Type
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} entities`, "Count"]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex justify-center space-x-4 mt-2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center space-x-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-xs text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mentions by Type */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Mentions by Type
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value,
                  name === "mentions"
                    ? "Total Mentions"
                    : name === "score"
                    ? "Total Score"
                    : "Avg Sentiment",
                ]}
              />
              <Bar dataKey="mentions" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Type Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {Object.values(typeBreakdown).map((breakdown) => (
          <div
            key={breakdown.type}
            className={`p-4 rounded-lg border ${getTypeColor(breakdown.type)}`}
          >
            <div className="flex items-center space-x-2 mb-3">
              {getEntityIcon(breakdown.type)}
              <span className="font-medium">{breakdown.type}</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Count:</span>
                <span className="font-medium">{breakdown.count}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Mentions:</span>
                <span className="font-medium">{breakdown.totalMentions}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Score:</span>
                <span className="font-medium">{breakdown.totalScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Sentiment:</span>
                <span
                  className={`font-medium ${
                    breakdown.avgSentiment > 0
                      ? "text-green-600"
                      : breakdown.avgSentiment < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {breakdown.avgSentiment.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Entities by Type */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Top Entities by Type
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(typeBreakdown).map((breakdown) => (
            <div key={breakdown.type} className="space-y-2">
              <div className="flex items-center space-x-2">
                {getEntityIcon(breakdown.type)}
                <span className="font-medium text-sm">{breakdown.type}</span>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto">
                {breakdown.entities
                  .sort((a, b) => b.totalMentions - a.totalMentions)
                  .slice(0, 5)
                  .map((entity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded"
                    >
                      <span className="truncate flex-1 mr-2">
                        {entity.entity.text}
                      </span>
                      <span className="font-medium">
                        {entity.totalMentions}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
