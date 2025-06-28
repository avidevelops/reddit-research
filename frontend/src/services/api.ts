import axios from 'axios';
import type { RedditPost } from '../types/api';

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
