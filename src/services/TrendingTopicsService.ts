import { genAI } from '../config/config';
import { ApiError } from '../middleware/errorMiddleware';
import { Logger } from '../utils/logger';
import {CleanRedditPost} from "../utils/redditDataCleaner";

const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface TrendingTopic {
    topic: string;
    category: 'Life' | 'Self-improvement' | 'Work' | 'Technology' | 'Software development' | 'AI-Artificial Intelligence' | 'Society' | 'Culture' | 'World' | 'Finance';
    engagementScore: number;
    viralPotential: number;
    mediumSuccessProbability: number;
    keyThemes: string[];
    storyAngles: string[];
    targetAudience: string;
    estimatedReadTime: number;
    hooks: string[];
    relevantPosts?: Array<{
        id: string;
        title: string;
        selftext?: string;
        score: number;
        num_comments: number;
        permalink: string;
    }>; // Full post objects that contributed to this topic
}

interface PostAnalysis {
    posts: any[];
    trendingTopics: TrendingTopic[];
    overallTheme: string;
    bestStoryOpportunity: {
        title: string;
        angle: string;
        whyItWillWork: string;
        relevantPosts?: Array<{
            id: string;
            title: string;
            selftext?: string;
            score: number;
            num_comments: number;
            permalink: string;
        }>;
    };
}

export class TrendingTopicsService {
    private static readonly TRENDING_ANALYSIS_PROMPT = `
    Analyze these Reddit posts to identify trending topics worth writing about on Medium.
    
    Posts data:
    {posts}
    
    For each significant topic found, evaluate:
    1. What category it belongs to (Life/Self-improvement/Work/Technology/Software development/AI-ArtificialIntelligence/Society/Culture/World/Finance)
    2. Engagement metrics (based on scores, comments, discussion quality)
    3. Viral potential on Medium (0-100)
    4. Key themes being discussed
    5. Potential story angles that would resonate on Medium
    6. Target audience for a Medium article
    7. Estimated read time for a comprehensive article
    8. Compelling hooks/headlines
    
    Also provide:
    - Overall theme across all posts
    - The single best story opportunity with title, angle, and why it will succeed
    - For each topic, include the actual posts (max 5) that contributed to it
    
    Consider Medium's audience preferences:
    - Personal growth and self-improvement stories
    - Tech insights and tutorials
    - Life lessons and experiences
    - Career advice and workplace insights
    - Social commentary and cultural observations
    
    Return as JSON:
    {
        "trendingTopics": [
            {
                "topic": "string",
                "category": "category",
                "engagementScore": 0-100,
                "viralPotential": 0-100,
                "mediumSuccessProbability": 0-100,
                "keyThemes": ["theme1", "theme2"],
                "storyAngles": ["angle1", "angle2"],
                "targetAudience": "string",
                "estimatedReadTime": minutes,
                "hooks": ["hook1", "hook2"],
                "relevantPosts": [
                    {
                        "id": "postId",
                        "title": "post title",
                        "selftext": "post content (can be truncated)",
                        "score": number,
                        "num_comments": number,
                        "permalink": "reddit permalink"
                    }
                ]
            }
        ],
        "overallTheme": "string",
        "bestStoryOpportunity": {
            "title": "string",
            "angle": "string",
            "whyItWillWork": "string",
            "relevantPosts": [/* same structure as above */]
        }
    }`;

    static calculateEngagementMetrics(posts: CleanRedditPost[]): any {
        const totalScore = posts.reduce((sum, post) => sum + post.score, 0);
        const totalComments = posts.reduce((sum, post) => sum + post.num_comments, 0);
        const totalAwards = posts.reduce((sum, post) => sum + post.total_awards_received, 0);

        const avgEngagement = posts.length > 0 ? (totalScore + totalComments * 2 + totalAwards *
         10) / posts.length : 0;
        
        // Calculate engagement rate (comments per upvote)
        const engagementRate = totalComments / Math.max(totalScore, 1);
        
        // Find posts with exceptional engagement
        const highEngagementPosts = posts.filter(post => {
            const postEngagement = post.num_comments / Math.max(post.score, 1);
            const hasAwards = post.total_awards_received > 0;
            return postEngagement > engagementRate * 1.5 || hasAwards;
        });

        const topPosts = [...posts]
            .sort((a, b) => {
                const bEngagement = b.score + b.num_comments * 2 + b.total_awards_received * 10;
                const aEngagement = a.score + a.num_comments * 2 + a.total_awards_received * 10;
                return bEngagement - aEngagement;
            }).slice(0, 5)

        const awardPosts = posts.filter(post => post.total_awards_received > 0);
        const avgAwardsPerPost = posts.length > 0 ? totalAwards / posts.length : 0;

        return {
            totalScore,
            totalComments,
            totalAwards,
            avgEngagement: Math.round(avgEngagement),
            engagementRate: Number(engagementRate.toFixed(3)),
            highEngagementCount: highEngagementPosts.length,
            awardPostsCount: awardPosts.length,
            avgAwardsPerPost: Number(avgAwardsPerPost.toFixed(2)),
            topPosts
        };
    }

    static async analyzeTrendingTopics(posts: CleanRedditPost[]): Promise<PostAnalysis> {
        if (!posts || posts.length === 0) {
            throw new ApiError(400, 'No posts to analyze');
        }

        try {
            // Calculate engagement metrics
            const metrics = this.calculateEngagementMetrics(posts);

            // Prepare posts data for analysis
            const postsData = posts.map(post => ({
                title: post.title,
                content: post.selftext?.substring(0, 500) || '',
                score: post.score,
                comments: post.num_comments,
                awards: post.total_awards_received || 0,
                engagement_rate: post.num_comments / Math.max(post.score, 1),
                url: `https://reddit.com${post.permalink}`
            }));

            const prompt = this.TRENDING_ANALYSIS_PROMPT.replace('{posts}', JSON.stringify(postsData));
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const analysisText = response.text();

            try {
                // Extract JSON from response
                let jsonText = analysisText;
                const match = analysisText.match(/```json\n([\s\S]*?)\n```/);
                if (match) {
                    jsonText = match[1];
                }
                
                const analysis = JSON.parse(jsonText);
                
                // Enhance trending topics with engagement metrics
                const enhancedTopics = analysis.trendingTopics.map((topic: TrendingTopic) => ({
                    ...topic,
                    engagementScore: Math.min(100, Math.round(metrics.avgEngagement / 10))
                }));

                Logger.info(`Analyzed ${posts.length} posts, found ${enhancedTopics.length} trending topics`);

                return {
                    posts: metrics.topPosts,
                    trendingTopics: enhancedTopics,
                    overallTheme: analysis.overallTheme,
                    bestStoryOpportunity: analysis.bestStoryOpportunity
                };
            } catch (error) {
                Logger.error('Failed to parse trending topics analysis:', error);
                throw new ApiError(500, 'Failed to parse analysis response');
            }
        } catch (error) {
            Logger.error('Error in trending topics analysis:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Trending analysis service unavailable');
        }
    }

    static async findTrendingInSubreddit(subreddit: string, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<PostAnalysis> {
        // This method would fetch posts from Reddit based on timeframe
        // For now, we'll assume posts are passed from the controller
        throw new Error('Not implemented - use analyzeTrendingTopics directly');
    }
}