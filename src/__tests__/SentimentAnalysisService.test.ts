import { ApiError } from '../middleware/errorMiddleware';
import { SentimentAnalysisService } from '../services/SentimentAnalysisService';
import { mockGeminiAPI, mockSentimentResponses } from './helpers';

jest.setTimeout(10000); // Increase timeout for all tests in this file

describe('SentimentAnalysisService', () => {
    let mockGenerateContent: jest.Mock;
    let mockModel: any;

    beforeEach(() => {
        const mocks = mockGeminiAPI();
        mockGenerateContent = mocks.mockGenerateContent;
        mockModel = mocks.mockModel;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should analyze text sentiment correctly', async () => {
        const testText = 'I am really angry and frustrated with this product. It never works as advertised!';
        
        const result = await SentimentAnalysisService.analyzeSentiment(testText);
        
        expect(result).toBeTruthy();
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('emotions');
        expect(result).toHaveProperty('analysis');
        
        // Should match our mock negative response
        expect(result).toEqual(mockSentimentResponses.negative);
    });

    it('should handle empty text with an error', async () => {
        await expect(SentimentAnalysisService.analyzeSentiment('')).rejects.toThrow(ApiError);
    });

    it('should handle whitespace-only text with an error', async () => {
        await expect(SentimentAnalysisService.analyzeSentiment('   ')).rejects.toThrow(ApiError);
    });

    it('should analyze positive sentiment correctly', async () => {
        const testText = 'I absolutely love this product! It has made my life so much easier and brings me joy every day.';
        
        const result = await SentimentAnalysisService.analyzeSentiment(testText);
        
        // Should match our mock positive response
        expect(result).toEqual(mockSentimentResponses.positive);
    });

    it('should handle API errors and retry', async () => {
        const testText = 'test text';
        let attempts = 0;
        
        // Create a new mock that fails once then succeeds
        mockGenerateContent.mockImplementationOnce(() => {
            attempts++;
            throw new Error('API Error');
        }).mockImplementationOnce(() => {
            attempts++;
            return {
                response: {
                    text: () => JSON.stringify(mockSentimentResponses.positive)
                }
            };
        });

        const result = await SentimentAnalysisService.analyzeSentiment(testText);
        expect(attempts).toBe(2);
        expect(result).toEqual(mockSentimentResponses.positive);
    });

    it('should throw ApiError after max retries', async () => {
        const testText = 'test text';
        
        // Always fail
        mockGenerateContent.mockImplementation(() => {
            throw new Error('API Error');
        });

        await expect(SentimentAnalysisService.analyzeSentiment(testText))
            .rejects
            .toThrow(ApiError);
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid JSON response', async () => {
        const testText = 'test text';
        
        mockGenerateContent.mockImplementation(() => ({
            response: {
                text: () => 'invalid json'
            }
        }));

        await expect(SentimentAnalysisService.analyzeSentiment(testText))
            .rejects
            .toThrow(ApiError);
    });
});
