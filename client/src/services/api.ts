import axios from "axios";
import type {
  AnalysisRequest,
  AnalysisResult,
  AnalysisJob,
} from "../types/analysis";

// Configure axios defaults
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for Reddit analysis
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("API Response Error:", error.response?.data || error.message);

    if (error.response?.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    } else if (error.response?.status >= 500) {
      throw new Error("Server error. Please try again later.");
    } else if (error.code === "ECONNABORTED") {
      throw new Error(
        "Request timeout. The analysis is taking longer than expected."
      );
    }

    throw error;
  }
);

/**
 * Test API connectivity
 */
export async function testAPI(): Promise<{
  success: boolean;
  message: string;
  endpoints: string[];
}> {
  try {
    const response = await api.get("/api/test");
    return response.data;
  } catch (error) {
    console.error("API test failed:", error);
    throw new Error(
      "Failed to connect to API. Please check if the server is running."
    );
  }
}

/**
 * Get available categories
 */
export async function getCategories(): Promise<{
  success: boolean;
  data: Array<{
    value: string;
    label: string;
    subreddits: string[];
  }>;
}> {
  try {
    const response = await api.get("/api/categories");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    throw new Error("Failed to load categories.");
  }
}

/**
 * Start a new Reddit sentiment analysis
 */
export async function analyzeRedditData(
  request: AnalysisRequest
): Promise<AnalysisResult> {
  try {
    console.log("🚀 Sending analysis request:", request);

    const response = await api.post("/api/analyze", request);

    console.log("📥 Raw API response:", response);
    console.log("📊 Response data:", response.data);
    console.log("✅ Response success:", response.data.success);

    if (response.data.data) {
      console.log("📈 Analysis data received:");
      console.log("  - ID:", response.data.data.id);
      console.log("  - Query:", response.data.data.query);
      console.log("  - Category:", response.data.data.category);
      console.log("  - Total Comments:", response.data.data.totalComments);
      console.log(
        "  - Total Discussions:",
        response.data.data.totalDiscussions
      );
      console.log("  - Subreddits:", response.data.data.subreddits);
      console.log(
        "  - Discussions array length:",
        response.data.data.discussions?.length
      );
      console.log(
        "  - First few discussions:",
        response.data.data.discussions?.slice(0, 2)
      );
      console.log("  - Network data:", response.data.data.networkData);
    } else {
      console.warn("⚠️ No data field in response");
    }

    // The backend now returns real data, no need for mock handling
    return response.data;
  } catch (error) {
    console.error("❌ Failed to start analysis:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Failed to start analysis. Please check your connection and try again."
    );
  }
}

/**
 * Check the status of a running analysis job (not implemented yet)
 */
export async function checkJobStatus(jobId: string): Promise<AnalysisJob> {
  try {
    // For now, return a mock completed job since we don't have job endpoints yet
    return {
      id: jobId,
      status: "completed",
      progress: 100,
      message: "Analysis completed",
      data: {
        id: jobId,
        category: "technology",
        query: "test",
        timeframe: "week",
        minPostScore: 50,
        totalComments: 0,
        totalDiscussions: 0,
        scrapedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        discussions: [],
        subreddits: [],
        networkData: {
          nodes: [],
          links: [],
          centerNode: { id: "query", label: "test", type: "query" },
        },
        entities: [],
      },
    };
  } catch (error) {
    console.error("Failed to check job status:", error);
    throw new Error("Failed to check analysis status.");
  }
}

/**
 * Get recent analysis results for dashboard (not implemented yet)
 */
export async function getRecentAnalyses(): Promise<AnalysisResult[]> {
  try {
    // Return empty array for now since we don't have this endpoint yet
    return [];
  } catch (error) {
    console.error("Failed to fetch recent analyses:", error);
    throw new Error("Failed to load recent analyses.");
  }
}

/**
 * Health check for the API
 */
export async function healthCheck(): Promise<{
  status: string;
  timestamp: string;
  message: string;
}> {
  try {
    const response = await api.get("/health");
    return response.data;
  } catch (error) {
    console.error("Health check failed:", error);
    throw new Error("API health check failed.");
  }
}

export default api;
