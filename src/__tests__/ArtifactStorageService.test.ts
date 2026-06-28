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
            sourceNotes: ['Source note'],
            risks: ['Avoid overclaiming'],
        });

        expect(markdown).toContain('# A Better Story');
        expect(markdown).toContain('### Opening');
        expect(markdown).toContain('- Do the thing');
    });
});
