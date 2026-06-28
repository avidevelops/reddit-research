import { ArtifactStorageService } from '../services/ArtifactStorageService';

describe('ArtifactStorageService', () => {
    it('creates readable slugs', () => {
        expect(ArtifactStorageService.slugify('AI Is Eating Software? Yes.')).toBe('ai-is-eating-software-yes');
    });

    it('rejects unsafe output directories', () => {
        expect(() => ArtifactStorageService.resolveOutputRoot('../outside')).toThrow('safe project-relative path');
        expect(() => ArtifactStorageService.resolveOutputRoot('/tmp/outside')).toThrow('safe project-relative path');
    });

    it('renders article briefs to Markdown', () => {
        const markdown = ArtifactStorageService.renderBriefMarkdown({
            title: 'A Better Story',
            headlineOptions: ['Headline one'],
            hookOptions: ['Hook one'],
            thesis: 'The thesis.',
            targetAudience: 'Developers',
            promise: 'A useful promise.',
            outline: [{ heading: 'Opening', purpose: 'Set stakes', evidence: ['Reddit source'] }],
            counterarguments: ['A counterpoint'],
            practicalTakeaways: ['Do the thing'],
            authorStance: 'I believe the story needs a sharper stance.',
            sourceNotes: ['Source note'],
            risks: ['Avoid overclaiming'],
        });

        expect(markdown).toContain('# A Better Story');
        expect(markdown).toContain('### Opening');
        expect(markdown).toContain('- Do the thing');
        expect(markdown).toContain('## Author Stance');
    });

    it('exports runs as markdown, html, and plaintext', () => {
        const run = {
            selectedOpportunity: { topic: 'AI Tooling' },
            draft: { markdown: '# Draft', estimatedReadTime: 4 },
            editorialReview: {
                score: 81,
                strengths: [],
                improvements: [],
                factCheckNotes: [],
                finalMarkdown: '# Final Story\n\n> A quote\n\n- One point',
            },
        } as any;

        expect(ArtifactStorageService.exportRun(run, 'markdown')).toContain('# Final Story');
        expect(ArtifactStorageService.exportRun(run, 'html')).toContain('<h1>Final Story</h1>');
        expect(ArtifactStorageService.exportRun(run, 'plaintext')).not.toContain('#');
        expect(ArtifactStorageService.getExportFilename(run, 'plaintext')).toBe('ai-tooling.txt');
    });
});
