import { config } from '../config/config';

interface RedditResponse {
    data: {
        children: Array<{
            data: any;
        }>;
    };
}

interface RedditComment {
    kind: string;
    data: {
        id: string;
        body?: string;
        author?: string;
        created_utc: number;
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
                return [data[0].data.children[0].data];
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
            return data.data.children.map(post => post.data);
        }
    }

    async searchSubreddit(subreddit: string, query: string) {
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
        return data.data.children.map(post => post.data);
    }

    async getPostComments(postId: string, subreddit: string): Promise<any[]> {
        const token = await this.getAccessToken();
        const response = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/comments/${postId}.json`,
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
        return this.parseComments(data[1].data.children);
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
}
