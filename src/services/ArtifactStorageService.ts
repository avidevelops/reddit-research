import fs from 'fs/promises';
import path from 'path';
import {
    ArticleBrief,
    ArticleDraft,
    EditorialReview,
    PipelineArtifacts,
    PipelineRun,
    PipelineRunMetadata,
    ResearchBundle,
} from '../types/pipeline';

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
        const runFiles = await this.findRunFiles(root);
        const runs = await Promise.all(runFiles.map(async file => {
            const run = await this.readRunFile(file);
            return this.toMetadata(run);
        }));

        return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    static async getRun(runId: string, outputDir?: string): Promise<PipelineRun | null> {
        const runFile = await this.findRunFileById(runId, outputDir);
        return runFile ? this.readRunFile(runFile) : null;
    }

    static async deleteRun(runId: string, outputDir?: string): Promise<boolean> {
        const runFile = await this.findRunFileById(runId, outputDir);
        if (!runFile) {
            return false;
        }

        await fs.rm(path.dirname(runFile), { recursive: true, force: true });
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
            const run = await this.readRunFile(file);
            if (run.id === runId) {
                return file;
            }
        }

        return null;
    }

    private static async findRunFiles(root: string): Promise<string[]> {
        try {
            const entries = await fs.readdir(root, { withFileTypes: true });
            const files = await Promise.all(entries
                .filter(entry => entry.isDirectory())
                .map(async entry => {
                    const runFile = path.join(root, entry.name, 'pipeline-run.json');
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
        return JSON.parse(content) as PipelineRun;
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
        };
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
