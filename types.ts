export type RedditData = {
  subredditName: string;
  query: string;
  category: string;
  discussions: {
    title: string;
    url: string;
    comments: {
      text: string;
      score: number;
    }[];
  }[];
};
