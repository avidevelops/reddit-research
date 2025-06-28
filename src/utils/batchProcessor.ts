import { Logger } from "./logger";

const MAX_TOKENS_PER_BATCH = 30000; // Conservative estimate for Gemini-2.0-flash
const ESTIMATED_TOKENS_PER_POST = 300; // Approximate tokens for title + selftext
const POSTS_PER_BATCH = Math.floor(MAX_TOKENS_PER_BATCH / ESTIMATED_TOKENS_PER_POST);

export function chunkPosts<T>(posts: T[], size = POSTS_PER_BATCH): T[][] {
    return Array.from({ length: Math.ceil(posts.length / size) }, (_, i) =>
        posts.slice(i * size, (i * size) + size)
    );
}

// Rough estimation of tokens based on text length
function estimateTokenCount(text: string): number {
    // Average of 4 characters per token for English text
    return Math.ceil(text.length / 4);
}

export function createBatchPrompt(posts: any[]): string {
    // Calculate estimated tokens for each post
    posts.forEach(post => {
        const content = post.selftext ? `${post.title}\n${post.selftext}` : post.title;
        const estimatedTokens = estimateTokenCount(content);
        Logger.debug(`Post ${post.id}: ~${estimatedTokens} tokens`);
    });

    const postsText = posts.map((post, index) => {
        const content = post.selftext ? `${post.title}\n${post.selftext}` : post.title;
        return `[Post ${index + 1}]:\n${content}\n`;
    }).join('\n---\n');

    return `Analyze the sentiment and emotions in these Reddit posts. For each post, provide:
1. Overall sentiment (positive, negative, or neutral)
2. Sentiment score (-1 to 1)
3. Brief analysis (max 2 sentences)
4. List of detected emotions (max 5)

Format each response as JSON array matching the posts order:
[
  {
    "index": 1,
    "sentiment": { 
      "label": "positive/negative/neutral",
      "score": number,
      "analysis": "string",
      "emotions": ["emotion1", "emotion2"]
    }
  }
]

Posts to analyze:

${postsText}`;
}
