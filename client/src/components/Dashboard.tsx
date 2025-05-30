import { useState } from "react";
import {
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  BarChart3,
} from "lucide-react";
import type { AnalysisResult } from "../types/analysis";
import SentimentOverview from "./visualizations/SentimentOverview";
import EntityNetwork from "./visualizations/EntityNetwork";
import SentimentTrend from "./visualizations/SentimentTrend";
import EntityBreakdown from "./visualizations/EntityBreakdown";
import DiscussionsList from "./DiscussionsList";
import { format } from "date-fns";

interface DashboardProps {
  analysis: AnalysisResult;
}

type TabType = "overview" | "entities" | "trends" | "discussions";

export default function Dashboard({ analysis }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const { data } = analysis;

  const tabs = [
    {
      id: "overview" as TabType,
      label: "Overview",
      icon: BarChart3,
      description: "Sentiment summary and key metrics",
    },
    {
      id: "entities" as TabType,
      label: "Entities",
      icon: Users,
      description: "People, organizations, and locations",
    },
    {
      id: "trends" as TabType,
      label: "Trends",
      icon: TrendingUp,
      description: "Sentiment over time",
    },
    {
      id: "discussions" as TabType,
      label: "Discussions",
      icon: MessageSquare,
      description: "Individual Reddit posts and comments",
    },
  ];

  const hasEntities = data.entities && data.entities.length > 0;

  return (
    <div className="space-y-6">
      {/* Analysis Header */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Analysis Results: "{data.query}"
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>Analyzed {format(new Date(data.scrapedAt), "PPp")}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="font-medium">Category:</span>
                <span className="capitalize">{data.category}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="font-medium">Timeframe:</span>
                <span className="capitalize">{data.timeframe}</span>
              </div>
              {analysis.cached && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  Cached Result
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 md:mt-0 grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {data.totalDiscussions}
              </div>
              <div className="text-xs text-blue-600">Discussions</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data.totalComments}
              </div>
              <div className="text-xs text-green-600">Comments</div>
            </div>
            {hasEntities && (
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {data.entities?.length || 0}
                </div>
                <div className="text-xs text-purple-600">Entities</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.id === "entities" && !hasEntities;

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    isActive
                      ? "border-primary-500 text-primary-600"
                      : isDisabled
                      ? "border-transparent text-gray-400 cursor-not-allowed"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <Icon
                  className={`
                  -ml-0.5 mr-2 h-5 w-5
                  ${
                    isActive
                      ? "text-primary-500"
                      : isDisabled
                      ? "text-gray-400"
                      : "text-gray-400 group-hover:text-gray-500"
                  }
                `}
                />
                <span>{tab.label}</span>
                {isDisabled && (
                  <span className="ml-2 text-xs text-gray-400">(No data)</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentOverview analysis={analysis} />
            {hasEntities && <EntityBreakdown analysis={analysis} />}
          </div>
        )}

        {activeTab === "entities" && hasEntities && (
          <div className="space-y-6">
            <EntityNetwork analysis={analysis} />
            <EntityBreakdown analysis={analysis} />
          </div>
        )}

        {activeTab === "trends" && (
          <div className="space-y-6">
            <SentimentTrend analysis={analysis} />
          </div>
        )}

        {activeTab === "discussions" && (
          <DiscussionsList discussions={data.discussions} />
        )}
      </div>
    </div>
  );
}
