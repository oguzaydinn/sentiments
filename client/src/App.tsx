import { useState, useEffect } from "react";
import {
  Search,
  BarChart3,
  Users,
  MapPin,
  TrendingUp,
  CheckCircle,
  XCircle,
} from "lucide-react";
import AnalysisForm from "./components/AnalysisForm";
import NetworkVisualization from "./components/NetworkVisualization";
import RecentQueries from "./components/RecentQueries";
import { testAPI, healthCheck } from "./services/api";
import type { AnalysisResult } from "./types/analysis";

function App() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<{
    connected: boolean;
    message: string;
    loading: boolean;
  }>({
    connected: false,
    message: "Checking connection...",
    loading: true,
  });

  // Test API connection on component mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const [healthResult, testResult] = await Promise.all([
          healthCheck(),
          testAPI(),
        ]);

        setApiStatus({
          connected: true,
          message: `Connected to API - ${healthResult.message}`,
          loading: false,
        });

        console.log("API Test Result:", testResult);
      } catch (error) {
        setApiStatus({
          connected: false,
          message: `Failed to connect to API: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          loading: false,
        });
      }
    };

    testConnection();
  }, []);

  const handleAnalysisComplete = (result: AnalysisResult) => {
    console.log("🏁 App.handleAnalysisComplete called with:", result);
    console.log("📊 Setting currentAnalysis to:", result);

    setCurrentAnalysis(result);
    setIsLoading(false);

    console.log("✅ Analysis state updated, isLoading set to false");
  };

  const handleAnalysisStart = () => {
    console.log("🚀 App.handleAnalysisStart called");
    console.log("🔄 Setting isLoading to true, clearing currentAnalysis");

    setIsLoading(true);
    setCurrentAnalysis(null);
  };

  const handleLoadCachedQuery = async (
    id: string,
    query: string,
    category: string
  ) => {
    console.log(
      `🎯 Loading cached query: "${query}" (${category}) with ID: ${id}`
    );

    try {
      setIsLoading(true);
      setCurrentAnalysis(null);

      const response = await fetch(`http://localhost:3001/api/analysis/${id}`);
      const result = await response.json();

      if (result.success) {
        console.log("✅ Cached analysis loaded successfully");
        setCurrentAnalysis(result);
      } else {
        console.error("❌ Failed to load cached analysis:", result.error);
        // Could show an error message to user here
      }
    } catch (error) {
      console.error("❌ Error loading cached analysis:", error);
      // Could show an error message to user here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Reddit Sentiment Network
                </h1>
                <p className="text-sm text-gray-600">
                  Interactive network analysis of Reddit discussions and
                  sentiment
                </p>
              </div>
            </div>

            {/* API Status Indicator */}
            <div className="flex items-center space-x-2">
              {apiStatus.loading ? (
                <div className="loading-spinner"></div>
              ) : apiStatus.connected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span
                className={`text-sm ${
                  apiStatus.connected ? "text-green-600" : "text-red-600"
                }`}
              >
                {apiStatus.connected ? "API Connected" : "API Disconnected"}
              </span>
            </div>

            {currentAnalysis && (
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{currentAnalysis.data.totalComments} comments</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    {currentAnalysis.data.totalDiscussions} discussions
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {(() => {
                      // Extract unique subreddits from discussions if subreddits field is not available
                      const subreddits = currentAnalysis.data.subreddits || [
                        ...new Set(
                          currentAnalysis.data.discussions.map(
                            (d) => d.subreddit
                          )
                        ),
                      ];
                      return subreddits.length;
                    })()}{" "}
                    subreddits
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* API Status Banner */}
      {!apiStatus.loading && !apiStatus.connected && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{apiStatus.message}</p>
                <p className="text-xs text-red-600 mt-1">
                  Make sure the backend server is running on port 3001
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentAnalysis && !isLoading && (
          <div>
            <div className="text-center py-12">
              <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Explore Reddit Sentiment Networks
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Enter a search query to create an interactive network
                visualization showing how discussions and sentiment flow across
                Reddit communities.
              </p>
            </div>

            {/* Two-column layout for form and recent queries */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <AnalysisForm
                  onAnalysisStart={handleAnalysisStart}
                  onAnalysisComplete={handleAnalysisComplete}
                  isLoading={isLoading}
                />
              </div>
              <div className="lg:col-span-1">
                <RecentQueries onLoadQuery={handleLoadCachedQuery} />
              </div>
            </div>
          </div>
        )}

        {/* Analysis Form for when there is a current analysis */}
        {currentAnalysis && !isLoading && (
          <div className="mb-8">
            <AnalysisForm
              onAnalysisStart={handleAnalysisStart}
              onAnalysisComplete={handleAnalysisComplete}
              isLoading={isLoading}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Building Network Visualization...
            </h3>
            <p className="text-gray-600">
              Analyzing Reddit discussions and mapping sentiment connections.
            </p>
          </div>
        )}

        {/* Network Visualization */}
        {currentAnalysis && !isLoading && (
          <div className="space-y-6">
            {/* Analysis Summary */}
            <div className="card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Network Analysis: "{currentAnalysis.data.query}"
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span>
                      Category: <strong>{currentAnalysis.data.category}</strong>
                    </span>
                    <span>
                      Timeframe:{" "}
                      <strong>{currentAnalysis.data.timeframe}</strong>
                    </span>
                    <span>
                      Min Score:{" "}
                      <strong>{currentAnalysis.data.minPostScore}</strong>
                    </span>
                    {currentAnalysis.cached && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        Cached Result
                      </span>
                    )}
                    {currentAnalysis.message && (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                        {currentAnalysis.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Network Visualization */}
            <NetworkVisualization analysis={currentAnalysis} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>
              Interactive network visualization powered by D3.js • Sentiment
              analysis via VADER • Data from Reddit API
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
