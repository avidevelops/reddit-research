
interface CostMetrics {
    batchCount: number;
    totalPosts: number;
    totalTokens: number;
    estimatedCost: number;
    processingTime: number;
    promptTokens: number;
    responseTokens: number;
}

// Gemini API pricing (as of 2025)
const COST_PER_1K_INPUT_TOKENS = 0.00035;   // $0.00035 per 1k input tokens
const COST_PER_1K_OUTPUT_TOKENS = 0.00070;  // $0.00070 per 1k output tokens

// Average characters per token for English text (rough estimation)
const CHARS_PER_TOKEN = 4;

export class CostTracker {
    private static estimateTokens(text: string): number {
        return Math.ceil(text.length / CHARS_PER_TOKEN);
    }

    static async trackBatchProcessing(
        posts: any[],
        batchSize: number,
        prompt: string,
        startTime: number,
        responseText: string
    ): Promise<CostMetrics> {
        const batchCount = Math.ceil(posts.length / batchSize);
        
        // Estimate prompt tokens (including template and posts content)
        const promptTokens = this.estimateTokens(prompt);
        
        // Estimate response tokens
        const responseTokens = this.estimateTokens(responseText);
        
        // Calculate total tokens
        const totalTokens = promptTokens + responseTokens;

        // Calculate estimated cost
        const promptCost = (promptTokens / 1000) * COST_PER_1K_INPUT_TOKENS;
        const responseCost = (responseTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS;
        const estimatedCost = promptCost + responseCost;

        // Calculate processing time
        const processingTime = (Date.now() - startTime) / 1000; // in seconds

        const metrics: CostMetrics = {
            batchCount,
            totalPosts: posts.length,
            totalTokens,
            promptTokens,
            responseTokens,
            estimatedCost,
            processingTime
        };

        // Log the metrics
        console.log('\n=== Gemini API Usage Metrics ===');
        console.log(`Total Posts Processed: ${metrics.totalPosts}`);
        console.log(`Number of Batches: ${metrics.batchCount}`);
        console.log(`Prompt Tokens: ${metrics.promptTokens.toLocaleString()}`);
        console.log(`Response Tokens: ${metrics.responseTokens.toLocaleString()}`);
        console.log(`Total Tokens: ${metrics.totalTokens.toLocaleString()}`);
        console.log(`Prompt Cost: $${promptCost.toFixed(6)}`);
        console.log(`Response Cost: $${responseCost.toFixed(6)}`);
        console.log(`Total Cost: $${metrics.estimatedCost.toFixed(6)}`);
        console.log(`Processing Time: ${metrics.processingTime.toFixed(2)}s`);
        console.log(`Average Time per Post: ${(metrics.processingTime / metrics.totalPosts).toFixed(2)}s`);
        console.log('============================\n');

        return metrics;
    }
}
