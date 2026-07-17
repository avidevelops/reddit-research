import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { ClaudeModel } from '../services/ClaudeClient';
import { LMStudioModel } from '../services/LMStudioClient';

dotenv.config();

export type LLMProvider = 'gemini' | 'lmstudio' | 'claude';

function getLlmProvider(): LLMProvider {
    const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
    return provider === 'lmstudio' || provider === 'claude' ? provider : 'gemini';
}

const llmProvider = getLlmProvider();

// Validate required environment variables
const requiredEnvVars = [
    'REDDIT_CLIENT_ID',
    'REDDIT_CLIENT_SECRET',
    'REDDIT_USER_AGENT',
    ...(llmProvider === 'gemini' ? ['GOOGLE_API_KEY'] : []),
    ...(llmProvider === 'claude' ? ['ANTHROPIC_API_KEY'] : [])
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
    model: string;
    port: number;
    reddit: {
        clientId: string;
        clientSecret: string;
        userAgent: string;
    };
    gemini: {
        apiKey: string;
        model: string;
    };
    claude: {
        apiKey: string;
        model: string;
        baseUrl: string;
        maxTokens: number;
    };
    lmStudioUrl: string;
    lmStudioModel: string;
    llmProvider: LLMProvider;
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

function getModel(): string {
    if (process.env.MODEL) {
        return process.env.MODEL;
    }

    if (llmProvider === 'claude') {
        return process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
    }

    if (llmProvider === 'lmstudio') {
        return process.env.LM_STUDIO_MODEL || 'openai/gpt-oss-20b';
    }

    return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

const model = getModel();

export const config: Config = {
    model,
    lmStudioUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234',
    lmStudioModel: model,
    llmProvider,

    port: getPort(),
    reddit: {
        clientId: process.env.REDDIT_CLIENT_ID!,
        clientSecret: process.env.REDDIT_CLIENT_SECRET!,
        userAgent: process.env.REDDIT_USER_AGENT!
    },
    gemini: {
        apiKey: process.env.GOOGLE_API_KEY || '',
        model
    },
    claude: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        model,
        baseUrl: process.env.CLAUDE_BASE_URL || 'https://api.anthropic.com',
        maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '8192', 10)
    },
    logging: getLoggingConfig()
};

export const genAI = (() => {
    if (config.llmProvider === 'lmstudio') {
        return new LMStudioModel(config.lmStudioUrl, config.lmStudioModel);
    }

    if (config.llmProvider === 'claude') {
        return new ClaudeModel({
            apiKey: config.claude.apiKey,
            model: config.claude.model,
            baseUrl: config.claude.baseUrl,
            maxTokens: config.claude.maxTokens,
        });
    }

    return new GoogleGenerativeAI(config.gemini.apiKey);
})();
