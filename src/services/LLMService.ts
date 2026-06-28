import { config, genAI } from '../config/config';
import { ApiError } from '../middleware/errorMiddleware';
import { Logger } from '../utils/logger';
import { parseValidatedJson, Validator } from '../utils/llmJson';

interface GenerativeModel {
    getGenerativeModel(options: { model?: string }): GenerativeModel;
    generateContent(prompt: string): Promise<{ response: { text: () => string } }>;
}

export class LLMService {
    private static readonly MAX_RETRIES = 2;
    private static readonly RETRY_DELAY_MS = 800;

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static getModel(): GenerativeModel {
        return (genAI as GenerativeModel).getGenerativeModel({ model: config.model });
    }

    static async generateText(prompt: string, label = 'LLM request', retryCount = 0): Promise<string> {
        try {
            const result = await this.getModel().generateContent(prompt);
            const text = result.response.text().trim();
            if (!text) {
                throw new ApiError(500, `${label} returned empty content`);
            }
            return text;
        } catch (error) {
            Logger.error(`${label} failed`, error);
            if (error instanceof ApiError) {
                throw error;
            }
            if (retryCount < this.MAX_RETRIES) {
                await this.delay(this.RETRY_DELAY_MS);
                return this.generateText(prompt, label, retryCount + 1);
            }
            throw new ApiError(500, `${label} unavailable`);
        }
    }

    static async generateJson<T>(
        prompt: string,
        validate: Validator<T>,
        label: string
    ): Promise<T> {
        const text = await this.generateText(prompt, label);
        return parseValidatedJson(text, validate, label);
    }
}
