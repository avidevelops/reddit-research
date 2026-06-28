import axios from 'axios';
import { config } from '../config';
import type {
    PipelineRequest,
    PipelineRunMetadata,
    PipelineProviders,
    PipelineProgressEvent,
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
    const response = await axios.post(`${API_URL}/pipeline/run/sync`, request, {
        timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
};

export const streamStoryPipeline = async (
    request: PipelineRequest,
    onEvent: (event: PipelineProgressEvent) => void
): Promise<void> => {
    const response = await fetch(`${API_URL}/pipeline/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok || !response.body) {
        throw new Error(`Pipeline stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
            const eventLine = chunk.split('\n').find(line => line.startsWith('event: '));
            const dataLine = chunk.split('\n').find(line => line.startsWith('data: '));
            if (!eventLine || !dataLine) continue;
            onEvent({
                event: eventLine.replace('event: ', '').trim(),
                data: JSON.parse(dataLine.replace('data: ', '')),
            });
        }
    }
};

export const getPipelineProviders = async (): Promise<PipelineProviders> => {
    const response = await axios.get(`${API_URL}/pipeline/providers`);
    return response.data;
};

export const listPipelineRuns = async (): Promise<PipelineRunMetadata[]> => {
    const response = await axios.get(`${API_URL}/pipeline/runs`);
    return response.data.runs;
};

export const getPipelineRun = async (runId: string): Promise<PipelineRun> => {
    const response = await axios.get(`${API_URL}/pipeline/runs/${runId}`);
    return response.data;
};

export const deletePipelineRun = async (runId: string): Promise<void> => {
    await axios.delete(`${API_URL}/pipeline/runs/${runId}`);
};

export const regeneratePipelineSection = async (
    runId: string,
    sectionIndex: number,
    instruction?: string
): Promise<{ updatedMarkdown: string }> => {
    const response = await axios.post(`${API_URL}/pipeline/runs/${runId}/regenerate-section`, {
        sectionIndex,
        instruction,
    }, {
        timeout: LONG_TIMEOUT_MS,
    });
    return response.data;
};

export const getPipelineExportUrl = (
    runId: string,
    format: 'markdown' | 'html' | 'plaintext' = 'markdown'
): string => `${API_URL}/pipeline/runs/${runId}/export?format=${format}`;

export const fetchPipelineExport = async (
    runId: string,
    format: 'markdown' | 'html' | 'plaintext'
): Promise<string> => {
    const response = await axios.get(getPipelineExportUrl(runId, format), {
        responseType: 'text',
    });
    return response.data;
};
