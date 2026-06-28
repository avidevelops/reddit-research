import axios from 'axios';
import { ClaudeModel } from '../services/ClaudeClient';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ClaudeModel', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    it('calls Anthropic Messages API and returns text content', async () => {
        mockedAxios.post.mockResolvedValue({
            data: {
                content: [
                    { type: 'text', text: 'Hello from Claude.' },
                ],
            },
        });

        const model = new ClaudeModel({
            apiKey: 'test-key',
            model: 'claude-sonnet-4-6',
            baseUrl: 'https://api.anthropic.com/',
            maxTokens: 1000,
        });

        const result = await model.generateContent('Write a test.');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-sonnet-4-6',
                max_tokens: 1000,
                messages: [{ role: 'user', content: 'Write a test.' }],
            },
            expect.objectContaining({
                headers: expect.objectContaining({
                    'x-api-key': 'test-key',
                    'anthropic-version': '2023-06-01',
                }),
            })
        );
        expect(result.response.text()).toBe('Hello from Claude.');
    });
});
