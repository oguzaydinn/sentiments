import { useState, useEffect } from "react";
import { Clock, MessageSquare, Users, Search } from "lucide-react";
import { format, parseISO } from "date-fns";

interface RecentQuery {
  id: string;
  query: string;
  category: string;
  createdAt: string;
  totalComments: number;
  totalDiscussions: number;
}

interface RecentQueriesProps {
  onLoadQuery: (id: string, query: string, category: string) => void;
}

export default function RecentQueries({ onLoadQuery }: RecentQueriesProps) {
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentQueries();
  }, []);

  const fetchRecentQueries = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3001/api/recent?limit=10");
      const result = await response.json();

      if (result.success) {
        setRecentQueries(result.data);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch recent queries");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error("Error fetching recent queries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadQuery = (query: RecentQuery) => {
    onLoadQuery(query.id, query.query, query.category);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Recent Queries
        </h3>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Recent Queries
        </h3>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">{error}</div>
          <button
            onClick={fetchRecentQueries}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Clock className="h-5 w-5 mr-2" />
          Recent Queries
        </h3>
        <button
          onClick={fetchRecentQueries}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Refresh
        </button>
      </div>

      {recentQueries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent queries found</p>
          <p className="text-sm">Start an analysis to see results here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentQueries.map((query) => (
            <div
              key={query.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => handleLoadQuery(query)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-gray-900 truncate">
                      "{query.query}"
                    </h4>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {query.category}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{query.totalDiscussions} discussions</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4" />
                      <span>{query.totalComments} comments</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(parseISO(query.createdAt), "MMM dd, HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0">
                  <div
                    className="w-2 h-2 bg-green-400 rounded-full"
                    title="Cached result available"
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
