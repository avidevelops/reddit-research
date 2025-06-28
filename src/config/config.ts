import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET',
    'REDDIT_USER_AGENT',
    'GOOGLE_API_KEY'
] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggingConfig {
    level: LogLevel;
    toConsole: boolean;
    directory: string;
    maxLogSize?: string;  // e.g., "10M"
    maxLogAge?: number;   // Days to keep old logs
    compress?: boolean;   // Whether to compress rotated logs
}

interface Config {
    port: number;
    mongodb: {
        uri: string;
    };
    reddit: {
        clientId: string;
        clientSecret: string;
        userAgent: string;
    };
    gemini: {
        apiKey: string;
    };
    logging: LoggingConfig;
}

function validateLogLevel(level: string): LogLevel {
    const validLevels = ['error', 'warn', 'info', 'debug'] as const;
    return validLevels.includes(level as LogLevel) ? level as LogLevel : 'info';
}

function validateLogSize(size: string | undefined): string {
    if (!size) return '10M';
    // Check if size follows the pattern of number + M/G (e.g., "10M", "1G")
    const match = size.match(/^(\d+)(M|G)$/);
    if (!match) return '10M';
    return size;
}

function validateLogAge(age: string | undefined): number {
    const days = parseInt(age || '30', 10);
    return isNaN(days) || days <= 0 ? 30 : days;
}

function getPort(): number {
    const port = parseInt(process.env.PORT || '3000', 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
        return 3000;
    }
    return port;
}

function getLoggingConfig(): LoggingConfig {
    return {
        level: validateLogLevel(process.env.LOG_LEVEL || 'info'),
        toConsole: process.env.LOG_TO_CONSOLE === 'true',
        directory: process.env.LOG_DIR || 'logs',
        maxLogSize: validateLogSize(process.env.LOG_MAX_SIZE),
        maxLogAge: validateLogAge(process.env.LOG_MAX_AGE),
        compress: process.env.LOG_COMPRESS !== 'false', // Default to true
    };
}

export const config: Config = {
    port: getPort(),
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gummy_reddit'
    },
    reddit: {
        clientId: process.env.REDDIT_CLIENT_ID!,
        clientSecret: process.env.REDDIT_CLIENT_SECRET!,
        userAgent: process.env.REDDIT_USER_AGENT!
    },
    gemini: {
        apiKey: process.env.GOOGLE_API_KEY!
    },
    logging: getLoggingConfig()
};

// Initialize Gemini with validated API key
export const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
