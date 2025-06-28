import { Request, Response } from 'express';
import { RedditPost } from '../models/RedditPost';
import { RedditService } from '../services/RedditService';
import { SentimentAnalysisService } from '../services/SentimentAnalysisService';
import { chunkPosts } from '../utils/batchProcessor';
import { Logger } from '../utils/logger';

export class SearchController {
    private redditService: RedditService;

    constructor() {
        this.redditService = new RedditService();
    }

    async searchWithSentiment(req: Request, res: Response) {
        try {
            const { subreddit, sentiment } = this.parseSubredditAndSentiment(req.query as unknown as string);

            if (!subreddit || !sentiment) {
                return res.status(400).json({ error: 'Missing required parameters' });
            }

            // First check if we have cached analyzed posts
            const cachedPosts = await RedditPost.find({
                subreddit: subreddit,
                processed: true,
                'sentiment.emotions': { $regex: sentiment, $options: 'i' }
            }).sort({ created_utc: -1 }).limit(50);

            if (cachedPosts.length > 0) {
                return res.json(cachedPosts);
            }

            // If not enough cached results, fetch new posts
            const posts = await this.redditService.getSubredditPosts(subreddit as string);
            
            // Process posts in batches
            const batches = chunkPosts(posts);
            const analyzedPosts = [];

            for (const batch of batches) {
                const sentimentResults = await SentimentAnalysisService.analyzeBatch(batch);
                
                const batchResults = await Promise.all(
                    batch.map(async (post: any, index: number) => {
                        const redditPost = new RedditPost({
                            id: post.id,
                            subreddit: post.subreddit,
                            title: post.title,
                            selftext: post.selftext,
                            created_utc: post.created_utc,
                            author: post.author,
                            score: post.score,
                            num_comments: post.num_comments,
                            sentiment: sentimentResults[index],
                            permalink: post.permalink,
                            processed: true
                        });

                        await redditPost.save();
                        return redditPost;
                    })
                );
                
                analyzedPosts.push(...batchResults);
            }

            const filteredPosts = analyzedPosts.filter(post => 
                post.sentiment?.emotions.some((emotion: string) => 
                    emotion.toLowerCase().includes((sentiment as string).toLowerCase())
                )
            );

            // Log query metrics
            Logger.info(`Search completed for query: "${req.query.q}", found ${filteredPosts.length} matching posts`);

            res.json(filteredPosts);
        } catch (error) {
            console.error('Error in sentiment search:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    parseSubredditAndSentiment(query: any): { subreddit: string, sentiment: string } {
        const queryString = query.q || '';
        const match = queryString.match(/^(.*) in r\/([a-zA-Z0-9_]+)$/);
        if (match) {
            const sentiment = match[1].trim();
            const subreddit = match[2].trim();
            return { subreddit, sentiment };
        }
        throw new Error('Invalid query format. Expected format: "sentiment in r/subreddit"');
    }
}
