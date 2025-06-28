export interface RedditPost {
    id: string;
    subreddit: string;
    title: string;
    selftext?: string;
    created_utc: number;
    author: string;
    score: number;
    num_comments: number;
    sentiment?: {
        label: 'positive' | 'negative' | 'neutral';
        score: number;
        emotions: string[];
        analysis: string;
    };
    permalink: string;
    processed: boolean;
}
