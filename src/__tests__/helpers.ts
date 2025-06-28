import { SentimentAnalysisService } from '../services/SentimentAnalysisService';

export const mockSentimentResponses = {
    negative: {
        label: 'negative' as const,
        score: 0.2,
        emotions: ['anger', 'frustration'],
        analysis: 'The text expresses strong negative emotions'
    },
    positive: {
        label: 'positive' as const,
        score: 0.8,
        emotions: ['happiness', 'joy'],
        analysis: 'The text expresses strong positive emotions'
    }
};

export const mockGeminiAPI = () => {
    const mockGenerateContent = jest.fn().mockImplementation(async (prompt: string) => {
        let response;
        
        // Check for specific test phrases
        if (prompt.includes('angry and frustrated')) {
            response = mockSentimentResponses.negative;
        } else if (prompt.includes('love this product')) {
            response = mockSentimentResponses.positive;
        } else {
            // Default neutral response for other test cases
            response = {
                label: 'neutral',
                score: 0.5,
                emotions: ['neutral'],
                analysis: 'The text appears to be neutral in sentiment'
            };
        }

        return {
            response: {
                text: () => JSON.stringify(response)
            }
        };
    });

    const mockModel = {
        generateContent: mockGenerateContent
    };

    // Set the mock model directly in the service
    SentimentAnalysisService.setModel(mockModel);

    return { mockGenerateContent, mockModel };
};
