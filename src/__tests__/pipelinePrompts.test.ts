import { buildBriefPrompt, buildDraftPrompt } from '../services/pipelinePrompts';
import { ArticleBrief, ResearchBundle } from '../types/pipeline';

describe('pipeline prompt modes', () => {
    const context = {
        targetAudience: 'Curious readers',
        articleStyle: 'essay',
        theme: 'Philosophy / Spirituality',
        writingMode: 'publish-ready' as const,
    };
    const researchBundle: ResearchBundle = {
        topic: 'Meaning and ambition',
        sourceSubreddit: 'philosophy',
        opportunity: {} as never,
        keyInsights: ['People want ambition without losing themselves.'],
        quotes: [],
        painPoints: [],
        successStories: [],
        controversialPoints: [],
        expertOpinions: [],
        statistics: [],
        sourcePosts: [],
    };
    const brief: ArticleBrief = {
        title: 'Meaning and Ambition',
        headlineOptions: ['Meaning and Ambition'],
        hookOptions: ['A strong hook'],
        thesis: 'Ambition needs a philosophy of enough.',
        targetAudience: 'Curious readers',
        promise: 'A practical reframe.',
        outline: [{ heading: 'Opening', purpose: 'Set stakes', evidence: ['A source-backed insight'] }],
        counterarguments: ['Ambition can be healthy.'],
        practicalTakeaways: ['Name enough before chasing more.'],
        authorStance: 'I believe ambition is healthiest when it has a boundary.',
        sourceNotes: ['Hidden provenance'],
        risks: ['Avoid pretending this is universal.'],
    };

    it('uses publish-ready hygiene rules when requested', () => {
        const prompt = buildDraftPrompt(brief, researchBundle, context);

        expect(prompt).toContain('Philosophy / Spirituality');
        expect(prompt).toContain('NEVER mention Reddit');
        expect(prompt).toContain('No footnote-style sources section');
    });

    it('keeps research-report mode source-aware', () => {
        const prompt = buildBriefPrompt(researchBundle, {
            ...context,
            writingMode: 'research-report',
        });

        expect(prompt).toContain('source-aware');
        expect(prompt).toContain('source note with Reddit link context');
    });
});
