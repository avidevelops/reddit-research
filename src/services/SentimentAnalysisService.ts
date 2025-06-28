import { genAI } from '../config/config';
import { ApiError } from '../middleware/errorMiddleware';
import { createBatchPrompt } from '../utils/batchProcessor';
import { CostTracker } from '../utils/costTracker';
import { Logger } from '../utils/logger';

const defaultModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Configure logging
Logger.configure({
  logLevel: "debug", // Set log level
});

interface SentimentAnalysis {
    label: 'positive' | 'negative' | 'neutral';
    score: number;
    emotions: string[];
    analysis: string;
}

export class SentimentAnalysisService {
    private static model = defaultModel;
    private static readonly MAX_RETRIES = 2; // We'll try a total of 3 times (initial + 2 retries)
    private static readonly RETRY_DELAY = 1000; // 1 second

    // For testing purposes
    public static setModel(model: any) {
        this.model = model;
    }

    private static readonly PROMPT_TEMPLATE = `
    Analyze the following Reddit post for sentiment and emotions. Focus on:
    1. Overall sentiment (positive, negative, or neutral)
    2. Emotional state (e.g., anger, happiness, frustration, excitement)
    3. Key pain points or desires expressed
    4. Context and implications

    Post content:
    """
    {text}
    """

    Provide the analysis in JSON format with the following structure:
    {
        "label": "positive/negative/neutral",
        "score": 0-1,
        "emotions": ["emotion1", "emotion2"],
        "analysis": "brief explanation"
    }
    `;

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static validateAnalysis(analysis: any): analysis is SentimentAnalysis {
        return (
            typeof analysis === 'object' &&
            ['positive', 'negative', 'neutral'].includes(analysis.label) &&
            typeof analysis.score === 'number' &&
            Array.isArray(analysis.emotions) &&
            typeof analysis.analysis === 'string'
        );
    }

    static async analyzeSentiment(text: string, retryCount = 0): Promise<SentimentAnalysis> {
        if (!text.trim()) {
            throw new ApiError(400, 'Text content cannot be empty');
        }

        try {
            const prompt = this.PROMPT_TEMPLATE.replace('{text}', text);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const analysisText = response.text();

            try {
                const analysis = JSON.parse(analysisText);
                
                if (!this.validateAnalysis(analysis)) {
                    throw new Error('Invalid analysis format');
                }

                return analysis;
            } catch (error) {
                Logger.error('Failed to parse Gemini response:', error);

                if (retryCount < this.MAX_RETRIES) {
                    await this.delay(this.RETRY_DELAY);
                    return this.analyzeSentiment(text, retryCount + 1);
                }

                throw new ApiError(500, 'Failed to parse sentiment analysis response');
            }
        } catch (error) {
            Logger.error('Error in sentiment analysis:', error);

            // If it's already an ApiError, just rethrow it
            if (error instanceof ApiError) {
                throw error;
            }

            if (retryCount < this.MAX_RETRIES) {
                await this.delay(this.RETRY_DELAY);
                return this.analyzeSentiment(text, retryCount + 1);
            }

            throw new ApiError(500, 'Sentiment analysis service unavailable');
        }
    }

    static async analyzeBatch(posts: any[]): Promise<any[]> {
        const startTime = Date.now();
        let prompt = '';
        
        try {
            prompt = createBatchPrompt(posts);
            Logger.debug(`Generated batch prompt for ${posts.length} posts: ${prompt}...`);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();
            
            try {
                Logger.debug(`Received response from Gemini: ${responseText}...`);
                
                // Extract JSON from markdown code blocks if present
                let jsonText = responseText;
                const match = responseText.match(/```json\n([\s\S]*?)\n```/);
                if (match) {
                    jsonText = match[1];
                    Logger.debug('Extracted JSON from markdown code block');
                }
                
                const analysisResults = JSON.parse(jsonText);
                
                // Track successful API usage
                await CostTracker.trackBatchProcessing(
                    posts,
                    posts.length,
                    prompt,
                    startTime,
                    responseText
                );

                return analysisResults.map((result: any) => ({
                    ...result.sentiment,
                    emotions: result.sentiment.emotions.slice(0, 5)
                }));
            } catch (error) {
                // Track failed API calls too
                await CostTracker.trackBatchProcessing(
                    posts,
                    posts.length,
                    prompt,
                    startTime,
                    'Error: Failed to parse response'
                );

                Logger.error('Error parsing Gemini response:', error);
                throw new ApiError(500, 'Failed to parse sentiment analysis results');
            }
        } catch (error) {
            Logger.error('Error in sentiment analysis:', error);
            
            if (prompt) {
                // Track API errors
                await CostTracker.trackBatchProcessing(
                    posts,
                    posts.length,
                    prompt,
                    startTime,
                    'Error: API call failed'
                );
            }

            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Sentiment analysis service unavailable');
        }
    }
}
