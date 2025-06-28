import { NextFunction, Request, Response } from 'express';
import Logger from './logger';

export class ErrorHandler {
    static handleError = (err: Error, req: Request, res: Response, next: NextFunction) => {
        Logger.error('Unhandled error:', err);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    };

    static notFound = (req: Request, res: Response, next: NextFunction) => {
        res.status(404).json({
            status: 'error',
            message: 'Resource not found'
        });
    };
}
