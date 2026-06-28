import axios from 'axios';

export interface LLMModel {
    generateContent(prompt: string): Promise<{ response: { text: () => string } }>;
}

export class LMStudioModel implements LLMModel {
    private url: string;
    private model: string;

    constructor(url: string = 'http://localhost:1234', model: string = process.env.MODEL || 'gpt-4o-mini') {
        this.url = url.replace(/\/*$/, ''); // remove trailing slashes
        this.model = model;
    }

    getGenerativeModel({model}: { model?: string }): LMStudioModel {
        return new LMStudioModel(this.url, model || this.model);
    }

    async generateContent(prompt: string) {
        const res = await axios.post(`${this.url}/v1/chat/completions`, {
                model: this.model,
                messages: [{role: 'user', content: prompt}]
            },
            {timeout: 900000});
        if (!res.status || res.status >= 400) {
            const err = res.statusText;
            throw new Error(`LM Studio API error: ${res.status} ${err}`);
        }
        const data = res.data;
        const content = data.choices?.[0]?.message?.content ?? '';
        return {
            response: {
                text: () => content,
            },
        };
    }
}
