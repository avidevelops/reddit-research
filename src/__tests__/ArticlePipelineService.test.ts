import { ArticlePipelineService } from '../services/ArticlePipelineService';
import { ArticleQualityService } from '../services/ArticleQualityService';
import { ArtifactStorageService } from '../services/ArtifactStorageService';
import { LLMService } from '../services/LLMService';
import { ReferenceMaterialService } from '../services/ReferenceMaterialService';
import { RedditService } from '../services/RedditService';
import { TrendingTopicsService } from '../services/TrendingTopicsService';
import { ArticleBrief, ArticleDraft, EditorialReview, PipelineCheckpoint, TopicOpportunity } from '../types/pipeline';
import { CleanRedditPost } from '../utils/redditDataCleaner';

describe('ArticlePipelineService', () => {
    const post: CleanRedditPost = {
        id: 'abc123',
        title: 'Developers are rethinking AI tools',
        author: 'builder',
        subreddit: 'programming',
        selftext: 'A thoughtful discussion about AI coding tools.',
        score: 120,
        num_comments: 45,
        created_utc: Date.now() / 1000,
        permalink: '/r/programming/comments/abc123/story',
        upvote_ratio: 0.92,
        total_awards_received: 0,
        all_awardings: [],
        gilded: 0,
    };

    beforeEach(() => {
        jest.spyOn(ArtifactStorageService, 'saveCheckpoint').mockResolvedValue();
        jest.spyOn(ArtifactStorageService, 'deleteCheckpoint').mockResolvedValue();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('runs the Markdown story pipeline with mocked external services', async () => {
        const brief: ArticleBrief = {
            title: 'The AI Tooling Hangover',
            headlineOptions: ['The AI Tooling Hangover'],
            hookOptions: ['Everyone adopted the tool. Then the real work began.'],
            thesis: 'AI coding tools need better human workflows.',
            targetAudience: 'Developers',
            promise: 'A grounded way to evaluate AI tooling.',
            outline: [{ heading: 'The adoption rush', purpose: 'Set context', evidence: ['Reddit discussion'] }],
            counterarguments: ['Some teams are seeing real gains.'],
            practicalTakeaways: ['Measure workflow quality, not novelty.'],
            authorStance: 'I believe AI tooling succeeds only when teams redesign their workflows.',
            sourceNotes: ['Reddit thread from r/programming'],
            risks: ['Do not overclaim productivity data.'],
        };
        const draft: ArticleDraft = {
            title: brief.title,
            markdown: '# The AI Tooling Hangover\n\nDraft body.\n\n## Sources\n\n- https://reddit.com/r/programming/comments/abc123/story',
            sourceLinks: ['https://reddit.com/r/programming/comments/abc123/story'],
            estimatedReadTime: 6,
        };
        const review: EditorialReview = {
            score: 88,
            strengths: ['Clear thesis'],
            improvements: ['Sharper hook'],
            factCheckNotes: ['No fabricated claims'],
            finalMarkdown: '# The AI Tooling Hangover\n\nEdited body.\n\n## Sources\n\n- https://reddit.com/r/programming/comments/abc123/story',
        };

        const redditService = {
            getSubredditPosts: jest.fn().mockResolvedValue([post]),
        } as unknown as RedditService;

        const referenceMaterialService = {
            saveReferenceMaterial: jest.fn().mockResolvedValue('reference-materials/programming-1-reference.json'),
            gatherReferenceMaterial: jest.fn().mockResolvedValue({
                topicId: 'programming-1',
                topic: 'AI tooling',
                sourcePosts: [{ ...post, comments: [] }],
                keyInsights: ['Developers want less hype and more workflow clarity.'],
                quotableComments: [{ text: 'The hard part is changing habits.', author: 'builder', context: 'Tool adoption', relevance: 'Shows friction' }],
                commonPainPoints: ['Workflow churn'],
                successStories: ['Teams with standards report smoother use.'],
                controversialPoints: ['Whether AI reduces skill growth'],
                expertOpinions: ['Senior developers emphasize review discipline.'],
                statistics: [],
                narrativeElements: {
                    hooks: ['The tool was not the hard part.'],
                    personalStories: [],
                    transformations: [],
                },
            }),
        } as unknown as ReferenceMaterialService;

        jest.spyOn(TrendingTopicsService, 'analyzeTrendingTopics').mockResolvedValue({
            posts: [post],
            trendingTopics: [{
                topic: 'AI tooling',
                category: 'Software development',
                engagementScore: 80,
                viralPotential: 75,
                mediumSuccessProbability: 90,
                keyThemes: ['AI', 'workflow'],
                storyAngles: ['The hidden cost of AI tooling'],
                targetAudience: 'Developers',
                estimatedReadTime: 7,
                hooks: ['AI tools changed the easy part.'],
                relevantPosts: [post],
            }],
            overallTheme: 'Developers are recalibrating AI expectations.',
            bestStoryOpportunity: {
                title: brief.title,
                angle: 'Workflow over hype',
                whyItWillWork: 'It connects a live developer debate to practical Medium advice.',
                relevantPosts: [post],
            },
        });

        jest.spyOn(LLMService, 'generateJson').mockImplementation(async (_prompt, _validate, label) => {
            if (label.includes('brief')) return brief as never;
            if (label.includes('draft')) return draft as never;
            return review as never;
        });
        jest.spyOn(ArticleQualityService, 'improveIfNeeded').mockImplementation(async (run) => ({
            improved: false,
            finalMarkdown: run.editorialReview.finalMarkdown,
            finalScore: 88,
            qualityGate: {
                passed: true,
                score: 88,
                dimensionScores: {
                    hookStrength: 88,
                    thesisClarity: 88,
                    evidenceDensity: 88,
                    narrativeArc: 88,
                    mediumFormatCompliance: 88,
                    originality: 88,
                },
                blockers: [],
                suggestions: [],
            },
        }));
        jest.spyOn(ArtifactStorageService, 'saveRunArtifacts').mockResolvedValue({
            directory: 'story-outputs/2026-01-01-ai-tooling',
            files: {
                pipelineRun: 'story-outputs/2026-01-01-ai-tooling/pipeline-run.json',
                researchBundle: 'story-outputs/2026-01-01-ai-tooling/research-bundle.json',
                articleBrief: 'story-outputs/2026-01-01-ai-tooling/article-brief.md',
                draft: 'story-outputs/2026-01-01-ai-tooling/draft.md',
                editedStory: 'story-outputs/2026-01-01-ai-tooling/edited-story.md',
                editorialReview: 'story-outputs/2026-01-01-ai-tooling/editorial-review.json',
            },
        });

        const service = new ArticlePipelineService(redditService, referenceMaterialService);
        const run = await service.runPipeline({
            subreddits: ['programming'],
            theme: 'Technology',
            writingMode: 'research-report',
        });

        expect(run.selectedOpportunity.topic).toBe('AI tooling');
        expect(run.request.theme).toBe('Technology');
        expect(run.request.writingMode).toBe('research-report');
        expect(run.editorialReview.finalMarkdown).toContain('Edited body');
        expect(run.artifacts.files.editedStory).toContain('edited-story.md');
        expect(referenceMaterialService.saveReferenceMaterial).toHaveBeenCalledTimes(1);
    });

    it('discovers opportunities without gathering references', async () => {
        const redditService = {
            getSubredditPosts: jest.fn().mockResolvedValue([post]),
        } as unknown as RedditService;
        const referenceMaterialService = {
            saveReferenceMaterial: jest.fn(),
            gatherReferenceMaterial: jest.fn(),
        } as unknown as ReferenceMaterialService;

        jest.spyOn(TrendingTopicsService, 'analyzeTrendingTopics').mockResolvedValue({
            posts: [post],
            trendingTopics: [{
                topic: 'AI tooling',
                category: 'Software development',
                engagementScore: 80,
                viralPotential: 75,
                mediumSuccessProbability: 90,
                keyThemes: ['AI', 'workflow'],
                storyAngles: ['The hidden cost of AI tooling'],
                targetAudience: 'Developers',
                estimatedReadTime: 7,
                hooks: ['AI tools changed the easy part.'],
                relevantPosts: [post],
            }],
            overallTheme: 'Developers are recalibrating AI expectations.',
            bestStoryOpportunity: {
                title: 'The AI Tooling Hangover',
                angle: 'Workflow over hype',
                whyItWillWork: 'It connects a live developer debate to practical Medium advice.',
                relevantPosts: [post],
            },
        });

        const service = new ArticlePipelineService(redditService, referenceMaterialService);
        const opportunities = await service.discoverOpportunities({
            subreddits: ['programming'],
            theme: 'Technology',
        });

        expect(opportunities).toHaveLength(1);
        expect(opportunities[0].topic).toBe('AI tooling');
        expect(referenceMaterialService.gatherReferenceMaterial).not.toHaveBeenCalled();
        expect(TrendingTopicsService.analyzeTrendingTopics).toHaveBeenCalledWith([post], { theme: 'Technology' });
    });

    it('runs from a selected opportunity without rediscovering topics', async () => {
        const selectedOpportunity: TopicOpportunity = {
            id: 'programming-ai-tooling',
            topic: 'AI tooling',
            category: 'Software development',
            sourceSubreddit: 'programming',
            engagementScore: 80,
            viralPotential: 75,
            mediumSuccessProbability: 90,
            score: 88,
            keyThemes: ['AI', 'workflow'],
            storyAngles: ['The hidden cost of AI tooling'],
            targetAudience: 'Developers',
            estimatedReadTime: 7,
            hooks: ['AI tools changed the easy part.'],
            relevantPosts: [post],
            whyItWorks: 'It connects a live developer debate to practical Medium advice.',
        };
        const brief: ArticleBrief = {
            title: 'The AI Tooling Hangover',
            headlineOptions: ['The AI Tooling Hangover'],
            hookOptions: ['Everyone adopted the tool. Then the real work began.'],
            thesis: 'AI coding tools need better human workflows.',
            targetAudience: 'Developers',
            promise: 'A grounded way to evaluate AI tooling.',
            outline: [{ heading: 'The adoption rush', purpose: 'Set context', evidence: ['Reddit discussion'] }],
            counterarguments: ['Some teams are seeing real gains.'],
            practicalTakeaways: ['Measure workflow quality, not novelty.'],
            authorStance: 'I believe AI tooling succeeds only when teams redesign their workflows.',
            sourceNotes: ['Reddit thread from r/programming'],
            risks: ['Do not overclaim productivity data.'],
        };
        const draft: ArticleDraft = {
            title: brief.title,
            markdown: '# The AI Tooling Hangover\n\nDraft body.',
            sourceLinks: ['https://reddit.com/r/programming/comments/abc123/story'],
            estimatedReadTime: 6,
        };
        const review: EditorialReview = {
            score: 88,
            strengths: ['Clear thesis'],
            improvements: ['Sharper hook'],
            factCheckNotes: ['No fabricated claims'],
            finalMarkdown: '# The AI Tooling Hangover\n\nEdited body.',
        };
        const redditService = {
            getSubredditPosts: jest.fn(),
        } as unknown as RedditService;
        const referenceMaterialService = {
            saveReferenceMaterial: jest.fn().mockResolvedValue('reference-materials/programming-1-reference.json'),
            gatherReferenceMaterial: jest.fn().mockResolvedValue({
                topicId: 'programming-1',
                topic: 'AI tooling',
                sourcePosts: [{ ...post, comments: [] }],
                keyInsights: ['Developers want less hype and more workflow clarity.'],
                quotableComments: [{ text: 'The hard part is changing habits.', voiceLabel: 'a developer', context: 'Tool adoption', relevance: 'Shows friction' }],
                commonPainPoints: ['Workflow churn'],
                successStories: ['Teams with standards report smoother use.'],
                controversialPoints: ['Whether AI reduces skill growth'],
                expertOpinions: ['Senior developers emphasize review discipline.'],
                statistics: [],
                narrativeElements: {
                    hooks: ['The tool was not the hard part.'],
                    personalStories: [],
                    transformations: [],
                },
            }),
        } as unknown as ReferenceMaterialService;

        jest.spyOn(TrendingTopicsService, 'analyzeTrendingTopics');
        jest.spyOn(LLMService, 'generateJson').mockImplementation(async (_prompt, _validate, label) => {
            if (label.includes('brief')) return brief as never;
            if (label.includes('draft')) return draft as never;
            return review as never;
        });
        jest.spyOn(ArticleQualityService, 'improveIfNeeded').mockImplementation(async (run) => ({
            improved: false,
            finalMarkdown: run.editorialReview.finalMarkdown,
            finalScore: 88,
            qualityGate: {
                passed: true,
                score: 88,
                dimensionScores: {
                    hookStrength: 88,
                    thesisClarity: 88,
                    evidenceDensity: 88,
                    narrativeArc: 88,
                    mediumFormatCompliance: 88,
                    originality: 88,
                },
                blockers: [],
                suggestions: [],
            },
        }));
        jest.spyOn(ArtifactStorageService, 'saveRunArtifacts').mockResolvedValue({
            directory: 'story-outputs/2026-01-01-ai-tooling',
            files: {
                pipelineRun: 'story-outputs/2026-01-01-ai-tooling/pipeline-run.json',
                researchBundle: 'story-outputs/2026-01-01-ai-tooling/research-bundle.json',
                articleBrief: 'story-outputs/2026-01-01-ai-tooling/article-brief.md',
                draft: 'story-outputs/2026-01-01-ai-tooling/draft.md',
                editedStory: 'story-outputs/2026-01-01-ai-tooling/edited-story.md',
                editorialReview: 'story-outputs/2026-01-01-ai-tooling/editorial-review.json',
            },
        });

        const service = new ArticlePipelineService(redditService, referenceMaterialService);
        const run = await service.runPipeline({
            subreddits: ['programming'],
            selectedOpportunity,
            opportunitiesSnapshot: [selectedOpportunity],
            theme: 'Technology',
            writingMode: 'publish-ready',
        });

        expect(run.selectedOpportunity.id).toBe(selectedOpportunity.id);
        expect(run.request.selectedOpportunityId).toBe(selectedOpportunity.id);
        expect(run.request.writingMode).toBe('publish-ready');
        expect(redditService.getSubredditPosts).not.toHaveBeenCalled();
        expect(TrendingTopicsService.analyzeTrendingTopics).not.toHaveBeenCalled();
        expect(referenceMaterialService.gatherReferenceMaterial).toHaveBeenCalledWith(
            'AI tooling',
            ['abc123'],
            'programming',
            { theme: 'Technology', writingMode: 'publish-ready' }
        );
        expect(referenceMaterialService.saveReferenceMaterial).toHaveBeenCalledTimes(1);
    });

    it('runs from a direct Reddit post URL without subreddit discovery', async () => {
        const brief: ArticleBrief = {
            title: 'The AI Tooling Hangover',
            headlineOptions: ['The AI Tooling Hangover'],
            hookOptions: ['The tool was not the hard part.'],
            thesis: 'AI tools require better workflows.',
            targetAudience: 'Developers',
            promise: 'A practical framework.',
            outline: [{ heading: 'The tension', purpose: 'Set context', evidence: ['Source discussion'] }],
            counterarguments: [],
            practicalTakeaways: ['Measure workflow quality.'],
            authorStance: 'Workflow matters more than novelty.',
            sourceNotes: ['Direct Reddit post'],
            risks: ['Avoid overclaiming.'],
        };
        const draft: ArticleDraft = {
            title: brief.title,
            markdown: '# The AI Tooling Hangover\n\nDraft.',
            sourceLinks: [],
            estimatedReadTime: 5,
        };
        const review: EditorialReview = {
            score: 86,
            strengths: ['Focused'],
            improvements: [],
            factCheckNotes: [],
            finalMarkdown: '# The AI Tooling Hangover\n\nFinal.',
        };
        const redditService = {
            getPostById: jest.fn().mockResolvedValue(post),
            getSubredditPosts: jest.fn(),
        } as unknown as RedditService;
        const referenceMaterialService = {
            gatherReferenceMaterial: jest.fn().mockResolvedValue({
                topicId: 'programming-1',
                topic: 'AI tooling',
                sourcePosts: [{ ...post, comments: [] }],
                keyInsights: ['Workflow design matters.'],
                quotableComments: [],
                commonPainPoints: [],
                successStories: [],
                controversialPoints: [],
                expertOpinions: [],
                statistics: [],
                narrativeElements: { hooks: [], personalStories: [], transformations: [] },
            }),
            saveReferenceMaterial: jest.fn().mockResolvedValue('reference-material.json'),
        } as unknown as ReferenceMaterialService;

        jest.spyOn(TrendingTopicsService, 'analyzeTrendingTopics').mockResolvedValue({
            posts: [post],
            trendingTopics: [{
                topic: 'AI tooling',
                category: 'Software development',
                engagementScore: 80,
                viralPotential: 75,
                mediumSuccessProbability: 90,
                keyThemes: ['AI', 'workflow'],
                storyAngles: ['Workflow over hype'],
                targetAudience: 'Developers',
                estimatedReadTime: 6,
                hooks: ['The tool was not the hard part.'],
                relevantPosts: [post],
            }],
            overallTheme: 'AI workflow tradeoffs',
            bestStoryOpportunity: {
                title: brief.title,
                angle: 'Workflow over hype',
                whyItWillWork: 'It starts from a focused user-selected discussion.',
            },
        });
        jest.spyOn(ArticleQualityService, 'improveIfNeeded').mockResolvedValue({
            improved: false,
            finalMarkdown: review.finalMarkdown,
            finalScore: 86,
            qualityGate: {
                passed: true,
                score: 86,
                dimensionScores: {
                    hookStrength: 86,
                    thesisClarity: 86,
                    evidenceDensity: 86,
                    narrativeArc: 86,
                    mediumFormatCompliance: 86,
                    originality: 86,
                },
                blockers: [],
                suggestions: [],
            },
        });
        jest.spyOn(ArtifactStorageService, 'saveRunArtifacts').mockResolvedValue({
            directory: 'story-outputs/direct-post',
            files: {},
        });

        const service = new ArticlePipelineService(redditService, referenceMaterialService);
        jest.spyOn(service, 'generateBrief').mockResolvedValue(brief);
        jest.spyOn(service, 'generateDraft').mockResolvedValue(draft);
        jest.spyOn(service, 'editDraft').mockResolvedValue(review);

        const run = await service.runPipeline({
            redditPostUrl: 'https://www.reddit.com/r/programming/comments/abc123/a_story/',
            theme: 'Technology',
            writingMode: 'publish-ready',
        });

        expect(redditService.getPostById).toHaveBeenCalledWith('abc123');
        expect(redditService.getSubredditPosts).not.toHaveBeenCalled();
        expect(run.selectedOpportunity.relevantPosts).toEqual([post]);
        expect(run.request.redditPostUrl).toContain('/comments/abc123/');
        expect(referenceMaterialService.gatherReferenceMaterial).toHaveBeenCalledWith(
            'AI tooling',
            ['abc123'],
            'programming',
            { theme: 'Technology', writingMode: 'publish-ready' }
        );
    });

    it('resumes from the first incomplete stage without repeating saved LLM work', async () => {
        const opportunity: TopicOpportunity = {
            id: 'programming-ai-tooling',
            topic: 'AI tooling',
            category: 'Technology',
            sourceSubreddit: 'programming',
            engagementScore: 80,
            viralPotential: 75,
            mediumSuccessProbability: 90,
            score: 85,
            keyThemes: ['AI'],
            storyAngles: ['Workflow over hype'],
            targetAudience: 'Developers',
            estimatedReadTime: 6,
            hooks: ['The tool was not the hard part.'],
            relevantPosts: [post],
            whyItWorks: 'Focused discussion.',
        };
        const researchBundle = {
            topic: opportunity.topic,
            sourceSubreddit: 'programming',
            opportunity,
            keyInsights: ['Workflow matters.'],
            quotes: [],
            painPoints: [],
            successStories: [],
            controversialPoints: [],
            expertOpinions: [],
            statistics: [],
            sourcePosts: [{
                id: post.id,
                title: post.title,
                author: post.author,
                score: post.score,
                num_comments: post.num_comments,
                permalink: `https://reddit.com${post.permalink}`,
            }],
        };
        const brief: ArticleBrief = {
            title: 'AI Tooling',
            headlineOptions: ['AI Tooling'],
            hookOptions: ['A hook'],
            thesis: 'Workflow matters.',
            targetAudience: 'Developers',
            promise: 'Clarity.',
            outline: [{ heading: 'Start', purpose: 'Explain', evidence: ['Discussion'] }],
            counterarguments: [],
            practicalTakeaways: [],
            authorStance: 'Workflow first.',
            sourceNotes: [],
            risks: [],
        };
        const draft: ArticleDraft = {
            title: brief.title,
            markdown: '# AI Tooling\n\nDraft.',
            sourceLinks: [],
            estimatedReadTime: 5,
        };
        const review: EditorialReview = {
            score: 88,
            strengths: ['Clear'],
            improvements: [],
            factCheckNotes: [],
            finalMarkdown: '# AI Tooling\n\nEdited.',
        };
        const checkpoint: PipelineCheckpoint = {
            id: 'failed-run-1',
            createdAt: '2026-07-16T10:00:00.000Z',
            updatedAt: '2026-07-16T10:05:00.000Z',
            status: 'failed',
            completedStage: 'draft',
            failedStage: 'editing',
            error: 'Editor failed',
            runDirectory: 'story-outputs/failed-run-1',
            request: {
                subreddits: ['programming'],
                timeframe: 'week',
                limit: 40,
                topicsToGather: 3,
                targetAudience: 'Developers',
                articleStyle: 'narrative essay',
                theme: 'Technology',
                writingMode: 'research-report',
            },
            opportunities: [opportunity],
            selectedOpportunity: opportunity,
            researchBundle,
            articleBrief: brief,
            draft,
        };
        const redditService = {
            getSubredditPosts: jest.fn(),
            getPostById: jest.fn(),
        } as unknown as RedditService;
        const referenceMaterialService = {
            gatherReferenceMaterial: jest.fn(),
            saveReferenceMaterial: jest.fn(),
        } as unknown as ReferenceMaterialService;
        jest.spyOn(ArtifactStorageService, 'getCheckpoint').mockResolvedValue(checkpoint);
        jest.spyOn(ArtifactStorageService, 'saveRunArtifacts').mockResolvedValue({
            directory: checkpoint.runDirectory,
            files: {},
        });
        jest.spyOn(ArticleQualityService, 'improveIfNeeded').mockImplementation(async run => ({
            improved: false,
            finalMarkdown: run.editorialReview.finalMarkdown,
            finalScore: 88,
            qualityGate: {
                passed: true,
                score: 88,
                dimensionScores: {
                    hookStrength: 88,
                    thesisClarity: 88,
                    evidenceDensity: 88,
                    narrativeArc: 88,
                    mediumFormatCompliance: 88,
                    originality: 88,
                },
                blockers: [],
                suggestions: [],
            },
        }));

        const service = new ArticlePipelineService(redditService, referenceMaterialService);
        const briefSpy = jest.spyOn(service, 'generateBrief');
        const draftSpy = jest.spyOn(service, 'generateDraft');
        const editSpy = jest.spyOn(service, 'editDraft').mockResolvedValue(review);
        const run = await service.resumePipeline(checkpoint.id);

        expect(briefSpy).not.toHaveBeenCalled();
        expect(draftSpy).not.toHaveBeenCalled();
        expect(referenceMaterialService.gatherReferenceMaterial).not.toHaveBeenCalled();
        expect(editSpy).toHaveBeenCalledTimes(1);
        expect(run.id).toBe(checkpoint.id);
        expect(ArtifactStorageService.deleteCheckpoint).toHaveBeenCalledWith(checkpoint.runDirectory);
    });
});
