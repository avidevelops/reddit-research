import { randomUUID } from 'crypto';
import { ApiError } from '../middleware/errorMiddleware';
import { ArticleBrief, ArticleDraft, EditorialReview, PipelineRequest, PipelineRun, PipelineTimeframe, ResearchBundle, TopicOpportunity } from '../types/pipeline';
import { CleanRedditPost } from '../utils/redditDataCleaner';
import { isArticleBrief, isArticleDraft, isEditorialReview } from '../utils/pipelineValidators';
import { Logger } from '../utils/logger';
import { ArtifactStorageService } from './ArtifactStorageService';
import { LLMService } from './LLMService';
import { RedditService } from './RedditService';
import { ReferenceMaterial, ReferenceMaterialService } from './ReferenceMaterialService';
import { PostAnalysis, TrendingTopic, TrendingTopicsService } from './TrendingTopicsService';

interface NormalizedPipelineRequest {
    subreddits: string[];
    timeframe: PipelineTimeframe;
    limit: number;
    topicsToGather: number;
    targetAudience: string;
    articleStyle: string;
    outputDir?: string;
}

interface SubredditAnalysis {
    subreddit: string;
    posts: CleanRedditPost[];
    analysis: PostAnalysis;
}

export class ArticlePipelineService {
    private redditService: RedditService;
    private referenceMaterialService: ReferenceMaterialService;

    constructor(
        redditService = new RedditService(),
        referenceMaterialService = new ReferenceMaterialService()
    ) {
        this.redditService = redditService;
        this.referenceMaterialService = referenceMaterialService;
    }

    async runPipeline(request: PipelineRequest): Promise<PipelineRun> {
        const normalized = this.normalizeRequest(request);
        const analyses = await this.discoverAndAnalyze(normalized);
        const opportunities = this.buildOpportunities(analyses);
        const selectedOpportunity = opportunities[0];

        if (!selectedOpportunity) {
            throw new ApiError(404, 'No viable story opportunities found');
        }

        const researchBundle = await this.gatherResearchBundle(selectedOpportunity, normalized.topicsToGather);
        const articleBrief = await this.generateBrief(researchBundle, normalized);
        const draft = await this.generateDraft(articleBrief, researchBundle, normalized);
        const editorialReview = await this.editDraft(draft, articleBrief, researchBundle, normalized);

        const runBase = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            request: normalized,
            opportunities,
            selectedOpportunity,
            researchBundle,
            articleBrief,
            draft,
            editorialReview,
        };

        const runDirectory = ArtifactStorageService.buildRunDirectory(selectedOpportunity.topic, normalized.outputDir);
        const artifacts = await ArtifactStorageService.saveRunArtifacts({
            runDirectory,
            run: runBase,
            researchBundle,
            articleBrief,
            draft,
            editorialReview,
        });

        Logger.info(`Pipeline run ${runBase.id} saved to ${artifacts.directory}`);
        return { ...runBase, artifacts };
    }

    async generateBrief(
        researchBundle: ResearchBundle,
        request: Pick<NormalizedPipelineRequest, 'targetAudience' | 'articleStyle'>
    ): Promise<ArticleBrief> {
        const prompt = `
You are an expert Medium editor. Create a rigorous article brief from this Reddit research bundle.

Rules:
- Use only the provided research.
- Do not invent statistics, quotes, or source claims.
- Keep Reddit quotes attributed and source-aware.
- Optimize for a strong, original Medium story, not a generic summary.

Target audience: ${request.targetAudience}
Article style: ${request.articleStyle}

Research bundle:
${JSON.stringify(researchBundle, null, 2)}

Return strict JSON:
{
  "title": "working title",
  "headlineOptions": ["headline 1", "headline 2", "headline 3"],
  "hookOptions": ["hook 1", "hook 2"],
  "thesis": "clear thesis",
  "targetAudience": "specific audience",
  "promise": "what reader gets",
  "outline": [
    {"heading": "section heading", "purpose": "why this section exists", "evidence": ["source-backed evidence"]}
  ],
  "counterarguments": ["balanced counterpoint"],
  "practicalTakeaways": ["takeaway"],
  "sourceNotes": ["source note with Reddit link context"],
  "risks": ["claim or framing risk to avoid"]
}`;

        return LLMService.generateJson(prompt, isArticleBrief, 'article brief generation');
    }

    async generateDraft(
        brief: ArticleBrief,
        researchBundle: ResearchBundle,
        request: Pick<NormalizedPipelineRequest, 'targetAudience' | 'articleStyle'>
    ): Promise<ArticleDraft> {
        const prompt = `
Write a polished Medium-style Markdown draft from this brief and Reddit research.

Rules:
- Output strict JSON only.
- The markdown must be the complete article.
- Do not fabricate quotes, studies, metrics, or external facts.
- Use source-backed claims and include a "Sources" section with Reddit links.
- Include a strong hook, clear thesis, useful sections, counterpoints, and practical takeaways.
- No Medium publishing, only Markdown.

Target audience: ${request.targetAudience}
Article style: ${request.articleStyle}

Brief:
${JSON.stringify(brief, null, 2)}

Research:
${JSON.stringify(researchBundle, null, 2)}

Return strict JSON:
{
  "title": "final title",
  "markdown": "# Title\\n\\nFull article in Markdown...",
  "sourceLinks": ["https://reddit.com/..."],
  "estimatedReadTime": 8
}`;

        return LLMService.generateJson(prompt, isArticleDraft, 'article draft generation');
    }

    async editDraft(
        draft: ArticleDraft,
        brief: ArticleBrief,
        researchBundle: ResearchBundle,
        request: Pick<NormalizedPipelineRequest, 'targetAudience' | 'articleStyle'>
    ): Promise<EditorialReview> {
        const prompt = `
Act as a demanding Medium editor. Improve this Markdown article while preserving source integrity.

Rules:
- Return strict JSON only.
- Make the article clearer, more original, more credible, and more readable.
- Do not add unsupported claims, fake statistics, or fake quotes.
- Preserve or improve the Markdown structure.
- Keep Reddit source links in the article.

Target audience: ${request.targetAudience}
Article style: ${request.articleStyle}

Brief:
${JSON.stringify(brief, null, 2)}

Research:
${JSON.stringify(researchBundle, null, 2)}

Draft:
${draft.markdown}

Return strict JSON:
{
  "score": 0-100,
  "strengths": ["strength"],
  "improvements": ["improvement made"],
  "factCheckNotes": ["source or claim note"],
  "finalMarkdown": "# Improved Title\\n\\nImproved article..."
}`;

        return LLMService.generateJson(prompt, isEditorialReview, 'editorial review');
    }

    private normalizeRequest(request: PipelineRequest): NormalizedPipelineRequest {
        const subreddits = request.subreddits
            .map(subreddit => subreddit.trim().replace(/^r\//i, ''))
            .filter(Boolean);

        if (subreddits.length === 0) {
            throw new ApiError(400, 'At least one subreddit is required');
        }

        return {
            subreddits,
            timeframe: request.timeframe || 'week',
            limit: Math.min(Math.max(request.limit || 40, 10), 100),
            topicsToGather: Math.min(Math.max(request.topicsToGather || 3, 1), 5),
            targetAudience: request.targetAudience?.trim() || 'curious Medium readers interested in technology, work, and life insights',
            articleStyle: request.articleStyle?.trim() || 'insightful narrative essay with practical takeaways',
            outputDir: request.outputDir?.trim() || undefined,
        };
    }

    private async discoverAndAnalyze(request: NormalizedPipelineRequest): Promise<SubredditAnalysis[]> {
        const results: SubredditAnalysis[] = [];
        const cutoffTime = this.getCutoffTimestamp(request.timeframe);

        for (const subreddit of request.subreddits) {
            try {
                const posts = await this.redditService.getSubredditPosts(subreddit, request.limit);
                const recentPosts = posts.filter(post => post.created_utc >= cutoffTime);
                if (recentPosts.length === 0) {
                    Logger.warn(`No recent posts found for r/${subreddit}`);
                    continue;
                }
                const analysis = await TrendingTopicsService.analyzeTrendingTopics(recentPosts);
                results.push({ subreddit, posts: recentPosts, analysis });
            } catch (error) {
                Logger.error(`Failed to analyze r/${subreddit}`, error);
            }
        }

        if (results.length === 0) {
            throw new ApiError(404, 'No subreddit analyses completed');
        }

        return results;
    }

    private buildOpportunities(analyses: SubredditAnalysis[]): TopicOpportunity[] {
        return analyses
            .flatMap(analysis => analysis.analysis.trendingTopics.map(topic =>
                this.toOpportunity(topic, analysis.subreddit, analysis.posts, analysis.analysis)
            ))
            .sort((a, b) => b.score - a.score);
    }

    private toOpportunity(
        topic: TrendingTopic,
        subreddit: string,
        posts: CleanRedditPost[],
        analysis: PostAnalysis
    ): TopicOpportunity {
        const relevantPostIds = new Set((topic.relevantPosts || []).map(post => post.id));
        const relevantPosts = posts.filter(post => relevantPostIds.has(post.id));
        const fallbackPosts = relevantPosts.length > 0
            ? relevantPosts
            : [...posts].sort((a, b) => (b.score + b.num_comments * 2) - (a.score + a.num_comments * 2)).slice(0, 5);

        const score = Math.round(
            topic.mediumSuccessProbability * 0.45 +
            topic.viralPotential * 0.25 +
            topic.engagementScore * 0.2 +
            Math.min(100, fallbackPosts.length * 10) * 0.1
        );

        return {
            id: `${subreddit}-${ArtifactStorageService.slugify(topic.topic)}`,
            topic: topic.topic,
            category: topic.category,
            sourceSubreddit: subreddit,
            engagementScore: topic.engagementScore,
            viralPotential: topic.viralPotential,
            mediumSuccessProbability: topic.mediumSuccessProbability,
            score,
            keyThemes: topic.keyThemes,
            storyAngles: topic.storyAngles,
            targetAudience: topic.targetAudience,
            estimatedReadTime: topic.estimatedReadTime,
            hooks: topic.hooks,
            relevantPosts: fallbackPosts,
            whyItWorks: analysis.bestStoryOpportunity?.whyItWillWork || 'Strong Reddit engagement and clear Medium audience fit.',
        };
    }

    private async gatherResearchBundle(opportunity: TopicOpportunity, referenceDepth: number): Promise<ResearchBundle> {
        const postIds = opportunity.relevantPosts.slice(0, referenceDepth + 2).map(post => post.id);
        const material = await this.referenceMaterialService.gatherReferenceMaterial(
            opportunity.topic,
            postIds,
            opportunity.sourceSubreddit
        );
        return this.toResearchBundle(opportunity, material);
    }

    private toResearchBundle(opportunity: TopicOpportunity, material: ReferenceMaterial): ResearchBundle {
        return {
            topic: opportunity.topic,
            sourceSubreddit: opportunity.sourceSubreddit,
            opportunity,
            keyInsights: material.keyInsights,
            quotes: material.quotableComments,
            painPoints: material.commonPainPoints,
            successStories: material.successStories,
            controversialPoints: material.controversialPoints,
            expertOpinions: material.expertOpinions,
            statistics: material.statistics,
            sourcePosts: material.sourcePosts.map(post => ({
                id: post.id,
                title: post.title,
                author: post.author,
                score: post.score,
                num_comments: post.comments.length,
                permalink: `https://reddit.com${post.permalink}`,
            })),
        };
    }

    private getCutoffTimestamp(timeframe: PipelineTimeframe): number {
        const days = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
        return Date.now() / 1000 - days * 24 * 60 * 60;
    }
}
