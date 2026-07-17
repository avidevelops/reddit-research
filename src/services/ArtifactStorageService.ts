import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
    ArticleBrief,
    ArticleDraft,
    EditorialReview,
    PipelineArtifacts,
    PipelineCheckpoint,
    PipelineRun,
    PipelineRunMetadata,
    ResearchBundle,
} from '../types/pipeline';
import { CleanRedditPost } from '../utils/redditDataCleaner';
import { Logger } from '../utils/logger';
import { PipelineExecutionRegistry } from './PipelineExecutionRegistry';

export class ArtifactStorageService {
    static readonly DEFAULT_OUTPUT_DIR = 'story-outputs';

    static slugify(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'story';
    }

    static resolveOutputRoot(outputDir?: string): string {
        const relativeDir = outputDir?.trim() || process.env.STORY_OUTPUT_DIR || this.DEFAULT_OUTPUT_DIR;
        if (path.isAbsolute(relativeDir) || relativeDir.includes('..')) {
            throw new Error('Output directory must be a safe project-relative path');
        }
        return path.join(process.cwd(), relativeDir);
    }

    static buildRunDirectory(topic: string, outputDir?: string, date = new Date()): string {
        const stamp = date.toISOString().replace(/[:.]/g, '-');
        return path.join(this.resolveOutputRoot(outputDir), `${stamp}-${this.slugify(topic)}`);
    }

    static async saveRunArtifacts(params: {
        runDirectory: string;
        run: Omit<PipelineRun, 'artifacts'>;
        researchBundle: ResearchBundle;
        articleBrief: ArticleBrief;
        draft: ArticleDraft;
        editorialReview: EditorialReview;
    }): Promise<PipelineArtifacts> {
        await fs.mkdir(params.runDirectory, { recursive: true });

        const files = {
            pipelineRun: path.join(params.runDirectory, 'pipeline-run.json'),
            researchBundle: path.join(params.runDirectory, 'research-bundle.json'),
            articleBrief: path.join(params.runDirectory, 'article-brief.md'),
            draft: path.join(params.runDirectory, 'draft.md'),
            editedStory: path.join(params.runDirectory, 'edited-story.md'),
            editorialReview: path.join(params.runDirectory, 'editorial-review.json'),
            referenceMaterial: path.join(params.runDirectory, 'reference-material.json'),
            referenceSummary: path.join(params.runDirectory, 'reference-material-summary.md'),
        };

        await Promise.all([
            fs.writeFile(files.researchBundle, JSON.stringify(params.researchBundle, null, 2)),
            fs.writeFile(files.articleBrief, this.renderBriefMarkdown(params.articleBrief)),
            fs.writeFile(files.draft, params.draft.markdown),
            fs.writeFile(files.editedStory, params.editorialReview.finalMarkdown),
            fs.writeFile(files.editorialReview, JSON.stringify(params.editorialReview, null, 2)),
        ]);

        const artifacts: PipelineArtifacts = {
            directory: params.runDirectory,
            files,
        };

        await fs.writeFile(files.pipelineRun, JSON.stringify({ ...params.run, artifacts }, null, 2));
        return artifacts;
    }

    static async listRuns(outputDir?: string): Promise<PipelineRunMetadata[]> {
        const root = this.resolveOutputRoot(outputDir);
        await this.recoverOrphanedReferenceCheckpoints(root);
        const [runFiles, checkpointFiles] = await Promise.all([
            this.findRunFiles(root),
            this.findCheckpointFiles(root),
        ]);
        const completedRuns = await Promise.all(runFiles.map(async file => {
            try {
                const run = await this.readRunFile(file);
                return this.toMetadata(run);
            } catch (error) {
                Logger.warn(`Skipping unreadable pipeline run at ${file}`, error);
                return null;
            }
        }));
        const failedRuns = await Promise.all(checkpointFiles.map(async file => {
            try {
                return this.toCheckpointMetadata(await this.readCheckpointFile(file));
            } catch (error) {
                Logger.warn(`Skipping unreadable pipeline checkpoint at ${file}`, error);
                return null;
            }
        }));

        const runsById = new Map<string, PipelineRunMetadata>();
        for (const run of failedRuns) {
            if (run) runsById.set(run.id, run);
        }
        for (const run of completedRuns) {
            if (run) runsById.set(run.id, run);
        }

        return Array.from(runsById.values())
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    static async saveCheckpoint(checkpoint: PipelineCheckpoint): Promise<void> {
        await fs.mkdir(checkpoint.runDirectory, { recursive: true });
        const writes: Promise<unknown>[] = [];
        if (checkpoint.researchBundle) {
            writes.push(fs.writeFile(
                path.join(checkpoint.runDirectory, 'research-bundle.json'),
                JSON.stringify(checkpoint.researchBundle, null, 2)
            ));
        }
        if (checkpoint.articleBrief) {
            writes.push(fs.writeFile(
                path.join(checkpoint.runDirectory, 'article-brief.md'),
                this.renderBriefMarkdown(checkpoint.articleBrief)
            ));
        }
        if (checkpoint.draft) {
            writes.push(fs.writeFile(path.join(checkpoint.runDirectory, 'draft.md'), checkpoint.draft.markdown));
        }
        if (checkpoint.editorialReview) {
            writes.push(fs.writeFile(
                path.join(checkpoint.runDirectory, 'editorial-review.json'),
                JSON.stringify(checkpoint.editorialReview, null, 2)
            ));
        }
        await Promise.all(writes);
        await this.atomicWriteJson(path.join(checkpoint.runDirectory, 'pipeline-checkpoint.json'), checkpoint);
    }

    static async getCheckpoint(runId: string, outputDir?: string): Promise<PipelineCheckpoint | null> {
        const root = this.resolveOutputRoot(outputDir);
        await this.recoverOrphanedReferenceCheckpoints(root);
        const files = await this.findCheckpointFiles(root);
        for (const file of files) {
            try {
                const checkpoint = await this.readCheckpointFile(file);
                if (checkpoint.id === runId) return checkpoint;
            } catch (error) {
                Logger.warn(`Skipping unreadable pipeline checkpoint at ${file}`, error);
            }
        }
        return null;
    }

    static async deleteCheckpoint(runDirectory: string): Promise<void> {
        try {
            await fs.unlink(path.join(runDirectory, 'pipeline-checkpoint.json'));
        } catch (error: any) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }

    static async getRun(runId: string, outputDir?: string): Promise<PipelineRun | null> {
        const runFile = await this.findRunFileById(runId, outputDir);
        return runFile ? this.readRunFile(runFile) : null;
    }

    static async deleteRun(runId: string, outputDir?: string): Promise<boolean> {
        const runFile = await this.findRunFileById(runId, outputDir);
        const checkpoint = runFile ? null : await this.getCheckpoint(runId, outputDir);
        const directory = runFile ? path.dirname(runFile) : checkpoint?.runDirectory;
        if (!directory) {
            return false;
        }

        await fs.rm(directory, { recursive: true, force: true });
        return true;
    }

    static async updateRun(run: PipelineRun): Promise<PipelineRun> {
        await Promise.all([
            fs.writeFile(run.artifacts.files.pipelineRun, JSON.stringify(run, null, 2)),
            fs.writeFile(run.artifacts.files.editedStory, run.editorialReview.finalMarkdown),
            fs.writeFile(run.artifacts.files.editorialReview, JSON.stringify(run.editorialReview, null, 2)),
            fs.writeFile(run.artifacts.files.draft, run.draft.markdown),
        ]);
        return run;
    }

    static exportRun(run: PipelineRun, format: 'markdown' | 'html' | 'plaintext'): string {
        const markdown = run.editorialReview.finalMarkdown || run.draft.markdown;
        if (format === 'html') {
            return this.markdownToHtml(markdown);
        }
        if (format === 'plaintext') {
            return this.markdownToPlainText(markdown);
        }
        return markdown;
    }

    static getExportContentType(format: 'markdown' | 'html' | 'plaintext'): string {
        if (format === 'html') return 'text/html; charset=utf-8';
        if (format === 'plaintext') return 'text/plain; charset=utf-8';
        return 'text/markdown; charset=utf-8';
    }

    static getExportFilename(run: PipelineRun, format: 'markdown' | 'html' | 'plaintext'): string {
        const extension = format === 'html' ? 'html' : format === 'plaintext' ? 'txt' : 'md';
        return `${this.slugify(run.selectedOpportunity.topic)}.${extension}`;
    }

    static async readReviewArtifact(
        run: PipelineRun,
        artifact: 'research-bundle' | 'reference-material' | 'reference-summary'
    ): Promise<{ content: string; contentType: string; filename: string } | null> {
        const definitions = {
            'research-bundle': {
                file: run.artifacts.files.researchBundle,
                contentType: 'application/json; charset=utf-8',
                filename: 'research-bundle.json',
            },
            'reference-material': {
                file: run.artifacts.files.referenceMaterial,
                contentType: 'application/json; charset=utf-8',
                filename: 'reference-material.json',
            },
            'reference-summary': {
                file: run.artifacts.files.referenceSummary,
                contentType: 'text/markdown; charset=utf-8',
                filename: 'reference-material-summary.md',
            },
        } as const;
        const definition = definitions[artifact];
        if (!definition.file) return null;

        try {
            return {
                content: await fs.readFile(definition.file, 'utf8'),
                contentType: definition.contentType,
                filename: definition.filename,
            };
        } catch (error: any) {
            if (error?.code === 'ENOENT' && artifact === 'reference-summary') {
                return {
                    content: this.renderResearchSummary(run.researchBundle),
                    contentType: definition.contentType,
                    filename: definition.filename,
                };
            }
            if (error?.code === 'ENOENT') return null;
            throw error;
        }
    }

    private static renderResearchSummary(bundle: ResearchBundle): string {
        return [
            `# Reference Notes: ${bundle.topic}`,
            '',
            '## Key Insights',
            ...bundle.keyInsights.map(item => `- ${item}`),
            '',
            '## Quotes and Voices',
            ...bundle.quotes.map(item => `> ${item.text}\n> — ${item.voiceLabel || item.author || 'anonymous voice'} (${item.context})`),
            '',
            '## Pain Points',
            ...bundle.painPoints.map(item => `- ${item}`),
            '',
            '## Success Stories',
            ...bundle.successStories.map(item => `- ${item}`),
            '',
            '## Controversial Points',
            ...bundle.controversialPoints.map(item => `- ${item}`),
            '',
            '## Expert Opinions',
            ...bundle.expertOpinions.map(item => `- ${item}`),
            '',
            '## Source Posts',
            ...bundle.sourcePosts.map(post => `- [${post.title}](${post.permalink})`),
            '',
        ].join('\n');
    }

    static renderBriefMarkdown(brief: ArticleBrief): string {
        const outline = brief.outline
            .map(section => [
                `### ${section.heading}`,
                section.purpose,
                '',
                ...section.evidence.map(item => `- ${item}`),
            ].join('\n'))
            .join('\n\n');

        return [
            `# ${brief.title}`,
            '',
            '## Headline Options',
            ...brief.headlineOptions.map(item => `- ${item}`),
            '',
            '## Hook Options',
            ...brief.hookOptions.map(item => `- ${item}`),
            '',
            '## Thesis',
            brief.thesis,
            '',
            '## Promise',
            brief.promise,
            '',
            '## Outline',
            outline,
            '',
            '## Counterarguments',
            ...brief.counterarguments.map(item => `- ${item}`),
            '',
            '## Practical Takeaways',
            ...brief.practicalTakeaways.map(item => `- ${item}`),
            '',
            '## Author Stance',
            brief.authorStance,
            '',
            '## Source Notes',
            ...brief.sourceNotes.map(item => `- ${item}`),
            '',
            '## Risks',
            ...brief.risks.map(item => `- ${item}`),
            '',
        ].join('\n');
    }

    private static async findRunFileById(runId: string, outputDir?: string): Promise<string | null> {
        const root = this.resolveOutputRoot(outputDir);
        const runFiles = await this.findRunFiles(root);

        for (const file of runFiles) {
            try {
                const run = await this.readRunFile(file);
                if (run.id === runId) {
                    return file;
                }
            } catch (error) {
                Logger.warn(`Skipping unreadable pipeline run at ${file}`, error);
            }
        }

        return null;
    }

    private static async findRunFiles(root: string): Promise<string[]> {
        return this.findFilesInRunDirectories(root, 'pipeline-run.json');
    }

    private static async findCheckpointFiles(root: string): Promise<string[]> {
        return this.findFilesInRunDirectories(root, 'pipeline-checkpoint.json');
    }

    private static async findFilesInRunDirectories(root: string, filename: string): Promise<string[]> {
        try {
            const entries = await fs.readdir(root, { withFileTypes: true });
            const files = await Promise.all(entries
                .filter(entry => entry.isDirectory())
                .map(async entry => {
                    const runFile = path.join(root, entry.name, filename);
                    try {
                        await fs.access(runFile);
                        return runFile;
                    } catch {
                        return null;
                    }
                }));

            return files.filter((file): file is string => Boolean(file));
        } catch (error: any) {
            if (error?.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    private static async readRunFile(file: string): Promise<PipelineRun> {
        const content = await fs.readFile(file, 'utf8');
        const run = JSON.parse(content) as PipelineRun;
        const directory = path.dirname(file);
        run.artifacts = {
            directory,
            files: {
                pipelineRun: file,
                researchBundle: path.join(directory, 'research-bundle.json'),
                articleBrief: path.join(directory, 'article-brief.md'),
                draft: path.join(directory, 'draft.md'),
                editedStory: path.join(directory, 'edited-story.md'),
                editorialReview: path.join(directory, 'editorial-review.json'),
                referenceMaterial: path.join(directory, 'reference-material.json'),
                referenceSummary: path.join(directory, 'reference-material-summary.md'),
            },
        };
        return run;
    }

    private static async readCheckpointFile(file: string): Promise<PipelineCheckpoint> {
        const content = await fs.readFile(file, 'utf8');
        const checkpoint = JSON.parse(content) as PipelineCheckpoint;
        checkpoint.runDirectory = path.dirname(file);
        return checkpoint;
    }

    private static toMetadata(run: PipelineRun): PipelineRunMetadata {
        const finalMarkdown = run.editorialReview.finalMarkdown || run.draft.markdown || '';
        return {
            id: run.id,
            topic: run.selectedOpportunity.topic,
            createdAt: run.createdAt,
            score: run.editorialReview.qualityGate?.score ?? run.editorialReview.score,
            wordCount: this.countWords(finalMarkdown),
            estimatedReadTime: run.draft.estimatedReadTime,
            directory: run.artifacts.directory,
            status: 'completed',
            resumable: false,
        };
    }

    private static toCheckpointMetadata(checkpoint: PipelineCheckpoint): PipelineRunMetadata {
        const markdown = checkpoint.editorialReview?.finalMarkdown || checkpoint.draft?.markdown || '';
        const isActive = PipelineExecutionRegistry.isActive(checkpoint.id);
        return {
            id: checkpoint.id,
            topic: checkpoint.selectedOpportunity.topic,
            createdAt: checkpoint.createdAt,
            status: isActive ? 'running' : 'failed',
            score: checkpoint.editorialReview?.qualityGate?.score ?? checkpoint.editorialReview?.score,
            wordCount: this.countWords(markdown),
            estimatedReadTime: checkpoint.draft?.estimatedReadTime ?? checkpoint.selectedOpportunity.estimatedReadTime,
            directory: checkpoint.runDirectory,
            completedStage: checkpoint.completedStage,
            failedStage: checkpoint.failedStage,
            error: isActive ? undefined : (checkpoint.error || 'Pipeline process stopped before completion.'),
            resumable: !isActive,
        };
    }

    private static async atomicWriteJson(file: string, value: unknown): Promise<void> {
        const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
        await fs.writeFile(temporaryFile, JSON.stringify(value, null, 2));
        await fs.rename(temporaryFile, file);
    }

    private static async recoverOrphanedReferenceCheckpoints(root: string): Promise<void> {
        let entries;
        try {
            entries = await fs.readdir(root, { withFileTypes: true });
        } catch (error: any) {
            if (error?.code === 'ENOENT') return;
            throw error;
        }

        await Promise.all(entries.filter(entry => entry.isDirectory()).map(async entry => {
            const runDirectory = path.join(root, entry.name);
            const referenceFile = path.join(runDirectory, 'reference-material.json');
            try {
                await Promise.all([
                    fs.access(referenceFile),
                    fs.access(path.join(runDirectory, 'pipeline-run.json')).then(() => Promise.reject({ code: 'EXISTS' }), () => undefined),
                    fs.access(path.join(runDirectory, 'pipeline-checkpoint.json')).then(() => Promise.reject({ code: 'EXISTS' }), () => undefined),
                ]);
            } catch (error: any) {
                if (error?.code === 'EXISTS' || error?.code === 'ENOENT') return;
                throw error;
            }

            try {
                const material = JSON.parse(await fs.readFile(referenceFile, 'utf8')) as any;
                const sourcePost = material.sourcePosts?.[0];
                if (!sourcePost || !material.topic) return;
                const sourceSubreddit = sourcePost.subreddit || sourcePost.permalink?.match(/^\/r\/([^/]+)/i)?.[1];
                if (!sourceSubreddit) return;

                const relevantPosts: CleanRedditPost[] = material.sourcePosts.map((post: any) => ({
                    id: post.id,
                    title: post.title,
                    author: post.author || '[deleted]',
                    subreddit: post.subreddit || sourceSubreddit,
                    selftext: post.selftext || '',
                    score: post.score || 0,
                    num_comments: post.comments?.length || 0,
                    created_utc: post.created_utc || 0,
                    permalink: post.permalink,
                    upvote_ratio: post.upvote_ratio || 0,
                    total_awards_received: post.total_awards_received || 0,
                    all_awardings: post.all_awardings || [],
                    gilded: post.gilded || 0,
                }));
                const engagement = Math.min(100, Math.round((sourcePost.score + (sourcePost.comments?.length || 0) * 2) / 10));
                const selectedOpportunity = {
                    id: `${sourceSubreddit}-${sourcePost.id}`,
                    topic: material.topic,
                    category: 'General interest',
                    sourceSubreddit,
                    engagementScore: engagement,
                    viralPotential: engagement,
                    mediumSuccessProbability: engagement,
                    score: engagement,
                    keyThemes: material.keyInsights?.slice(0, 5) || [material.topic],
                    storyAngles: material.narrativeElements?.hooks?.slice(0, 3) || [material.topic],
                    targetAudience: 'curious Medium readers interested in thoughtful, practical insight',
                    estimatedReadTime: 7,
                    hooks: material.narrativeElements?.hooks || [material.topic],
                    relevantPosts,
                    whyItWorks: 'Recovered from durable reference material after an interrupted pipeline run.',
                };
                const researchBundle: ResearchBundle = {
                    topic: material.topic,
                    sourceSubreddit,
                    opportunity: selectedOpportunity,
                    keyInsights: material.keyInsights || [],
                    quotes: (material.quotableComments || []).map((comment: any) => ({
                        ...comment,
                        voiceLabel: comment.voiceLabel || comment.author || 'anonymous voice',
                    })),
                    painPoints: material.commonPainPoints || [],
                    successStories: material.successStories || [],
                    controversialPoints: material.controversialPoints || [],
                    expertOpinions: material.expertOpinions || [],
                    statistics: material.statistics || [],
                    sourcePosts: material.sourcePosts.map((post: any) => ({
                        id: post.id,
                        title: post.title,
                        author: post.author || '[deleted]',
                        score: post.score || 0,
                        num_comments: post.comments?.length || 0,
                        permalink: `https://reddit.com${post.permalink}`,
                    })),
                };
                const createdAt = this.inferCreatedAt(entry.name);
                await this.saveCheckpoint({
                    id: randomUUID(),
                    createdAt,
                    updatedAt: new Date().toISOString(),
                    status: 'failed',
                    completedStage: 'research',
                    failedStage: 'briefing',
                    error: 'Recovered after interruption. Brief and later stages were not saved by the previous pipeline version.',
                    runDirectory,
                    request: {
                        subreddits: [sourceSubreddit],
                        timeframe: 'week',
                        limit: 40,
                        topicsToGather: Math.min(5, Math.max(1, relevantPosts.length)),
                        targetAudience: selectedOpportunity.targetAudience,
                        articleStyle: 'insightful narrative essay with practical takeaways',
                        theme: 'General interest',
                        writingMode: 'research-report',
                        redditPostUrl: `https://reddit.com${sourcePost.permalink}`,
                        selectedOpportunityId: selectedOpportunity.id,
                    },
                    opportunities: [selectedOpportunity],
                    selectedOpportunity,
                    researchBundle,
                });
                Logger.info(`Recovered resumable pipeline checkpoint from ${referenceFile}`);
            } catch (error) {
                Logger.warn(`Could not recover interrupted pipeline folder ${runDirectory}`, error);
            }
        }));
    }

    private static inferCreatedAt(directoryName: string): string {
        const match = directoryName.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
        return match ? `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z` : new Date().toISOString();
    }

    private static countWords(text: string): number {
        return text.trim().split(/\s+/).filter(Boolean).length;
    }

    private static markdownToPlainText(markdown: string): string {
        return markdown
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/!\[[^\]]*]\([^)]*\)/g, '')
            .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/^>\s?/gm, '')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .replace(/[*_~]/g, '')
            .trim();
    }

    private static markdownToHtml(markdown: string): string {
        const escapeHtml = (value: string) => value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const body = markdown.split(/\n{2,}/)
            .map(block => {
                const trimmed = block.trim();
                if (!trimmed) return '';
                const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
                if (heading) {
                    const level = heading[1].length;
                    return `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
                }
                if (trimmed.startsWith('>')) {
                    return `<blockquote>${escapeHtml(trimmed.replace(/^>\s?/gm, ''))}</blockquote>`;
                }
                if (/^[-*+]\s+/m.test(trimmed)) {
                    const items = trimmed.split('\n')
                        .map(line => line.replace(/^[-*+]\s+/, '').trim())
                        .filter(Boolean)
                        .map(item => `<li>${escapeHtml(item)}</li>`)
                        .join('');
                    return `<ul>${items}</ul>`;
                }
                return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
            })
            .join('\n');

        return `<!doctype html><html><head><meta charset="utf-8"><title>Story Export</title></head><body>${body}</body></html>`;
    }
}
