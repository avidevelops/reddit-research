// src/utils/redditDataCleaner.ts

export interface CleanRedditPost {
    id: string;
    title: string;
    author: string;
    subreddit: string;
    selftext: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
    url?: string;
    upvote_ratio: number;
    link_flair_text?: string;
    total_awards_received: number;
    all_awardings: any[];
    gilded: number;
}

export interface CleanRedditComment {
    id: string;
    body: string;
    author: string;
    score?: number;
    created_utc: number;
    replies: CleanRedditComment[];
}

export class RedditDataCleaner {
    /**
     * Clean a single Reddit post, keeping only essential fields
     */
    static cleanPost(rawPost: any): CleanRedditPost {
        return {
            id: rawPost.id,
            title: rawPost.title,
            author: rawPost.author,
            subreddit: rawPost.subreddit,
            selftext: rawPost.selftext || '',
            score: rawPost.score,
            num_comments: rawPost.num_comments,
            created_utc: rawPost.created_utc,
            permalink: rawPost.permalink,
            url: rawPost.url,
            upvote_ratio: rawPost.upvote_ratio || 0,
            link_flair_text: rawPost.link_flair_text,
            total_awards_received: rawPost.total_awards_received || 0,
            all_awardings: rawPost.all_awardings || [],
            gilded: rawPost.gilded || 0
        };
    }

    /**
     * Clean an array of Reddit posts
     */
    static cleanPosts(rawPosts: any[]): CleanRedditPost[] {
        return rawPosts.map(post => this.cleanPost(post));
    }

    /**
     * Clean Reddit comments recursively
     */
    static cleanComment(rawComment: any): CleanRedditComment {
        return {
            id: rawComment.id,
            body: rawComment.body || '',
            author: rawComment.author || '[deleted]',
            score: rawComment.score,
            created_utc: rawComment.created_utc,
            replies: rawComment.replies ?
                rawComment.replies.map((reply: any) => this.cleanComment(reply)) : []
        };
    }

    /**
     * Clean an array of comments
     */
    static cleanComments(rawComments: any[]): CleanRedditComment[] {
        return rawComments.map(comment => this.cleanComment(comment));
    }

    /**
     * Calculate engagement metrics from cleaned posts
     */
    static calculateEngagementMetrics(posts: CleanRedditPost[]) {
        const totalScore = posts.reduce((sum, post) => sum + post.score, 0);
        const totalComments = posts.reduce((sum, post) => sum + post.num_comments, 0);
        const avgEngagement = posts.length > 0 ? (totalScore + totalComments * 2) / posts.length : 0;

        // Calculate engagement rate (comments per upvote)
        const engagementRate = totalScore > 0 ? totalComments / totalScore : 0;

        // Find posts with exceptional engagement
        const highEngagementPosts = posts.filter(post => {
            const postEngagement = post.score > 0 ? post.num_comments / post.score : 0;
            return postEngagement > engagementRate * 1.5;
        });

        // Sort posts by engagement (score + comments * 2)
        const topPosts = [...posts]
            .sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2))
            .slice(0, 5);

        return {
            totalScore,
            totalComments,
            avgEngagement: Math.round(avgEngagement),
            engagementRate: Number(engagementRate.toFixed(3)),
            highEngagementCount: highEngagementPosts.length,
            topPosts
        };
    }
}