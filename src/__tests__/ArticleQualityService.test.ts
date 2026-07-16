import { ArticleQualityService } from '../services/ArticleQualityService';
import { LLMService } from '../services/LLMService';
import { ArticleBrief, ArticleDraft, EditorialReview, PipelineRun, QualityGate } from '../types/pipeline';

describe('ArticleQualityService', () => {
    const brief: ArticleBrief = {
        title: 'A Better Story',
        headlineOptions: ['A Better Story'],
        hookOptions: ['A strong hook'],
        thesis: 'The thesis is clear.',
        targetAudience: 'Developers',
        promise: 'A practical payoff.',
        outline: [{ heading: 'Opening', purpose: 'Set stakes', evidence: ['Reddit source'] }],
        counterarguments: ['A fair counterpoint'],
        practicalTakeaways: ['Do the useful thing'],
        authorStance: 'I believe the useful thing matters more than the fashionable thing.',
        sourceNotes: ['Hidden Reddit thread note'],
        risks: ['Avoid overclaiming'],
    };

    const draft: ArticleDraft = {
        title: brief.title,
        markdown: '# A Better Story\n\nDraft body.',
        sourceLinks: ['https://reddit.com/r/test/comments/abc'],
        estimatedReadTime: 5,
    };

    const review: EditorialReview = {
        score: 65,
        strengths: ['Readable'],
        improvements: ['Needs evidence'],
        factCheckNotes: ['No fake stats'],
        finalMarkdown: '# A Better Story\n\nEdited body.',
    };

    const qualityGate: QualityGate = {
        passed: false,
        score: 61,
        dimensionScores: {
            hookStrength: 70,
            thesisClarity: 75,
            evidenceDensity: 50,
            narrativeArc: 60,
            mediumFormatCompliance: 72,
            originality: 55,
        },
        blockers: ['Evidence is too thin'],
        suggestions: ['Add source-backed specifics'],
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('scores an article with all quality dimensions', async () => {
        jest.spyOn(LLMService, 'generateJson').mockResolvedValue(qualityGate as never);

        const result = await ArticleQualityService.scoreArticle(draft, review, brief);

        expect(result.score).toBe(61);
        expect(result.dimensionScores.hookStrength).toBe(70);
        expect(result.blockers).toContain('Evidence is too thin');
    });

    it('improves the article when quality score is below threshold', async () => {
        const improvedReview: EditorialReview = {
            score: 82,
            strengths: ['Sharper hook'],
            improvements: ['Added evidence'],
            factCheckNotes: ['Sources preserved'],
            finalMarkdown: '# A Better Story\n\nImproved body.',
        };

        jest.spyOn(LLMService, 'generateJson')
            .mockResolvedValueOnce(qualityGate as never)
            .mockResolvedValueOnce(improvedReview as never);

        const run = makeRun();
        const result = await ArticleQualityService.improveIfNeeded(run, 72);

        expect(result.improved).toBe(true);
        expect(result.finalScore).toBe(82);
        expect(run.editorialReview.finalMarkdown).toContain('Improved body');
        expect(LLMService.generateJson).toHaveBeenCalledTimes(2);
    });

    it('does not improve the article when quality score passes threshold', async () => {
        jest.spyOn(LLMService, 'generateJson').mockResolvedValue({
            ...qualityGate,
            passed: true,
            score: 83,
        } as never);

        const result = await ArticleQualityService.improveIfNeeded(makeRun(), 72);

        expect(result.improved).toBe(false);
        expect(result.finalScore).toBe(83);
        expect(LLMService.generateJson).toHaveBeenCalledTimes(1);
    });

    function makeRun(): PipelineRun {
        return {
            id: 'run-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            request: {
                subreddits: ['test'],
                timeframe: 'week',
                limit: 40,
                topicsToGather: 3,
                targetAudience: 'Developers',
                articleStyle: 'narrative essay',
                theme: 'Technology',
                writingMode: 'research-report',
            },
            opportunities: [],
            selectedOpportunity: {
                id: 'test-topic',
                topic: 'A Better Story',
                category: 'Technology',
                sourceSubreddit: 'test',
                engagementScore: 80,
                viralPotential: 70,
                mediumSuccessProbability: 75,
                score: 78,
                keyThemes: ['AI'],
                storyAngles: ['A useful angle'],
                targetAudience: 'Developers',
                estimatedReadTime: 5,
                hooks: ['A hook'],
                relevantPosts: [],
                whyItWorks: 'Clear audience fit',
            },
            researchBundle: {
                topic: 'A Better Story',
                sourceSubreddit: 'test',
                opportunity: {} as never,
                keyInsights: [],
                quotes: [],
                painPoints: [],
                successStories: [],
                controversialPoints: [],
                expertOpinions: [],
                statistics: [],
                sourcePosts: [],
            },
            articleBrief: brief,
            draft,
            editorialReview: review,
            artifacts: { directory: '', files: {} },
        };
    }
});
