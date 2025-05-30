import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AnalysisResult } from "../../types/analysis";

interface SentimentOverviewProps {
  analysis: AnalysisResult;
}

export default function SentimentOverview({
  analysis,
}: SentimentOverviewProps) {
  const { data } = analysis;

  // Calculate overall sentiment from discussions
  const sentimentData = data.discussions.reduce(
    (acc, discussion) => {
      const comments = discussion.comments || [];
      comments.forEach((comment) => {
        if (comment.sentiment) {
          if (comment.sentiment.label === "positive") acc.positive++;
          else if (comment.sentiment.label === "negative") acc.negative++;
          else acc.neutral++;
        }
      });
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );

  const totalSentiments =
    sentimentData.positive + sentimentData.negative + sentimentData.neutral;

  const pieData = [
    { name: "Positive", value: sentimentData.positive, color: "#10b981" },
    { name: "Negative", value: sentimentData.negative, color: "#ef4444" },
    { name: "Neutral", value: sentimentData.neutral, color: "#6b7280" },
  ];

  // Calculate score-weighted average sentiment scores
  const avgSentiment = data.discussions.reduce((acc, discussion) => {
    const comments = discussion.comments || [];
    const commentsWithSentiment = comments
      .filter((c) => c.sentiment && c.sentiment.original.compound !== 0)
      .map((c) => ({
        sentiment: c.sentiment!.original.compound,
        score: c.score,
      }));

    if (commentsWithSentiment.length > 0) {
      // Calculate score-weighted average
      const totalScore = commentsWithSentiment.reduce(
        (sum, c) => sum + c.score,
        0
      );
      const weightedSentiment =
        totalScore > 0
          ? commentsWithSentiment.reduce(
              (sum, c) => sum + c.sentiment * c.score,
              0
            ) / totalScore
          : commentsWithSentiment.reduce((sum, c) => sum + c.sentiment, 0) /
            commentsWithSentiment.length;

      acc.push({
        title: discussion.title.slice(0, 30) + "...",
        fullTitle: discussion.title,
        sentiment: weightedSentiment,
      });
    }
    return acc;
  }, [] as Array<{ title: string; fullTitle: string; sentiment: number }>);

  const overallSentiment =
    totalSentiments > 0
      ? (sentimentData.positive - sentimentData.negative) / totalSentiments
      : 0;

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.1)
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (sentiment < -0.1)
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-gray-500" />;
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment > 0.1) return "Positive";
    if (sentiment < -0.1) return "Negative";
    return "Neutral";
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.1) return "text-green-600 bg-green-50";
    if (sentiment < -0.1) return "text-red-600 bg-red-50";
    return "text-gray-600 bg-gray-50";
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Sentiment Overview
        </h3>
        <div
          className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getSentimentColor(
            overallSentiment
          )}`}
        >
          {getSentimentIcon(overallSentiment)}
          <span className="font-medium">
            {getSentimentLabel(overallSentiment)}
          </span>
        </div>
      </div>

      {totalSentiments > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Sentiment Distribution
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
                  formatter={(value: number) => [
                    `${value} comments (${(
                      (value / totalSentiments) *
                      100
                    ).toFixed(1)}%)`,
                    "Count",
                  ]}
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

          {/* Statistics */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Key Metrics</h4>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Comments</span>
                <span className="font-semibold">{totalSentiments}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Positive Rate</span>
                <span className="font-semibold text-green-600">
                  {((sentimentData.positive / totalSentiments) * 100).toFixed(
                    1
                  )}
                  %
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Negative Rate</span>
                <span className="font-semibold text-red-600">
                  {((sentimentData.negative / totalSentiments) * 100).toFixed(
                    1
                  )}
                  %
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Overall Score</span>
                <span
                  className={`font-semibold ${
                    overallSentiment > 0
                      ? "text-green-600"
                      : overallSentiment < 0
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {overallSentiment.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Top Discussions by Sentiment */}
            {avgSentiment.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Top Discussions
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {avgSentiment
                    .sort(
                      (a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment)
                    )
                    .slice(0, 5)
                    .map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs"
                        title={item.fullTitle}
                      >
                        <span className="text-gray-600 truncate flex-1 mr-2">
                          {item.title}
                        </span>
                        <span
                          className={`font-medium ${
                            item.sentiment > 0
                              ? "text-green-600"
                              : item.sentiment < 0
                              ? "text-red-600"
                              : "text-gray-600"
                          }`}
                        >
                          {item.sentiment.toFixed(2)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No sentiment data available for this analysis.</p>
        </div>
      )}
    </div>
  );
}
