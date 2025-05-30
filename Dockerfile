# Multi-stage build for Reddit Sentiment Network Analysis
FROM oven/bun:1 AS frontend-builder

# Build frontend
WORKDIR /app/client
COPY client/package.json client/bun.lock* ./
RUN bun install --frozen-lockfile

COPY client/ ./

# Set API URL to relative path since frontend and backend are served from same container
ENV VITE_API_URL=""

RUN bun run build

# Backend stage
FROM oven/bun:1 AS backend

WORKDIR /app

# Copy backend files
COPY server/package.json server/bun.lock* ./
RUN bun install

COPY server/ ./

# Copy built frontend to backend's public directory
COPY --from=frontend-builder /app/client/dist ./public

# Generate Prisma client
RUN bunx prisma generate

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the server (it will serve both API and static frontend)
CMD ["bun", "run", "server.ts"] 