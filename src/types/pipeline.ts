import { CleanRedditPost } from '../utils/redditDataCleaner';

export type PipelineTimeframe = 'day' | 'week' | 'month';

export interface PipelineRequest {
    subreddits: string[];
    timeframe?: PipelineTimeframe;
    limit?: number;
    topicsToGather?: number;
    targetAudience?: string;
    articleStyle?: string;
    outputDir?: string;
}

export interface TopicOpportunity {
    id: string;
    topic: string;
    category: string;
    sourceSubreddit: string;
    engagementScore: number;
    viralPotential: number;
    mediumSuccessProbability: number;
    score: number;
    keyThemes: string[];
    storyAngles: string[];
    targetAudience: string;
    estimatedReadTime: number;
    hooks: string[];
    relevantPosts: CleanRedditPost[];
    whyItWorks: string;
}

export interface ResearchQuote {
    text: string;
    author: string;
    context: string;
    relevance: string;
}

export interface ResearchBundle {
    topic: string;
    sourceSubreddit: string;
    opportunity: TopicOpportunity;
    keyInsights: string[];
    quotes: ResearchQuote[];
    painPoints: string[];
    successStories: string[];
    controversialPoints: string[];
    expertOpinions: string[];
    statistics: Array<{
        metric: string;
        value: string;
        context: string;
    }>;
    sourcePosts: Array<{
        id: string;
        title: string;
        author: string;
        score: number;
        num_comments: number;
        permalink: string;
    }>;
}

export interface ArticleBrief {
    title: string;
    headlineOptions: string[];
    hookOptions: string[];
    thesis: string;
    targetAudience: string;
    promise: string;
    outline: Array<{
        heading: string;
        purpose: string;
        evidence: string[];
    }>;
    counterarguments: string[];
    practicalTakeaways: string[];
    sourceNotes: string[];
    risks: string[];
}

export interface ArticleDraft {
    title: string;
    markdown: string;
    sourceLinks: string[];
    estimatedReadTime: number;
}

export interface EditorialReview {
    score: number;
    strengths: string[];
    improvements: string[];
    factCheckNotes: string[];
    finalMarkdown: string;
}

export interface PipelineArtifacts {
    directory: string;
    files: Record<string, string>;
}

export interface PipelineRun {
    id: string;
    createdAt: string;
    request: Required<Omit<PipelineRequest, 'outputDir'>> & { outputDir?: string };
    opportunities: TopicOpportunity[];
    selectedOpportunity: TopicOpportunity;
    researchBundle: ResearchBundle;
    articleBrief: ArticleBrief;
    draft: ArticleDraft;
    editorialReview: EditorialReview;
    artifacts: PipelineArtifacts;
}
