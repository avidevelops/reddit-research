import { NextFunction, Request, Response } from 'express';
import { ApiError } from './errorMiddleware';

export const validateSearchRequest = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { subreddit, sentiment } = parseSubredditAndSentiment(req.query as unknown as string);

    if (!subreddit) {
        throw new ApiError(400, 'Subreddit parameter is required');
    }

    if (!sentiment) {
        throw new ApiError(400, 'Sentiment parameter is required');
    }

    if (typeof subreddit !== 'string' || typeof sentiment !== 'string') {
        throw new ApiError(400, 'Invalid parameter types');
    }

    next();
};

const parseSubredditAndSentiment = (query: any): { subreddit: string | null, sentiment: string | null } => {
    const queryString = query.q || '';
    const match = queryString.match(/^(.*) in r\/([a-zA-Z0-9_]+)$/);
        if (match) {
            const sentiment = match[1].trim();
            const subreddit = match[2].trim();
            return { subreddit, sentiment };
        }
        throw new Error('Invalid query format. Expected format: "sentiment in r/subreddit"');
}
