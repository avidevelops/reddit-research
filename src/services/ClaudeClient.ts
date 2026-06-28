import axios from 'axios';

export interface ClaudeModelOptions {
    apiKey: string;
    model?: string;
    baseUrl?: string;
    maxTokens?: number;
}

export class ClaudeModel {
    private apiKey: string;
    private model: string;
    private baseUrl: string;
    private maxTokens: number;

    constructor(options: ClaudeModelOptions) {
        this.apiKey = options.apiKey;
        this.model = options.model || process.env.MODEL || 'claude-sonnet-4-6';
        this.baseUrl = (options.baseUrl || 'https://api.anthropic.com').replace(/\/*$/, '');
        this.maxTokens = options.maxTokens || 8192;
    }

    getGenerativeModel({ model }: { model?: string }): ClaudeModel {
        return new ClaudeModel({
            apiKey: this.apiKey,
            model: model || this.model,
            baseUrl: this.baseUrl,
            maxTokens: this.maxTokens,
        });
    }

    async generateContent(prompt: string): Promise<{ response: { text: () => string } }> {
        const response = await axios.post(
            `${this.baseUrl}/v1/messages`,
            {
                model: this.model,
                max_tokens: this.maxTokens,
                messages: [{ role: 'user', content: prompt }],
            },
            {
                timeout: 900000,
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
            }
        );

        const content = response.data?.content || [];
        const text = content
            .filter((block: { type?: string; text?: string }) => block.type === 'text' && block.text)
            .map((block: { text: string }) => block.text)
            .join('\n')
            .trim();

        return {
            response: {
                text: () => text,
            },
        };
    }
}
