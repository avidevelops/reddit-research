import axios from 'axios';
import { config } from '../config';
import type {
    PipelineRequest,
    PipelineRun,
    RedditPost,
    TrendingAnalysis,
} from '../types/api';

const API_URL = config.apiUrl;
const LONG_TIMEOUT_MS = 900000;

export const searchReddit = async (query: string): Promise<RedditPost[]> => {
    const response = await axios.get(`${API_URL}/search`, {
        params: { q: query },
    });
    return response.data;
};

export const analyzeSentiment = async (text: string) => {
    const response = await axios.post(`${API_URL}/analyze`, { text });
    return response.data;
};

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
    const response = await axios.get(`${API_URL}/trending/${subreddit}`, {
        params,
        timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
};

export const analyzeMultiSubreddits = async (
    params: MultiTrendingParams
): Promise<TrendingAnalysis> => {
    const response = await axios.get(`${API_URL}/trending/multi`, {
        params: {
            ...params,
            subreddits: params.subreddits.join(','),
        },
        timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
};

export const gatherReferences = async (
    subreddit: string,
    topic: string,
    postIds: string[]
): Promise<unknown> => {
    const response = await axios.post(`${API_URL}/trending/${subreddit}/references`, {
        topic,
        postIds,
    }, {
        timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
};

export const runStoryPipeline = async (request: PipelineRequest): Promise<PipelineRun> => {
    const response = await axios.post(`${API_URL}/pipeline/run`, request, {
        timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
};
