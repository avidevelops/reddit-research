import { config } from '../config/config';
import {CleanRedditComment, CleanRedditPost, RedditDataCleaner} from "../utils/redditDataCleaner";

interface RedditResponse {
    data: {
        children: Array<{
            data: any;
        }>;
        after?: string | null;  // Add this for pagination
        before?: string | null; // Optional: for backward pagination
    };
}

interface RedditComment {
    kind: string;
    data: {
        id: string;
        body?: string;
        author?: string;
        created_utc: number;
        score?: number;
        replies?: {
            data?: {
                children: RedditComment[];
            };
        };
    };
}

interface ParsedComment {
    id: string;
    body?: string;
    author?: string;
    created_utc: number;
    score?: number;
    replies: ParsedComment[];
}

export class RedditService {
    private accessToken: string | null = null;
    private tokenExpiration: number = 0;

    private async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiration) {
            return this.accessToken;
        }

        const basicAuth = Buffer.from(
            `${config.reddit.clientId}:${config.reddit.clientSecret}`
        ).toString('base64');

        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: new Headers({
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            }),
            body: 'grant_type=client_credentials',
        });

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiration = Date.now() + (data.expires_in * 1000);
        return this.accessToken;
    }

    /**
     * Fetches posts from a subreddit. If postId is provided, fetches only that post.
     */
    async getSubredditPosts(subreddit: string, limit: number = 50, postId?: string) {
        const token = await this.getAccessToken();
        if (postId) {
            // Fetch a single post by id
            const response = await fetch(
                `https://oauth.reddit.com/r/${subreddit}/comments/${postId}.json?limit=1`,
                {
                    headers: new Headers({
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': config.reddit.userAgent || '',
                    }),
                }
            );
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0 && data[0].data && data[0].data.children.length > 0) {
                // Return the post as an array for consistency
                return [RedditDataCleaner.cleanPost(data[0].data.children[0].data)];
            }
            return [];
        } else {
            // Fetch multiple posts
            const response = await fetch(
                `https://oauth.reddit.com/r/${subreddit}/new.json?limit=${limit}`,
                {
                    headers: new Headers({
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': config.reddit.userAgent || '',
                    }),
                }
            );
            const data = await response.json() as RedditResponse;
            const rawPosts = data.data.children.map(post => post.data);
            return RedditDataCleaner.cleanPosts(rawPosts);
        }
    }

    async getPostById(postId: string): Promise<CleanRedditPost | null> {
        const token = await this.getAccessToken();
        const response = await fetch(
            `https://oauth.reddit.com/api/info?id=t3_${encodeURIComponent(postId)}`,
            {
                headers: new Headers({
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': config.reddit.userAgent || '',
                }),
            }
        );

        const data = await response.json() as RedditResponse;
        const rawPost = data.data?.children?.[0]?.data;
        return rawPost ? RedditDataCleaner.cleanPost(rawPost) : null;
    }

    async resolveRedditPostUrl(url: string): Promise<string> {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: new Headers({
                'User-Agent': config.reddit.userAgent || '',
            }),
        });
        return response.url;
    }

    async searchSubreddit(subreddit: string, query: string): Promise<CleanRedditPost[]> {
        const token = await this.getAccessToken();
        const response = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=true`,
            {
                headers: new Headers({
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': config.reddit.userAgent || '',
                }),
            }
        );

        const data = await response.json() as RedditResponse;
        const rawPosts = data.data.children.map(post => post.data);
        return RedditDataCleaner.cleanPosts(rawPosts);
    }

    async getPostComments(
        postId: string,
        subreddit: string,
        sort: 'best' | 'top' | 'controversial' | 'qa' | 'new' = 'best',
    ): Promise<CleanRedditComment[]> {
        const token = await this.getAccessToken();
        const response = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/comments/${postId}.json?sort=${sort}`,
            {
                headers: new Headers({
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': config.reddit.userAgent || '',
                }),
            }
        );

        const data = await response.json();
        if (!Array.isArray(data) || data.length < 2) {
            return [];
        }

        // data[0] contains the post, data[1] contains the comments
        const rawComments = this.parseComments(data[1].data.children);
        return RedditDataCleaner.cleanComments(rawComments);
    }

    private parseComments(comments: RedditComment[]): ParsedComment[] {
        return comments
            .map(comment => {
                if (comment.kind === 'more') {
                    return null; // Skip "load more comments" entries
                }

                const parsed: ParsedComment = {
                    id: comment.data.id,
                    body: comment.data.body,
                    author: comment.data.author,
                    created_utc: comment.data.created_utc,
                    score: comment.data.score,
                    replies: [],
                };

                // Recursively parse replies if they exist
                if (comment.data.replies && comment.data.replies.data) {
                    parsed.replies = this.parseComments(comment.data.replies.data.children);
                }

                return parsed;
            })
            .filter((c): c is ParsedComment => c !== null); // Remove null entries and narrow type
    }

    /**
     * Fetches posts from a subreddit within a specific timeframe using Reddit's search API
     * @param subreddit - The subreddit name
     * @param afterTimestamp - Unix timestamp for the start of the time range
     * @param beforeTimestamp - Unix timestamp for the end of the time range
     * @param limit - Optional limit for the number of posts (if not provided, fetches all in timeframe)
     */
    async getSubredditPostsByTimeframe(
        subreddit: string,
        afterTimestamp: number,
        beforeTimestamp: number,
        limit?: number
    ) : Promise<CleanRedditPost[]> {
        const token = await this.getAccessToken();

        // Reddit uses cloudsearch syntax for timestamp queries
        const query = `timestamp:${afterTimestamp}..${beforeTimestamp}`;

        // Build the URL with search parameters
        const params = new URLSearchParams({
            q: query,
            restrict_sr: 'true',
            sort: 'new',
            syntax: 'cloudsearch',
            ...(limit && { limit: limit.toString() })
        });

        const response = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/search.json?${params}`,
            {
                headers: new Headers({
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': config.reddit.userAgent || '',
                }),
            }
        );

        const data = await response.json() as RedditResponse;

        if (!data.data || !data.data.children) {
            return [];
        }

        const rawPosts = data.data.children.map(post => post.data);
        return RedditDataCleaner.cleanPosts(rawPosts);
    }

    /**
     * Alternative method using the regular posts endpoint with time-based sorting
     * This is more reliable but requires pagination for complete results
     */
    async getSubredditPostsByTimeframeAlternative(
        subreddit: string,
        afterTimestamp: number,
        beforeTimestamp: number,
        limit?: number
    ): Promise<CleanRedditPost[]> {
        const token = await this.getAccessToken();
        const allPosts: any[] = [];
        let after: string | null = null;
        const maxIterations = 10; // Prevent infinite loops
        let iterations = 0;

        // If no limit specified, we'll fetch up to 1000 posts
        const targetCount = limit || 1000;

        while (allPosts.length < targetCount && iterations < maxIterations) {
            const batchSize = Math.min(100, targetCount - allPosts.length);

            const params = new URLSearchParams({
                limit: batchSize.toString(),
                raw_json: '1',
            });

            if (after) {
                params.append('after', after);
            }

            const response = await fetch(
                `https://oauth.reddit.com/r/${subreddit}/new.json?${params}`,
                {
                    headers: new Headers({
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': config.reddit.userAgent || '',
                    }),
                }
            );

            const data = await response.json() as RedditResponse;

            if (!data.data || !data.data.children || data.data.children.length === 0) {
                break;
            }

            // Filter posts by timestamp
            const postsInRange = data.data.children
                .map(post => post.data)
                .filter(post =>
                    post.created_utc >= afterTimestamp &&
                    post.created_utc <= beforeTimestamp
                );

            allPosts.push(...postsInRange);

            // Check if we've gone past our time range
            const oldestPost = data.data.children[data.data.children.length - 1]?.data;
            if (oldestPost && oldestPost.created_utc < afterTimestamp) {
                break;
            }

            // Set up for next iteration
            if (data.data.after) {
                after = data.data.after;
                if (!after) break;
            } else {
                break;
            }

            iterations++;
        }

        return RedditDataCleaner.cleanPosts(allPosts.slice(0, targetCount));
    }
}
