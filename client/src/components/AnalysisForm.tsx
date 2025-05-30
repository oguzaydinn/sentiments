import { useState } from "react";
import { Search, Clock, Zap, Target } from "lucide-react";
import type { AnalysisRequest, AnalysisResult } from "../types/analysis";
import { analyzeRedditData } from "../services/api";

interface AnalysisFormProps {
  onAnalysisStart: () => void;
  onAnalysisComplete: (result: AnalysisResult) => void;
  isLoading: boolean;
}

const categories = [
  { value: "technology", label: "Technology" },
  { value: "science", label: "Science" },
  { value: "politics", label: "Politics" },
  { value: "finance", label: "Finance" },
  { value: "gaming", label: "Gaming" },
  { value: "health", label: "Health" },
  { value: "entertainment", label: "Entertainment" },
  { value: "sports", label: "Sports" },
  { value: "worldnews", label: "World News" },
  { value: "business", label: "Business" },
];

const timeframes = [
  { value: "hour", label: "Past Hour" },
  { value: "day", label: "Past Day" },
  { value: "week", label: "Past Week" },
  { value: "month", label: "Past Month" },
  { value: "year", label: "Past Year" },
];

export default function AnalysisForm({
  onAnalysisStart,
  onAnalysisComplete,
  isLoading,
}: AnalysisFormProps) {
  const [formData, setFormData] = useState<AnalysisRequest>({
    category: "technology",
    query: "",
    timeframe: "week",
    minPostScore: 50,
    includeEntities: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.query.trim()) {
      alert("Please enter a search query");
      return;
    }

    console.log("🎯 Starting analysis with form data:", formData);
    onAnalysisStart();

    try {
      console.log("📡 Calling analyzeRedditData...");
      const result = await analyzeRedditData(formData);

      console.log("🎉 Analysis result received:", result);
      console.log("📋 Result success:", result.success);
      console.log("💾 Result cached:", result.cached);
      console.log("📊 Result data:", result.data);

      if (result.success && result.data) {
        console.log("✅ Calling onAnalysisComplete with result");
        onAnalysisComplete(result);
      } else {
        console.error("❌ Analysis result indicates failure:", result);
        alert("Analysis failed: " + (result.message || "Unknown error"));
        onAnalysisComplete({
          success: false,
          cached: false,
          data: {} as any,
        });
      }
    } catch (error) {
      console.error("💥 Analysis failed with exception:", error);
      alert("Failed to start analysis. Please try again.");
      onAnalysisComplete({
        success: false,
        cached: false,
        data: {} as any,
      });
    }
  };

  const handleInputChange = (field: keyof AnalysisRequest, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="card max-w-5xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Configure Network Analysis
        </h3>
        <p className="text-sm text-gray-600">
          Set your search parameters to explore Reddit sentiment networks
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Search Query */}
          <div className="md:col-span-2">
            <label
              htmlFor="query"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span>Search Query</span>
              </div>
            </label>
            <input
              type="text"
              id="query"
              value={formData.query}
              onChange={(e) => handleInputChange("query", e.target.value)}
              placeholder="e.g., artificial intelligence, climate change, cryptocurrency"
              className="input-field"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Keywords to search across Reddit discussions
            </p>
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4" />
                <span>Category</span>
              </div>
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="input-field"
              disabled={isLoading}
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label
              htmlFor="timeframe"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span>Time Range</span>
              </div>
            </label>
            <select
              id="timeframe"
              value={formData.timeframe}
              onChange={(e) => handleInputChange("timeframe", e.target.value)}
              className="input-field"
              disabled={isLoading}
            >
              {timeframes.map((tf) => (
                <option key={tf.value} value={tf.value}>
                  {tf.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Min Post Score */}
          <div>
            <label
              htmlFor="minPostScore"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Minimum Post Score (Upvotes)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                id="minPostScore"
                min="0"
                max="500"
                step="10"
                value={formData.minPostScore}
                onChange={(e) =>
                  handleInputChange("minPostScore", parseInt(e.target.value))
                }
                className="flex-1"
                disabled={isLoading}
              />
              <div className="bg-gray-100 px-3 py-1 rounded text-sm font-medium min-w-[60px] text-center">
                {formData.minPostScore}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Only analyze posts with this many upvotes or more (default: 50)
            </p>
          </div>

          {/* Include Entities */}
          <div className="flex items-center">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.includeEntities}
                onChange={(e) =>
                  handleInputChange("includeEntities", e.target.checked)
                }
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Include Entity Analysis
                </span>
                <p className="text-xs text-gray-500">
                  Extract people, organizations, and locations for richer
                  network data
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Progress Bar */}
        {isLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Building Network...</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full transition-all duration-300"></div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-center pt-4">
          <button
            type="submit"
            disabled={isLoading || !formData.query.trim()}
            className="btn-primary flex items-center space-x-2 px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="h-5 w-5" />
            <span>
              {isLoading
                ? "Building Network..."
                : "Create Network Visualization"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
