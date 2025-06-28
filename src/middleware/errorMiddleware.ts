import { NextFunction, Request, Response } from 'express';
import { Logger } from '../utils/logger';

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const apiErrorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    Logger.error(`API Error: ${err.message}`, err);

    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
            details: err.details,
        });
        return;
    }

    res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
};
