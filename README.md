# Reddit Sentiment Network Analysis Tool

A comprehensive web application for analyzing public sentiment and extracting named entities from Reddit discussions, featuring interactive network visualizations and persistent data storage.

## Features

### 🌐 Web Application Architecture

- **React Frontend**: Interactive web interface with real-time visualizations
- **Hono Backend API**: Fast, lightweight server with RESTful endpoints
- **Database Persistence**: MongoDB with Prisma ORM for data caching and storage
- **Network Visualizations**: D3.js-powered interactive network graphs

### 📊 Core Analysis

- **Reddit Integration**: Fetches comments from curated subreddits based on categories and search queries
- **Sentiment Analysis**: VADER sentiment analysis with score-weighted averaging
- **Text Preprocessing**: Advanced text cleaning, normalization, and preprocessing
- **Multi-Subreddit Analysis**: Analyzes discussions across multiple subreddits simultaneously

### 🔍 Entity Recognition & Analysis

- **Named Entity Recognition (NER)**: Extracts persons, organizations, and locations using compromise.js
- **Entity Sentiment Analysis**: Analyzes sentiment specifically about each mentioned entity
- **Entity Filtering**: Advanced filtering with confidence thresholds and blocklists
- **Entity Visualization**: Shows top entities per subreddit with mention counts and sentiment

### 📈 Interactive Visualizations

- **Network Overview**: Shows relationships between query, subreddits, and topics
- **Topic Expansion**: Click topics to view detailed comment trees with reply chains
- **Sentiment Color Coding**: Visual representation of positive/negative/neutral sentiment
- **Interactive Tooltips**: Hover for detailed information about nodes
- **Responsive Design**: Optimized for different screen sizes

### 💾 Data Management

- **Caching System**: 24-hour cache for analysis results to improve performance
- **Recent Queries**: View and reload previous analyses
- **Automatic Cleanup**: Removes analyses older than 7 days
- **Structured Storage**: Organized data storage with Prisma schema

## Installation & Setup

### Prerequisites

- [Bun](https://bun.sh/) runtime
- MongoDB Atlas account (or local MongoDB)
- Reddit API credentials

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SWE599
```

### 2. Backend Setup

```bash
cd server
bun install
```

### 3. Frontend Setup

```bash
cd ../client
bun install
```

### 4. Environment Configuration

Create a `.env` file in the `server/` directory based on the example below:

```env
# Reddit API Credentials
CLIENT_ID=your_reddit_client_id
CLIENT_SECRET=your_reddit_client_secret
USER_AGENT=your_app_name/1.0 by your_username
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password

# Database Configuration
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority&appName=your_app

# Server Configuration
PORT=3001
```

### 5. Database Setup

```bash
cd server
bunx prisma generate
bunx prisma db push
```

## Running the Application

### Development Mode

**Start the backend server:**

```bash
cd server
bun run dev
```

**Start the frontend (in a new terminal):**

```bash
cd client
bun run dev
```

The application will be available at:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Production Mode

**Build and start backend:**

```bash
cd server
bun run build
bun start
```

**Build and serve frontend:**

```bash
cd client
bun run build
bun run preview
```

## API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `GET /api/test` - API test endpoint
- `POST /api/analyze` - Start Reddit analysis
- `GET /api/categories` - Get available categories

### Data Management

- `GET /api/recent` - Get recent queries
- `GET /api/analysis/:id` - Get analysis by ID
- `POST /api/cleanup` - Cleanup old analyses

### Analysis Parameters

```json
{
  "query": "search term",
  "category": "technology|science|politics|finance|gaming|health|entertainment|sports|education|lifestyle|business|social"
  "timeframe": "hour|day|week|month|year|all",
  "minPostScore": 50,
  "includeEntities": true
}
```

## Available Categories

| Category          | Subreddits                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| **technology**    | technology, Futurology, OpenAI, artificial, MachineLearning, programming, coding, webdev, devops, cybersecurity    |
| **science**       | science, Physics, Space, chemistry, biology, math, astronomy, neuroscience, geology, environment                   |
| **politics**      | politics, worldnews, geopolitics, europe, news, politicaldiscussion, conservative, liberal, democrats, republicans |
| **finance**       | finance, cryptocurrency, stocks, investing, personalfinance, wallstreetbets, economics, bitcoin, ethereum, trading |
| **gaming**        | gaming, pcgaming, gamedev, PS5, XboxSeriesX, NintendoSwitch, Steam, indiegaming, esports, gamingnews               |
| **health**        | health, medicine, Fitness, nutrition, mentalhealth, yoga, weightlifting, running, diet, wellness                   |
| **entertainment** | movies, television, music, books, comics, anime, netflix, marvel, starwars, gaming                                 |
| **sports**        | sports, nba, nfl, soccer, baseball, hockey, tennis, formula1, golf, cricket                                        |
| **education**     | education, college, university, teaching, learnprogramming, math, science, history, philosophy, literature         |
| **lifestyle**     | food, travel, fashion, beauty, home, gardening, cooking, photography, art, design                                  |
| **business**      | business, entrepreneur, startups, marketing, sales, smallbusiness, consulting, management, careers, jobs           |
| **social**        | socialmedia, privacy, technology, internet, webdev, programming, cybersecurity, datahoarder, netsec, hacking       |

## Usage Examples

### Web Interface

1. **Open the application** at http://localhost:5173
2. **Select a category** from the dropdown
3. **Enter a search query** (e.g., "ChatGPT", "election", "climate change")
4. **Configure parameters** (timeframe, minimum score)
5. **Enable entity analysis** if desired
6. **Click "Start Analysis"** to begin
7. **Explore the network visualization** - click topics to expand comment trees
8. **View recent queries** to reload previous analyses

### API Usage

**Start an analysis:**

```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "query": "gta vi",
    "category": "gaming",
    "timeframe": "week",
    "minPostScore": 100,
    "includeEntities": true
  }'
```

**Get recent analyses:**

```bash
curl http://localhost:3001/api/recent?limit=5
```

## Technology Stack

### Backend

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: MongoDB with Prisma ORM
- **Reddit API**: snoowrap
- **Sentiment Analysis**: vader-sentiment
- **Entity Recognition**: compromise.js
- **Language**: TypeScript

### Frontend

- **Framework**: React with TypeScript
- **Visualization**: D3.js
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Build Tool**: Vite

### Database Schema

```prisma
model RedditAnalysis {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  createdAt         DateTime @default(now())
  query             String
  category          String
  timeframe         String
  minScore          Int
  totalComments     Int
  totalDiscussions  Int
  discussions       Json
  sentimentAnalysis Json?
  entityAnalysis    Json?
  EntityChain       EntityChain[]
}

model EntityChain {
  id               String @id @default(auto()) @map("_id") @db.ObjectId
  analysisId       String @db.ObjectId
  entityText       String
  entityType       String
  normalizedText   String
  totalMentions    Int
  totalScore       Int
  averageSentiment Json
  sentimentTrend   Json[]
}
```

## Features in Detail

### Network Visualization

- **Overview Mode**: Shows query → subreddits → topics relationships
- **Topic Expansion**: Click any topic to see its comment tree
- **Interactive Elements**: Drag nodes, hover for tooltips, click to navigate
- **Sentiment Visualization**: Color-coded nodes (green=positive, red=negative, gray=neutral)

### Entity Analysis

- **Smart Filtering**: Removes common words, numbers, and URLs
- **Confidence Scoring**: Only includes high-confidence entity extractions
- **Sentiment Context**: Analyzes sentiment specifically about each entity
- **Subreddit Breakdown**: Shows which entities are discussed in which subreddits

### Caching & Performance

- **24-Hour Cache**: Avoids re-fetching identical queries
- **Database Storage**: Persistent storage for all analyses
- **Automatic Cleanup**: Removes old data to manage storage
- **Optimized Queries**: Efficient database indexing and querying

## Data Output Structure

### Analysis Result

```json
{
  "success": true,
  "cached": false,
  "data": {
    "query": "artificial intelligence",
    "category": "ai",
    "totalComments": 1250,
    "totalDiscussions": 45,
    "discussions": [...],
    "entities": [...],
    "entityAnalysis": {...}
  }
}
```

### Entity Data

```json
{
  "entity": {
    "text": "OpenAI",
    "type": "ORGANIZATION",
    "normalizedText": "openai"
  },
  "totalMentions": 15,
  "totalScore": 1200,
  "averageSentiment": {
    "original": {
      "compound": 0.6,
      "pos": 0.7,
      "neu": 0.2,
      "neg": 0.1
    }
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:

1. Check the API health endpoint: http://localhost:3001/health
2. Review server logs for error messages
3. Ensure all environment variables are properly set
4. Verify MongoDB connection and database permissions
