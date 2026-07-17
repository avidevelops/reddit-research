import { randomUUID } from 'crypto';
import { ApiError } from '../middleware/errorMiddleware';
import { ArticleBrief, ArticleDraft, EditorialReview, PipelineCheckpoint, PipelineExecutionStage, PipelineProgressCallback, PipelineRequest, PipelineRequestSnapshot, PipelineRun, PipelineTimeframe, ResearchBundle, TopicOpportunity, WritingMode } from '../types/pipeline';
import { CleanRedditPost } from '../utils/redditDataCleaner';
import { isArticleBrief, isArticleDraft, isEditorialReview } from '../utils/pipelineValidators';
import { Logger } from '../utils/logger';
import { isSupportedRedditPostUrl, parseRedditPostUrl } from '../utils/redditPostUrl';
import { ArtifactStorageService } from './ArtifactStorageService';
import { ArticleQualityService } from './ArticleQualityService';
import { LLMService } from './LLMService';
import { PipelineExecutionRegistry } from './PipelineExecutionRegistry';
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
    redditPostUrl?: string;
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
        } else if (normalized.redditPostUrl) {
            selectedOpportunity = await this.discoverDirectPostOpportunity(normalized, onProgress);
            opportunities = [selectedOpportunity];
        } else {
            opportunities = await this.discoverOpportunities(normalized, onProgress);
            selectedOpportunity = opportunities[0];
        }

        if (!selectedOpportunity) {
            throw new ApiError(404, 'No viable story opportunities found');
        }

        const runDirectory = ArtifactStorageService.buildRunDirectory(selectedOpportunity.topic, normalized.outputDir);
        const checkpoint: PipelineCheckpoint = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'running',
            completedStage: 'opportunity',
            runDirectory,
            request: this.toRequestSnapshot(normalized, selectedOpportunity),
            opportunities,
            selectedOpportunity,
        };
        await ArtifactStorageService.saveCheckpoint(checkpoint);
        return this.continueFromCheckpoint(checkpoint, normalized, onProgress);
    }

    async resumePipeline(runId: string, onProgress?: PipelineProgressCallback): Promise<PipelineRun> {
        const checkpoint = await ArtifactStorageService.getCheckpoint(runId);
        if (!checkpoint) {
            throw new ApiError(404, 'Resumable pipeline run not found');
        }

        checkpoint.status = 'running';
        checkpoint.error = undefined;
        checkpoint.failedStage = undefined;
        checkpoint.updatedAt = new Date().toISOString();
        await ArtifactStorageService.saveCheckpoint(checkpoint);
        onProgress?.('stage', { stage: 'resuming', completedStage: checkpoint.completedStage });
        const normalized = this.normalizeRequest({
            ...checkpoint.request,
            selectedOpportunity: checkpoint.selectedOpportunity,
            opportunitiesSnapshot: checkpoint.opportunities,
        });
        return this.continueFromCheckpoint(checkpoint, normalized, onProgress);
    }

    private async continueFromCheckpoint(
        checkpoint: PipelineCheckpoint,
        normalized: NormalizedPipelineRequest,
        onProgress?: PipelineProgressCallback
    ): Promise<PipelineRun> {
        if (!PipelineExecutionRegistry.start(checkpoint.id)) {
            throw new ApiError(409, 'This pipeline run is already active');
        }
        let currentStage: PipelineExecutionStage = 'researching';
        try {
            if (!checkpoint.researchBundle) {
                currentStage = 'researching';
                onProgress?.('stage', { stage: currentStage, topic: checkpoint.selectedOpportunity.topic });
                checkpoint.researchBundle = await this.gatherResearchBundle(
                    checkpoint.selectedOpportunity,
                    normalized,
                    checkpoint.runDirectory
                );
                await this.markCheckpointComplete(checkpoint, 'research');
            }

            if (!checkpoint.articleBrief) {
                currentStage = 'briefing';
                onProgress?.('stage', { stage: currentStage });
                checkpoint.articleBrief = await this.generateBrief(checkpoint.researchBundle, normalized);
                await this.markCheckpointComplete(checkpoint, 'brief');
            }

            if (!checkpoint.draft) {
                currentStage = 'drafting';
                onProgress?.('stage', {
                    stage: currentStage,
                    wordEstimate: checkpoint.selectedOpportunity.estimatedReadTime * 220,
                });
                checkpoint.draft = await this.generateDraft(
                    checkpoint.articleBrief,
                    checkpoint.researchBundle,
                    normalized
                );
                await this.markCheckpointComplete(checkpoint, 'draft');
            }

            if (!checkpoint.editorialReview) {
                currentStage = 'editing';
                onProgress?.('stage', { stage: currentStage });
                checkpoint.editorialReview = await this.editDraft(
                    checkpoint.draft,
                    checkpoint.articleBrief,
                    checkpoint.researchBundle,
                    normalized
                );
                await this.markCheckpointComplete(checkpoint, 'edit');
            }

            if (!checkpoint.editorialReview.qualityGate) {
                currentStage = 'quality';
                const qualityRun = this.checkpointToRun(checkpoint);
                const improvement = await ArticleQualityService.improveIfNeeded(qualityRun);
                checkpoint.editorialReview = {
                    ...qualityRun.editorialReview,
                    qualityGate: improvement.qualityGate,
                };
                onProgress?.('stage', {
                    stage: currentStage,
                    score: improvement.finalScore,
                    improved: improvement.improved,
                });
                await this.markCheckpointComplete(checkpoint, 'quality');
            }

            currentStage = 'saving';
            const runBase: Omit<PipelineRun, 'artifacts'> = {
                id: checkpoint.id,
                createdAt: checkpoint.createdAt,
                request: checkpoint.request,
                opportunities: checkpoint.opportunities,
                selectedOpportunity: checkpoint.selectedOpportunity,
                researchBundle: checkpoint.researchBundle,
                articleBrief: checkpoint.articleBrief,
                draft: checkpoint.draft,
                editorialReview: checkpoint.editorialReview,
            };
            const artifacts = await ArtifactStorageService.saveRunArtifacts({
                runDirectory: checkpoint.runDirectory,
                run: runBase,
                researchBundle: checkpoint.researchBundle,
                articleBrief: checkpoint.articleBrief,
                draft: checkpoint.draft,
                editorialReview: checkpoint.editorialReview,
            });
            await ArtifactStorageService.deleteCheckpoint(checkpoint.runDirectory);

            Logger.info(`Pipeline run ${runBase.id} saved to ${artifacts.directory}`);
            const run = { ...runBase, artifacts };
            onProgress?.('complete', run);
            return run;
        } catch (error: any) {
            checkpoint.status = 'failed';
            checkpoint.failedStage = currentStage;
            checkpoint.error = error?.message || 'Pipeline failed';
            checkpoint.updatedAt = new Date().toISOString();
            try {
                await ArtifactStorageService.saveCheckpoint(checkpoint);
            } catch (checkpointError) {
                Logger.error('Failed to persist pipeline failure checkpoint', checkpointError);
            }
            throw error;
        } finally {
            PipelineExecutionRegistry.finish(checkpoint.id);
        }
    }

    private async markCheckpointComplete(
        checkpoint: PipelineCheckpoint,
        completedStage: PipelineCheckpoint['completedStage']
    ): Promise<void> {
        checkpoint.completedStage = completedStage;
        checkpoint.status = 'running';
        checkpoint.failedStage = undefined;
        checkpoint.error = undefined;
        checkpoint.updatedAt = new Date().toISOString();
        await ArtifactStorageService.saveCheckpoint(checkpoint);
    }

    private checkpointToRun(checkpoint: PipelineCheckpoint): PipelineRun {
        if (!checkpoint.researchBundle || !checkpoint.articleBrief || !checkpoint.draft || !checkpoint.editorialReview) {
            throw new Error('Checkpoint is missing data required for quality review');
        }

        return {
            id: checkpoint.id,
            createdAt: checkpoint.createdAt,
            request: checkpoint.request,
            opportunities: checkpoint.opportunities,
            selectedOpportunity: checkpoint.selectedOpportunity,
            researchBundle: checkpoint.researchBundle,
            articleBrief: checkpoint.articleBrief,
            draft: checkpoint.draft,
            editorialReview: checkpoint.editorialReview,
            artifacts: { directory: checkpoint.runDirectory, files: {} },
        };
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

        const redditPostUrl = request.redditPostUrl?.trim() || undefined;
        if (redditPostUrl && !isSupportedRedditPostUrl(redditPostUrl)) {
            throw new ApiError(400, 'Enter a valid Reddit post URL (comments link, Reddit share link, or redd.it link)');
        }

        if (subreddits.length === 0 && !redditPostUrl) {
            throw new ApiError(400, 'At least one subreddit or Reddit post URL is required');
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
            redditPostUrl,
        };
    }

    private async discoverDirectPostOpportunity(
        request: NormalizedPipelineRequest,
        onProgress?: PipelineProgressCallback
    ): Promise<TopicOpportunity> {
        let locator = parseRedditPostUrl(request.redditPostUrl || '');
        if (!locator && request.redditPostUrl) {
            const resolvedUrl = await this.redditService.resolveRedditPostUrl(request.redditPostUrl);
            locator = parseRedditPostUrl(resolvedUrl);
        }
        if (!locator) {
            throw new ApiError(400, 'Reddit share link did not resolve to a post');
        }

        onProgress?.('stage', { stage: 'discovering', source: 'reddit-post', url: request.redditPostUrl });
        const post = await this.redditService.getPostById(locator.postId);
        if (!post) {
            throw new ApiError(404, 'Reddit post not found or no longer accessible');
        }

        const analysis = await TrendingTopicsService.analyzeTrendingTopics([post], { theme: request.theme });
        const opportunity = this.buildOpportunities([{
            subreddit: post.subreddit,
            posts: [post],
            analysis,
        }])[0] || this.createFallbackDirectOpportunity(post);

        onProgress?.('stage', {
            stage: 'opportunities',
            count: 1,
            topTopic: opportunity.topic,
            selected: true,
            source: 'reddit-post',
        });
        return opportunity;
    }

    private createFallbackDirectOpportunity(post: CleanRedditPost): TopicOpportunity {
        const engagement = Math.min(100, Math.round((post.score + post.num_comments * 2) / 10));
        return {
            id: `${post.subreddit}-${post.id}`,
            topic: post.title,
            category: 'General interest',
            sourceSubreddit: post.subreddit,
            engagementScore: engagement,
            viralPotential: engagement,
            mediumSuccessProbability: engagement,
            score: engagement,
            keyThemes: [post.title],
            storyAngles: ['Develop the central tension and lived perspectives in this discussion.'],
            targetAudience: 'curious readers interested in thoughtful, practical insight',
            estimatedReadTime: 6,
            hooks: [post.title],
            relevantPosts: [post],
            whyItWorks: 'A user-selected discussion with enough substance to develop into a focused story.',
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

    private async gatherResearchBundle(
        opportunity: TopicOpportunity,
        request: Pick<NormalizedPipelineRequest, 'topicsToGather' | 'theme' | 'writingMode'>,
        runDirectory: string
    ): Promise<ResearchBundle> {
        const postIds = opportunity.relevantPosts.slice(0, request.topicsToGather + 2).map(post => post.id);
        const material = await this.referenceMaterialService.gatherReferenceMaterial(
            opportunity.topic,
            postIds,
            opportunity.sourceSubreddit,
            { theme: request.theme, writingMode: request.writingMode }
        );
        await this.referenceMaterialService.saveReferenceMaterial(material, {
            outputDir: runDirectory,
            basename: 'reference-material',
        });
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
            redditPostUrl: request.redditPostUrl,
            selectedOpportunityId: selectedOpportunity.id,
        };
    }
}
