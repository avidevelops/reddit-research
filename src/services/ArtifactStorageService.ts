import fs from 'fs/promises';
import path from 'path';
import {
    ArticleBrief,
    ArticleDraft,
    EditorialReview,
    PipelineArtifacts,
    PipelineRun,
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
}
