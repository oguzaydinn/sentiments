# Sentiments

A sentiment analysis tool designed to monitor and analyze public sentiment on social media platforms in response to specific news and events.

## v0.0.1 Features

- **Reddit Integration**: Fetches comments from subreddits such as `r/artificial`, `r/agi`, `r/MachineLearning`, and `r/OpenAI` based on a specified search query.
- **Sentiment Analysis Preparation**: Collects and formats data for subsequent sentiment analysis.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/oguzaydinn/sentiments.git
   cd sentiments
   ```

2. **Install Dependencies**:
   This project uses [Bun](https://bun.sh/) as the package manager. Ensure Bun is installed, then run:
   ```bash
   bun install
   ```

## Usage

1. **Set the Search Query**:
   In the `reddit.ts` file, modify the `searchQuery` variable to specify the term you want to search for.

2. **Run the Application**:
   ```bash
   bun run index.ts
   ```
   This will search the specified subreddits for the `searchQuery` term and save the data to `reddit_comments.json`.

3. **Example Data**:
   Refer to `example.jsonc` for sample comments that illustrate the data format prior to sentiment analysis.

## Dependencies

- **Languages**: TypeScript
- **Package Manager**: Bun
- **Libraries**:
  - `snoowrap`: For Reddit API interactions
  - `axios`: For HTTP requests
