import { RedditService } from './RedditService';
import { Logger } from '../utils/logger';
import { config, genAI } from '../config/config';
import { ApiError } from '../middleware/errorMiddleware';
import { extractJson } from '../utils/llmJson';
import { CleanRedditComment } from "../utils/redditDataCleaner";
import { WritingMode } from '../types/pipeline';

const model = genAI.getGenerativeModel({ model: config.model });

export interface PostWithComments {
    id: string;
    title: string;
    author: string;
    selftext: string;
    score: number;
    created_utc: number;
    permalink: string;
    comments: Comment[];
    commentCategories: CategorizedComments;  // Comments organized by sort type
}

export interface Comment {
    id: string;
    body: string;
    author: string;
    created_utc: number;
    score?: number;
    replies: Comment[];
}

export interface CategorizedComments {
    best: CleanRedditComment[];
    top: CleanRedditComment[];
    controversial: CleanRedditComment[];
    qa: CleanRedditComment[];
    all: CleanRedditComment[];
}

export interface ReferenceMaterial {
    topicId: string;
    topic: string;
    sourcePosts: PostWithComments[];
    keyInsights: string[];
    quotableComments: Array<{
        text: string;
        author?: string;
        voiceLabel?: string;
        context: string;
        relevance: string;
    }>;
    commonPainPoints: string[];
    successStories: string[];
    controversialPoints: string[];
    expertOpinions: string[];
    statistics: Array<{
        metric: string;
        value: string;
        context: string;
    }>;
    narrativeElements: {
        hooks: string[];
        personalStories: string[];
        transformations: string[];
    };
}

export class ReferenceMaterialService {
    private redditService: RedditService;

    constructor() {
        this.redditService = new RedditService();
    }

    async gatherReferenceMaterial(
        topic: string,
        postIds: string[],
        subreddit: string,
        options: { theme?: string; writingMode?: WritingMode } = {}
    ): Promise<ReferenceMaterial> {
        Logger.info(`Gathering reference material for topic: ${topic}`);
        
        // Fetch posts with comments
        const postsWithComments = await this.fetchPostsWithComments(postIds, subreddit);
        
        // Analyze the content for reference material
        const analysis = await this.analyzeContentForReferences(topic, postsWithComments, options);
        
        return {
            topicId: `${subreddit}-${Date.now()}`,
            topic,
            sourcePosts: postsWithComments,
            ...analysis
        };
    }

    private async fetchPostsWithComments(
        postIds: string[],
        subreddit: string
    ): Promise<PostWithComments[]> {
        const postsWithComments: PostWithComments[] = [];
        
        for (const postId of postIds.slice(0, 5)) { // Limit to 5 posts for performance
            try {
                // Get the post
                const posts = await this.redditService.getSubredditPosts(subreddit, 1, postId);
                if (posts.length === 0) continue;
                
                const post = posts[0];

                // Fetch comments with different sorts
                const [bestComments, topComments, controversialComments, qaComments] = await Promise.all([
                    this.redditService.getPostComments(postId, subreddit, 'best'),
                    this.redditService.getPostComments(postId, subreddit, 'top'),
                    this.redditService.getPostComments(postId, subreddit, 'controversial'),
                    this.redditService.getPostComments(postId, subreddit, 'qa')
                ]);

                // Combine and categorize comments
                const categorized = this.categorizeAndDeduplicateComments({
                    best: bestComments,
                    top: topComments,
                    controversial: controversialComments,
                    qa: qaComments,
                });

                // Then slice what is needed for the prompt
                const categorizedComments = {
                    best: categorized.best.slice(0, 30),
                    top: categorized.top.slice(0, 20),
                    controversial: categorized.controversial.slice(0, 15),
                    qa: categorized.qa.slice(0, 15),
                    all: categorized.all
                };
                
                // Get comments for the post
                const comments = await this.redditService.getPostComments(postId, subreddit);

                postsWithComments.push({
                    ...post,
                    comments: categorizedComments.all,
                    commentCategories: categorizedComments
                });
                
                Logger.debug(`Fetched post ${postId} with ${comments.length} comments`);
            } catch (error) {
                Logger.error(`Failed to fetch post ${postId}:`, error);
            }
        }
        
        return postsWithComments;
    }

    // Deduplication and categorization
    private categorizeAndDeduplicateComments(commentsBySort: {
        best: Comment[],
        top: Comment[],
        controversial: Comment[],
        qa: Comment[]
    }): CategorizedComments {
        const seen = new Set<string>();
        const categorized: CategorizedComments = {
            best: [],
            top: [],
            controversial: [],
            qa: [],
            all: []
        };

        // Process in priority order (best > top > controversial > qa)
        for (const [category, comments] of Object.entries(commentsBySort)) {
            for (const comment of comments) {
                if (!seen.has(comment.id)) {
                    seen.add(comment.id);
                    categorized[category as keyof CategorizedComments].push(comment);
                    categorized.all.push(comment);
                }
            }
        }

        return categorized;
    }

    private async analyzeContentForReferences(
        topic: string,
        posts: PostWithComments[],
        options: { theme?: string; writingMode?: WritingMode } = {}
    ): Promise<Omit<ReferenceMaterial, 'topicId' | 'topic' | 'sourcePosts'>> {
        const theme = options.theme || 'General interest';
        const writingMode = options.writingMode || 'research-report';
        const discussionData = JSON.stringify(posts.map(p => ({
            title: p.title,
            content: p.selftext,
            topComments: p.comments.slice(0, 10).map(c => ({
                text: c.body,
                author: writingMode === 'research-report' ? c.author : undefined,
                replies: c.replies.slice(0, 3).map(r => r.body)
            }))
        })), null, 2);
        const prompt = writingMode === 'publish-ready' ? `
You are a deep-research assistant preparing raw material for a human author who will write an original Medium article.

Your job is NOT to summarise these discussions. Your job is to extract the RAW HUMAN MATERIAL - the emotions, tensions, confessions, insights, and story moments - that a skilled author can transform into original writing.

CRITICAL: Do not reference platforms, usernames, subreddits, upvotes, or any online forum metadata in your output. Extract the HUMAN CONTENT only - as if these were private interview transcripts, not public posts.

Topic: "${topic}"
Theme: ${theme}

Discussion data:
${discussionData}

Extract the following:

1. keyInsights: The 5-8 most intellectually interesting observations from the discussion. Write them as standalone insights an author could build an argument around - not as summaries of what people said.
2. quotableComments: Powerful human statements worth quoting in an article. Strip platform-specific framing. Keep the raw emotional or intellectual content. Do NOT include usernames. Include a short anonymized voiceLabel such as "an experienced practitioner", "a burned-out founder", "a skeptical reader", or "someone living with this problem".
3. commonPainPoints: Recurring frustrations, confusions, or fears. Write as universal human experiences, not platform observations.
4. successStories: Real transformations, breakthroughs, or positive experiences. Write as narrative seeds.
5. controversialPoints: Genuine tensions and disagreements where smart people hold opposite views.
6. expertOpinions: Statements that demonstrate deep knowledge, original thinking, or professional experience.
7. statistics: Concrete numbers, percentages, timeframes, or measurable claims mentioned. Include context so the author can verify them.
8. narrativeElements:
   - hooks: Opening sentences or questions that would stop a reader mid-scroll.
   - personalStories: Story seeds: character + situation + tension.
   - transformations: Moments where someone's thinking or life genuinely changed.

Return strict JSON:
{
    "keyInsights": ["insight1", "insight2"],
    "quotableComments": [
        {
            "text": "exact quote with no platform attribution",
            "voiceLabel": "anonymous human descriptor, not a username",
            "context": "what emotional or intellectual moment this captures",
            "relevance": "why an author would want to use this"
        }
    ],
    "commonPainPoints": ["pain1", "pain2"],
    "successStories": ["story1", "story2"],
    "controversialPoints": ["point1", "point2"],
    "expertOpinions": ["opinion1", "opinion2"],
    "statistics": [
        {"metric": "what is measured", "value": "the number/percentage", "context": "additional context"}
    ],
    "narrativeElements": {
        "hooks": ["hook1", "hook2"],
        "personalStories": ["story1", "story2"],
        "transformations": ["transformation1", "transformation2"]
    }
}` : `
        Analyze these Reddit posts and comments about "${topic}" to extract reference material for a Medium article.
        Theme: ${theme}
        Writing mode: ${writingMode}
        Mode guidance: Extract source-aware research material. Preserve enough attribution context for a writer to audit the discussion.
        
        Comments are pre-categorized by Reddit's sorting algorithms:
        - BEST: Community-validated balanced perspectives (use for key insights)
        - TOP: Highest-scored popular opinions (use for quotable content)
        - CONTROVERSIAL: Debated viewpoints with mixed reactions (use for balanced perspectives)
        - Q&A: Direct questions and answers (use for identifying pain points and solutions)
        
        This categorization helps identify:
        - Expert opinions likely appear in BEST/TOP
        - Pain points often surface in Q&A
        - Controversial points are pre-identified
        - Success stories typically score high (TOP)

        Posts and comments data:
        ${discussionData}
        
        Extract the following:
        
        1. Key Insights: Main learnings or discoveries from the discussion
        2. Quotable Comments: Powerful statements that could be used in an article (with context)
        3. Common Pain Points: Problems users frequently mention
        4. Success Stories: Positive experiences or solutions shared
        5. Controversial Points: Areas of disagreement or debate
        6. Expert Opinions: Comments that show deep knowledge or expertise
        7. Statistics: Any data, numbers, or metrics mentioned
        8. Narrative Elements: Personal stories, transformations, or compelling hooks
        
        Return as JSON:
        {
            "keyInsights": ["insight1", "insight2"],
            "quotableComments": [
                {
                    "text": "exact quote",
                    "author": "username when useful for source-aware audit",
                    "voiceLabel": "anonymous descriptor such as experienced practitioner, parent, skeptical reader, or anonymous voice",
                    "context": "what they were responding to",
                    "relevance": "why this quote matters"
                }
            ],
            "commonPainPoints": ["pain1", "pain2"],
            "successStories": ["story1", "story2"],
            "controversialPoints": ["point1", "point2"],
            "expertOpinions": ["opinion1", "opinion2"],
            "statistics": [
                {
                    "metric": "what is measured",
                    "value": "the number/percentage",
                    "context": "additional context"
                }
            ],
            "narrativeElements": {
                "hooks": ["hook1", "hook2"],
                "personalStories": ["story1", "story2"],
                "transformations": ["transformation1", "transformation2"]
            }
        }`;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const analysisText = response.text();

            const analysis = extractJson(analysisText) as Omit<ReferenceMaterial, 'topicId' | 'topic' | 'sourcePosts'>;
            Logger.info(`Extracted reference material for topic: ${topic}`);
            
            return analysis;
        } catch (error) {
            Logger.error('Failed to analyze content for references:', error);
            throw new ApiError(500, 'Failed to extract reference material');
        }
    }

    async saveReferenceMaterial(material: ReferenceMaterial): Promise<string> {
        const fs = require('fs').promises;
        const path = require('path');
        
        const outputDir = path.join(process.cwd(), 'reference-materials');
        await fs.mkdir(outputDir, { recursive: true });
        
        const filename = `${material.topicId}-reference.json`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(material, null, 2), 'utf8');
        Logger.info(`Saved reference material to ${filepath}`);
        
        // Also create a markdown summary
        const markdownContent = this.generateMarkdownSummary(material);
        const mdFilepath = path.join(outputDir, `${material.topicId}-summary.md`);
        await fs.writeFile(mdFilepath, markdownContent, 'utf8');
        
        return filepath;
    }

    private generateMarkdownSummary(material: ReferenceMaterial): string {
        let content = `# Reference Material: ${material.topic}\n\n`;
        content += `Generated: ${new Date().toISOString()}\n\n`;
        
        content += `## Source Posts (${material.sourcePosts.length})\n\n`;
        material.sourcePosts.forEach(post => {
            content += `- **${post.title}** by u/${post.author} (Score: ${post.score}, Comments: ${post.comments.length})\n`;
            content += `  Link: https://reddit.com${post.permalink}\n`;
        });
        
        content += `\n## Key Insights\n\n`;
        material.keyInsights.forEach(insight => {
            content += `- ${insight}\n`;
        });
        
        content += `\n## Quotable Comments\n\n`;
        material.quotableComments.forEach(comment => {
            content += `> "${comment.text}"\n`;
            content += `> — ${comment.voiceLabel || (comment.author ? `u/${comment.author}` : 'anonymous voice')}\n`;
            content += `> Context: ${comment.context}\n`;
            content += `> Relevance: ${comment.relevance}\n\n`;
        });
        
        content += `\n## Common Pain Points\n\n`;
        material.commonPainPoints.forEach(point => {
            content += `- ${point}\n`;
        });
        
        content += `\n## Success Stories\n\n`;
        material.successStories.forEach(story => {
            content += `- ${story}\n`;
        });
        
        if (material.statistics.length > 0) {
            content += `\n## Statistics\n\n`;
            material.statistics.forEach(stat => {
                content += `- **${stat.metric}**: ${stat.value}\n`;
                content += `  Context: ${stat.context}\n`;
            });
        }
        
        content += `\n## Narrative Elements\n\n`;
        content += `### Hooks\n`;
        material.narrativeElements.hooks.forEach(hook => {
            content += `- ${hook}\n`;
        });
        
        content += `\n### Personal Stories\n`;
        material.narrativeElements.personalStories.forEach(story => {
            content += `- ${story}\n`;
        });
        
        return content;
    }
}
