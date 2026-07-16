import { randomUUID } from 'crypto';
import { ApiError } from '../middleware/errorMiddleware';
import { ArticleBrief, ArticleDraft, EditorialReview, PipelineProgressCallback, PipelineRequest, PipelineRequestSnapshot, PipelineRun, PipelineTimeframe, ResearchBundle, TopicOpportunity, WritingMode } from '../types/pipeline';
import { CleanRedditPost } from '../utils/redditDataCleaner';
import { isArticleBrief, isArticleDraft, isEditorialReview } from '../utils/pipelineValidators';
import { Logger } from '../utils/logger';
import { ArtifactStorageService } from './ArtifactStorageService';
import { ArticleQualityService } from './ArticleQualityService';
import { LLMService } from './LLMService';
import { buildBriefPrompt, buildDraftPrompt, buildEditPrompt, toPromptContext } from './pipelinePrompts';
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
    theme: string;
    writingMode: WritingMode;
    outputDir?: string;
    selectedOpportunity?: TopicOpportunity;
    opportunitiesSnapshot?: TopicOpportunity[];
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

    async runPipeline(request: PipelineRequest, onProgress?: PipelineProgressCallback): Promise<PipelineRun> {
        const normalized = this.normalizeRequest(request);
        let opportunities: TopicOpportunity[];
        let selectedOpportunity: TopicOpportunity | undefined;

        if (normalized.selectedOpportunity) {
            selectedOpportunity = normalized.selectedOpportunity;
            opportunities = this.withSelectedOpportunity(
                normalized.opportunitiesSnapshot?.length ? normalized.opportunitiesSnapshot : [selectedOpportunity],
                selectedOpportunity
            );
            onProgress?.('stage', {
                stage: 'opportunities',
                count: opportunities.length,
                topTopic: selectedOpportunity.topic,
                selected: true,
            });
        } else {
            opportunities = await this.discoverOpportunities(normalized, onProgress);
            selectedOpportunity = opportunities[0];
        }

        if (!selectedOpportunity) {
            throw new ApiError(404, 'No viable story opportunities found');
        }

        onProgress?.('stage', { stage: 'researching', topic: selectedOpportunity.topic });
        const researchBundle = await this.gatherResearchBundle(selectedOpportunity, normalized);
        onProgress?.('stage', { stage: 'briefing' });
        const articleBrief = await this.generateBrief(researchBundle, normalized);
        onProgress?.('stage', { stage: 'drafting', wordEstimate: selectedOpportunity.estimatedReadTime * 220 });
        const draft = await this.generateDraft(articleBrief, researchBundle, normalized);
        onProgress?.('stage', { stage: 'editing' });
        const editorialReview = await this.editDraft(draft, articleBrief, researchBundle, normalized);

        const runBase: Omit<PipelineRun, 'artifacts'> = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            request: this.toRequestSnapshot(normalized, selectedOpportunity),
            opportunities,
            selectedOpportunity,
            researchBundle,
            articleBrief,
            draft,
            editorialReview,
        };

        const qualityRun = { ...runBase, artifacts: { directory: '', files: {} } };
        const improvement = await ArticleQualityService.improveIfNeeded(qualityRun);
        runBase.editorialReview = {
            ...qualityRun.editorialReview,
            qualityGate: improvement.qualityGate,
        };
        onProgress?.('stage', { stage: 'quality', score: improvement.finalScore, improved: improvement.improved });

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
        const run = { ...runBase, artifacts };
        onProgress?.('complete', run);
        return run;
    }

    async discoverOpportunities(
        request: PipelineRequest,
        onProgress?: PipelineProgressCallback
    ): Promise<TopicOpportunity[]> {
        const normalized = this.normalizeRequest(request);
        onProgress?.('stage', { stage: 'discovering', subreddits: normalized.subreddits, theme: normalized.theme });
        const analyses = await this.discoverAndAnalyze(normalized);
        const opportunities = this.buildOpportunities(analyses);
        onProgress?.('stage', {
            stage: 'opportunities',
            count: opportunities.length,
            topTopic: opportunities[0]?.topic,
        });
        return opportunities;
    }

    async generateBrief(
        researchBundle: ResearchBundle,
        request: Pick<NormalizedPipelineRequest, 'targetAudience' | 'articleStyle' | 'theme' | 'writingMode'>
    ): Promise<ArticleBrief> {
        const prompt = buildBriefPrompt(researchBundle, toPromptContext(request));
        return LLMService.generateJson(prompt, isArticleBrief, 'article brief generation');
    }

    async generateDraft(
        brief: ArticleBrief,
        researchBundle: ResearchBundle,
        request: Pick<NormalizedPipelineRequest, 'targetAudience' | 'articleStyle' | 'theme' | 'writingMode'>
    ): Promise<ArticleDraft> {
        const prompt = buildDraftPrompt(brief, researchBundle, toPromptContext(request));
        return LLMService.generateJson(prompt, isArticleDraft, 'article draft generation');
    }

    async editDraft(
        draft: ArticleDraft,
        brief: ArticleBrief,
        researchBundle: ResearchBundle,
        request: Pick<NormalizedPipelineRequest, 'targetAudience' | 'articleStyle' | 'theme' | 'writingMode'>
    ): Promise<EditorialReview> {
        const prompt =  buildEditPrompt(draft, brief, researchBundle, toPromptContext(request));
        return LLMService.generateJson(prompt, isEditorialReview, 'editorial review');
    }

    async regenerateSection(
        run: PipelineRun,
        sectionIndex: number,
        instruction?: string
    ): Promise<{ updatedMarkdown: string }> {
        const section = run.articleBrief.outline[sectionIndex];
        if (!section) {
            throw new ApiError(400, 'Invalid sectionIndex');
        }

        const prompt = `
Regenerate one Markdown section from this article. Return strict JSON:
{
  "updatedMarkdown": "complete article markdown with only the requested section changed"
}

Section to regenerate:
${JSON.stringify(section, null, 2)}

Instruction:
${instruction || 'Improve clarity, originality, and evidence density while preserving sources.'}

Full article:
${run.editorialReview.finalMarkdown}`;

        const result = await LLMService.generateJson(
            prompt,
            (value): value is { updatedMarkdown: string } => (
                typeof value === 'object' &&
                value !== null &&
                typeof (value as { updatedMarkdown?: unknown }).updatedMarkdown === 'string'
            ),
            'section regeneration'
        );

        run.editorialReview.finalMarkdown = result.updatedMarkdown;
        await ArtifactStorageService.updateRun(run);
        return result;
    }

    private normalizeRequest(request: PipelineRequest): NormalizedPipelineRequest {
        const requestedSubreddits = request.subreddits || [];
        const subreddits = requestedSubreddits
            .map(subreddit => subreddit.trim().replace(/^r\//i, ''))
            .filter(Boolean);
        if (subreddits.length === 0 && request.selectedOpportunity?.sourceSubreddit) {
            subreddits.push(request.selectedOpportunity.sourceSubreddit);
        }

        if (subreddits.length === 0) {
            throw new ApiError(400, 'At least one subreddit is required');
        }

        const writingMode = this.normalizeWritingMode(request.writingMode);

        return {
            subreddits,
            timeframe: request.timeframe || 'week',
            limit: Math.min(Math.max(request.limit || 40, 10), 100),
            topicsToGather: Math.min(Math.max(request.topicsToGather || 3, 1), 5),
            targetAudience: request.targetAudience?.trim() || 'curious Medium readers interested in thoughtful, practical insight',
            articleStyle: request.articleStyle?.trim() || 'insightful narrative essay with practical takeaways',
            theme: request.theme?.trim() || 'General interest',
            writingMode,
            outputDir: request.outputDir?.trim() || undefined,
            selectedOpportunity: request.selectedOpportunity,
            opportunitiesSnapshot: request.opportunitiesSnapshot,
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
                const analysis = await TrendingTopicsService.analyzeTrendingTopics(recentPosts, { theme: request.theme });
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

    private async gatherResearchBundle(opportunity: TopicOpportunity, request: Pick<NormalizedPipelineRequest, 'topicsToGather' | 'theme' | 'writingMode'>): Promise<ResearchBundle> {
        const postIds = opportunity.relevantPosts.slice(0, request.topicsToGather + 2).map(post => post.id);
        const material = await this.referenceMaterialService.gatherReferenceMaterial(
            opportunity.topic,
            postIds,
            opportunity.sourceSubreddit,
            { theme: request.theme, writingMode: request.writingMode }
        );
        return this.toResearchBundle(opportunity, material);
    }

    private toResearchBundle(opportunity: TopicOpportunity, material: ReferenceMaterial): ResearchBundle {
        return {
            topic: opportunity.topic,
            sourceSubreddit: opportunity.sourceSubreddit,
            opportunity,
            keyInsights: material.keyInsights,
            quotes: material.quotableComments.map(comment => ({
                ...comment,
                voiceLabel: comment.voiceLabel || comment.author || 'anonymous voice',
            })),
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

    private normalizeWritingMode(mode?: WritingMode): WritingMode {
        if (mode === 'publish-ready' || mode === 'research-report') {
            return mode;
        }
        return 'research-report';
    }

    private withSelectedOpportunity(opportunities: TopicOpportunity[], selected: TopicOpportunity): TopicOpportunity[] {
        const withoutDuplicate = opportunities.filter(opportunity => opportunity.id !== selected.id);
        return [selected, ...withoutDuplicate].sort((a, b) => b.score - a.score);
    }

    private toRequestSnapshot(request: NormalizedPipelineRequest, selectedOpportunity: TopicOpportunity): PipelineRequestSnapshot {
        return {
            subreddits: request.subreddits,
            timeframe: request.timeframe,
            limit: request.limit,
            topicsToGather: request.topicsToGather,
            targetAudience: request.targetAudience,
            articleStyle: request.articleStyle,
            theme: request.theme,
            writingMode: request.writingMode,
            outputDir: request.outputDir,
            selectedOpportunityId: selectedOpportunity.id,
        };
    }
}
