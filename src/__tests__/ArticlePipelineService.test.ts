import { ArticlePipelineService } from '../services/ArticlePipelineService';
import { ArtifactStorageService } from '../services/ArtifactStorageService';
import { LLMService } from '../services/LLMService';
import { ReferenceMaterialService } from '../services/ReferenceMaterialService';
import { RedditService } from '../services/RedditService';
import { TrendingTopicsService } from '../services/TrendingTopicsService';
import { ArticleBrief, ArticleDraft, EditorialReview } from '../types/pipeline';
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
        });

        expect(run.selectedOpportunity.topic).toBe('AI tooling');
        expect(run.editorialReview.finalMarkdown).toContain('Edited body');
        expect(run.artifacts.files.editedStory).toContain('edited-story.md');
    });
});
