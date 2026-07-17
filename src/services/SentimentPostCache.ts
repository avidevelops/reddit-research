import { CleanRedditPost } from '../utils/redditDataCleaner';
import { InMemoryCache } from './InMemoryCache';

export interface CachedSentimentPost extends CleanRedditPost {
    processed: true;
    sentiment: {
        label: 'positive' | 'negative' | 'neutral';
        score: number;
        emotions: string[];
        analysis: string;
    };
}

class SentimentPostCache {
    private readonly cache = new InMemoryCache<CachedSentimentPost>(30 * 24 * 60 * 60 * 1000, 2_000);

    find(subreddit: string, sentiment: string, limit = 50): CachedSentimentPost[] {
        const needle = sentiment.toLowerCase();
        return this.cache.values()
            .filter(post => post.subreddit.toLowerCase() === subreddit.toLowerCase())
            .filter(post => post.sentiment.emotions.some(emotion => emotion.toLowerCase().includes(needle)))
            .sort((a, b) => b.created_utc - a.created_utc)
            .slice(0, limit);
    }

    save(post: CachedSentimentPost): void {
        this.cache.set(post.id, post);
    }
}

export const sentimentPostCache = new SentimentPostCache();
