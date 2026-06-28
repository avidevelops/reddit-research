export interface RedditPost {
    id: string;
    subreddit?: string;
    title: string;
    selftext?: string;
    created_utc: number;
    author: string;
    score: number;
    num_comments: number;
    sentiment?: {
        label: 'positive' | 'negative' | 'neutral';
        score: number;
        emotions: string[];
        analysis: string;
    };
    permalink: string;
    processed?: boolean;
}

export interface TrendingTopic {
    topic: string;
    category: string;
    engagementScore: number;
    viralPotential: number;
    mediumSuccessProbability: number;
    keyThemes: string[];
    storyAngles: string[];
    targetAudience: string;
    estimatedReadTime: number;
    hooks: string[];
    source?: string;
    relevantPosts?: RedditPost[];
}

export interface ReferenceMaterial {
    topicId: string;
    topic: string;
    sourcePosts: unknown[];
    keyInsights: string[];
    quotableComments: Array<{
        text: string;
        author: string;
        context: string;
        relevance: string;
    }>;
    commonPainPoints: string[];
    successStories: string[];
    controversialPoints: string[];
    expertOpinions: string[];
    statistics: Array<{
        metric: string;
        value: string;
        context: string;
    }>;
    narrativeElements: {
        hooks: string[];
        personalStories: string[];
        transformations: string[];
    };
}

export interface TrendingReference {
    topic: string;
    source?: string;
    topicData: TrendingTopic;
    referenceSummary: {
        keyInsights: number;
        quotableComments: number;
        painPoints: number;
        successStories: number;
        postsAnalyzed: number;
    };
    referenceMaterial: ReferenceMaterial;
}

export interface TrendingAnalysis {
    subreddit?: string;
    timeframe: string;
    postsAnalyzed: number;
    posts?: RedditPost[];
    trendingTopics: TrendingTopic[];
    bestStoryOpportunity: {
        title: string;
        angle: string;
        whyItWillWork: string;
    };
    references?: TrendingReference[];
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
    relevantPosts: RedditPost[];
    whyItWorks: string;
}

export interface ResearchBundle {
    topic: string;
    sourceSubreddit: string;
    opportunity: TopicOpportunity;
    keyInsights: string[];
    quotes: Array<{
        text: string;
        author: string;
        context: string;
        relevance: string;
    }>;
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

export interface PipelineRequest {
    subreddits: string[];
    timeframe?: 'day' | 'week' | 'month';
    limit?: number;
    topicsToGather?: number;
    targetAudience?: string;
    articleStyle?: string;
    outputDir?: string;
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
