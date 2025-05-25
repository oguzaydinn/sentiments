import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { AnalysisResult } from "../../types/analysis";

interface SentimentTrendProps {
  analysis: AnalysisResult;
}

export default function SentimentTrend({ analysis }: SentimentTrendProps) {
  const { data } = analysis;

  // Process data for trend visualization
  const trendData = data.discussions
    .flatMap((discussion) =>
      discussion.comments
        .filter((comment) => comment.sentiment && comment.timestamp)
        .map((comment) => ({
          timestamp: comment.timestamp!,
          sentiment: comment.sentiment!.original.compound,
          score: comment.score,
          discussion: discussion.title.slice(0, 30) + "...",
        }))
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  // Group by time periods (hours)
  const groupedData = trendData.reduce((acc, item) => {
    const hour = format(parseISO(item.timestamp), "MMM dd, HH:00");

    if (!acc[hour]) {
      acc[hour] = {
        time: hour,
        sentiments: [],
        scores: [],
        count: 0,
      };
    }

    acc[hour].sentiments.push(item.sentiment);
    acc[hour].scores.push(item.score);
    acc[hour].count++;

    return acc;
  }, {} as Record<string, { time: string; sentiments: number[]; scores: number[]; count: number }>);

  const chartData = Object.values(groupedData).map((group) => ({
    time: group.time,
    avgSentiment:
      group.sentiments.reduce((sum, s) => sum + s, 0) / group.sentiments.length,
    volume: group.count,
    weightedSentiment:
      group.sentiments.reduce((sum, s, i) => sum + s * group.scores[i], 0) /
        group.scores.reduce((sum, s) => sum + s, 0) || 0,
  }));

  if (chartData.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Sentiment Trend
        </h3>
        <div className="text-center py-8 text-gray-500">
          <p>No temporal data available for trend analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Sentiment Trend Over Time
        </h3>
        <div className="text-sm text-gray-600">
          {chartData.length} time periods • {trendData.length} total comments
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "avgSentiment"
                    ? value.toFixed(3)
                    : name === "weightedSentiment"
                    ? value.toFixed(3)
                    : value,
                  name === "avgSentiment"
                    ? "Average Sentiment"
                    : name === "weightedSentiment"
                    ? "Score-Weighted Sentiment"
                    : "Volume",
                ]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgSentiment"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Average Sentiment"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="weightedSentiment"
                stroke="#10b981"
                strokeWidth={2}
                name="Score-Weighted Sentiment"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">
            Trend Statistics
          </h4>

          <div className="space-y-3">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">
                Peak Positive
              </div>
              <div className="text-lg font-bold text-blue-700">
                {Math.max(...chartData.map((d) => d.avgSentiment)).toFixed(3)}
              </div>
              <div className="text-xs text-blue-600">
                {
                  chartData.find(
                    (d) =>
                      d.avgSentiment ===
                      Math.max(...chartData.map((d) => d.avgSentiment))
                  )?.time
                }
              </div>
            </div>

            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600 font-medium">
                Peak Negative
              </div>
              <div className="text-lg font-bold text-red-700">
                {Math.min(...chartData.map((d) => d.avgSentiment)).toFixed(3)}
              </div>
              <div className="text-xs text-red-600">
                {
                  chartData.find(
                    (d) =>
                      d.avgSentiment ===
                      Math.min(...chartData.map((d) => d.avgSentiment))
                  )?.time
                }
              </div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600 font-medium">
                Highest Volume
              </div>
              <div className="text-lg font-bold text-green-700">
                {Math.max(...chartData.map((d) => d.volume))} comments
              </div>
              <div className="text-xs text-green-600">
                {
                  chartData.find(
                    (d) =>
                      d.volume === Math.max(...chartData.map((d) => d.volume))
                  )?.time
                }
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Recent Activity
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {trendData
                .slice(-10)
                .reverse()
                .map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded"
                  >
                    <div className="flex-1 truncate mr-2">
                      <div className="font-medium">{item.discussion}</div>
                      <div className="text-gray-500">
                        {format(parseISO(item.timestamp), "MMM dd, HH:mm")}
                      </div>
                    </div>
                    <div
                      className={`font-medium ${
                        item.sentiment > 0
                          ? "text-green-600"
                          : item.sentiment < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      {item.sentiment.toFixed(2)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
