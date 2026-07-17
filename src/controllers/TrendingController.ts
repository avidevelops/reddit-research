import { Request, Response } from 'express';
import { RedditService } from '../services/RedditService';
import { ReferenceMaterialService } from '../services/ReferenceMaterialService';
import { TrendingTopicsService } from '../services/TrendingTopicsService';
import { Logger } from '../utils/logger';

export class TrendingController {
    private redditService: RedditService;
    private referenceMaterialService: ReferenceMaterialService;

    constructor() {
        this.redditService = new RedditService();
        this.referenceMaterialService = new ReferenceMaterialService();
    }

    async getTrendingTopics(req: Request, res: Response) {
        try {
            const { subreddit } = req.params;
            const limit = Number(req.query.limit) || 50;
            const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'week';
            const gatherReferences = req.query.gatherReferences === 'true';
            const topicsToGather = Number(req.query.topicsToGather) || 3;

            if (!subreddit) {
                return res.status(400).json({ error: 'Subreddit parameter is required' });
            }

            Logger.info(`Fetching trending topics from r/${subreddit}${gatherReferences ? ' with references' : ''}`);

            // Fetch posts from Reddit
            const posts = await this.redditService.getSubredditPosts(subreddit, limit);
            
            // Filter posts based on timeframe
            const now = Date.now() / 1000;
            const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
            const cutoffTime = now - (timeframeDays * 24 * 60 * 60);
            
            const recentPosts = posts.filter(post => post.created_utc >= cutoffTime);

            if (recentPosts.length === 0) {
                return res.json({
                    message: 'No recent posts found in the specified timeframe',
                    subreddit,
                    timeframe,
                    posts: []
                });
            }

            // Analyze trending topics
            const analysis = await TrendingTopicsService.analyzeTrendingTopics(recentPosts);

            Logger.info(`Found ${analysis.trendingTopics.length} trending topics in r/${subreddit}`);

            // Gather references if requested
            let references: any[] = [];
            if (gatherReferences && analysis.trendingTopics.length > 0) {
                Logger.info(`Gathering references for top ${topicsToGather} topics`);
                
                // Get top topics by Medium success probability
                const topTopics = analysis.trendingTopics
                    .sort((a, b) => b.mediumSuccessProbability - a.mediumSuccessProbability)
                    .slice(0, topicsToGather);

                for (const topic of topTopics) {
                    try {
                        const referenceMaterial = await this.referenceMaterialService.gatherReferenceMaterial(
                            topic.topic,
                            (topic.relevantPosts?.map(rp => rp.id) || analysis.posts.slice(0, 5).map(post => post.id)),
                            subreddit
                        );

                        // Save the reference material
                        await this.referenceMaterialService.saveReferenceMaterial(referenceMaterial);

                        references.push({
                            topic: topic.topic,
                            topicData: topic,
                            referenceSummary: {
                                keyInsights: referenceMaterial.keyInsights.length,
                                quotableComments: referenceMaterial.quotableComments.length,
                                painPoints: referenceMaterial.commonPainPoints.length,
                                successStories: referenceMaterial.successStories.length,
                                postsAnalyzed: referenceMaterial.sourcePosts.length
                            },
                            referenceMaterial
                        });
                    } catch (error) {
                        Logger.error(`Failed to gather references for topic "${topic.topic}":`, error);
                    }
                }
            }

            res.json({
                subreddit,
                timeframe,
                postsAnalyzed: recentPosts.length,
                ...analysis,
                ...(gatherReferences ? { references } : {})
            });
        } catch (error) {
            Logger.error('Error in trending topics analysis:', error);
            res.status(500).json({ error: 'Failed to analyze trending topics' });
        }
    }

    async gatherReferences(req: Request, res: Response) {
        try {
            const { subreddit } = req.params;
            const { topic, postIds } = req.body;

            if (!subreddit || !topic || !postIds || !Array.isArray(postIds)) {
                return res.status(400).json({ 
                    error: 'Missing required parameters. Need subreddit, topic, and postIds array.' 
                });
            }

            Logger.info(`Gathering reference material for topic "${topic}" in r/${subreddit}`);

            // Gather reference material
            const referenceMaterial = await this.referenceMaterialService.gatherReferenceMaterial(
                topic,
                postIds,
                subreddit
            );

            // Save the reference material
            const filepath = await this.referenceMaterialService.saveReferenceMaterial(referenceMaterial);

            res.json({
                success: true,
                topic,
                subreddit,
                postsAnalyzed: referenceMaterial.sourcePosts.length,
                totalComments: referenceMaterial.sourcePosts.reduce((sum, p) => sum + p.comments.length, 0),
                filepath,
                summary: {
                    keyInsights: referenceMaterial.keyInsights.length,
                    quotableComments: referenceMaterial.quotableComments.length,
                    painPoints: referenceMaterial.commonPainPoints.length,
                    successStories: referenceMaterial.successStories.length
                },
                referenceMaterial
            });
        } catch (error) {
            Logger.error('Error gathering reference material:', error);
            res.status(500).json({ error: 'Failed to gather reference material' });
        }
    }

    async getMultiSubredditTrends(req: Request, res: Response) {
        try {
            const subreddits = req.query.subreddits?.toString().split(',') || [];
            const limit = Number(req.query.limit) || 25;
            const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'week';
            const gatherReferences = req.query.gatherReferences === 'true';
            const topicsToGather = Number(req.query.topicsToGather) || 2;

            if (subreddits.length === 0) {
                return res.status(400).json({ error: 'At least one subreddit must be specified' });
            }

            Logger.info(`Analyzing trends across ${subreddits.length} subreddits${gatherReferences ? ' with references' : ''}`);

            const allAnalyses = [];
            
            for (const subreddit of subreddits) {
                try {
                    const posts = await this.redditService.getSubredditPosts(subreddit.trim(), limit);
                    
                    // Filter by timeframe
                    const now = Date.now() / 1000;
                    const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
                    const cutoffTime = now - (timeframeDays * 24 * 60 * 60);
                    const recentPosts = posts.filter(post => post.created_utc >= cutoffTime);

                    if (recentPosts.length > 0) {
                        const analysis = await TrendingTopicsService.analyzeTrendingTopics(recentPosts);
                        allAnalyses.push({
                            subreddit: subreddit.trim(),
                            // posts: recentPosts,
                            ...analysis
                        });
                    }
                } catch (error) {
                    Logger.error(`Failed to analyze r/${subreddit}:`, error);
                }
            }

            // Aggregate and rank all trending topics
            const allTopics = allAnalyses.flatMap(a => 
                a.trendingTopics.map(topic => ({
                    ...topic,
                    source: a.subreddit,
                    sourcePosts: a.posts
                }))
            );

            // Sort by Medium success probability
            const topTopics = allTopics.sort((a, b) => 
                b.mediumSuccessProbability - a.mediumSuccessProbability
            ).slice(0, 10);

            // Gather references if requested
            let references: any[] = [];
            if (gatherReferences && topTopics.length > 0) {
                Logger.info(`Gathering references for top ${topicsToGather} topics across subreddits`);
                
                const topicsForReferences = topTopics.slice(0, topicsToGather);

                for (const topic of topicsForReferences) {
                    try {
                        const referenceMaterial = await this.referenceMaterialService.gatherReferenceMaterial(
                            topic.topic,
                            (topic.relevantPosts?.map(rp => rp.id) || topic.sourcePosts.slice(0, 5).map(post => post.id)),
                            topic.source
                        );

                        // Save the reference material
                        await this.referenceMaterialService.saveReferenceMaterial(referenceMaterial);

                        references.push({
                            topic: topic.topic,
                            source: topic.source,
                            topicData: topic,
                            referenceSummary: {
                                keyInsights: referenceMaterial.keyInsights.length,
                                quotableComments: referenceMaterial.quotableComments.length,
                                painPoints: referenceMaterial.commonPainPoints.length,
                                successStories: referenceMaterial.successStories.length,
                                postsAnalyzed: referenceMaterial.sourcePosts.length
                            },
                            referenceMaterial
                        });
                    } catch (error) {
                        Logger.error(`Failed to gather references for topic "${topic.topic}" from r/${topic.source}:`, error);
                    }
                }
            }

            // Clean up sourcePosts from topTopics before sending response
            const cleanedTopTopics = topTopics.map(({ sourcePosts, ...topic }) => topic);

            res.json({
                subreddits,
                timeframe,
                totalSubredditsAnalyzed: allAnalyses.length,
                topTrendingTopics: cleanedTopTopics,
                bySubreddit: allAnalyses.map(({ posts, ...analysis }) => analysis),
                ...(gatherReferences ? { references } : {})
            });
        } catch (error) {
            Logger.error('Error in multi-subreddit analysis:', error);
            res.status(500).json({ error: 'Failed to analyze trends across subreddits' });
        }
    }
}
