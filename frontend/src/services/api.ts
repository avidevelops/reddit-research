import axios from 'axios';

import { config } from '../config';

const API_URL = config.apiUrl;

export const searchReddit = async (query: string): Promise<RedditPost[]> => {
    const response = await axios.get(`${API_URL}/search`, {
        params: { q: query }
    });
    return response.data;
};

export const analyzeSentiment = async (text: string) => {
    const response = await axios.post(`${API_URL}/analyze`, { text });
    return response.data;
};

// Add these to your existing frontend/src/services/api.ts file

export interface RedditPost {
    id: string;
    title: string;
    selftext?: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
}

export interface ReferenceMaterial {
    topicId: string;
    topic: string;
    sourcePosts: unknown[];
    keyInsights: string[];
    quotableComments: Array<{
        text: string;
        author: string;
        context: string;
        relevance: string;
    }>;
    commonPainPoints: string[];
    successStories: string[];
    controversialPoints: string[];
    expertOpinions: string[];
    statistics: Array<{
        metric: string;
        value: string;
        context: string;
    }>;
    narrativeElements: {
        hooks: string[];
        personalStories: string[];
        transformations: string[];
    };
}

export interface TrendingReference {
    topic: string;
    source?: string;
    topicData: TrendingTopic;
    referenceSummary: {
        keyInsights: number;
        quotableComments: number;
        painPoints: number;
        successStories: number;
        postsAnalyzed: number;
    };
    referenceMaterial: ReferenceMaterial;
}

export interface TrendingTopic {
    topic: string;
    category: string;
    engagementScore: number;
    viralPotential: number;
    mediumSuccessProbability: number;
    keyThemes: string[];
    storyAngles: string[];
    targetAudience: string;
    estimatedReadTime: number;
    hooks: string[];
    source?: string;
}

export interface TrendingAnalysis {
    subreddit?: string;
    timeframe: string;
    postsAnalyzed: number;
    posts?: RedditPost[];
    trendingTopics: TrendingTopic[];
    bestStoryOpportunity: {
        title: string;
        angle: string;
        whyItWillWork: string;
    };
    references?: TrendingReference[];
}

export interface TrendingParams {
    timeframe?: 'day' | 'week' | 'month';
    limit?: number;
    gatherReferences?: boolean;
    topicsToGather?: number;
}

export interface MultiTrendingParams extends TrendingParams {
    subreddits: string[];
}

export const analyzeTrendingTopics = async (
    subreddit: string, 
    params: TrendingParams = {}
): Promise<TrendingAnalysis> => {
    const queryParams = new URLSearchParams();
    if (params.timeframe) queryParams.append('timeframe', params.timeframe);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.gatherReferences) {
        queryParams.append('gatherReferences', 'true');
        if (params.topicsToGather) {
            queryParams.append('topicsToGather', params.topicsToGather.toString());
        }
    }
    
    const response = await axios.get(`${API_URL}/trending/${subreddit}?${queryParams}`);
    return response.data;
};

export const analyzeMultiSubreddits = async (
    params: MultiTrendingParams
): Promise<TrendingAnalysis> => {
    const queryParams = new URLSearchParams();
    queryParams.append('subreddits', params.subreddits.join(','));
    if (params.timeframe) queryParams.append('timeframe', params.timeframe);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.gatherReferences) {
        queryParams.append('gatherReferences', 'true');
        if (params.topicsToGather) {
            queryParams.append('topicsToGather', params.topicsToGather.toString());
        }
    }
    
    const response = await axios.get(`${API_URL}/trending/multi?${queryParams}`);
    return response.data;
};

export const gatherReferences = async (
    subreddit: string,
    topic: string,
    postIds: string[]
): Promise<unknown> => {
    const response = await axios.post(`${API_URL}/trending/${subreddit}/references`, {
        topic,
        postIds
    });
    return response.data;
};