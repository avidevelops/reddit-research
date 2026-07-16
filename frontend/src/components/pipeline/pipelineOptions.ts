import type { WritingMode } from '../../types/api';

export interface ThemePreset {
    label: string;
    subreddits: string;
    targetAudience: string;
    articleStyle: string;
}

export const themePresets: ThemePreset[] = [
    {
        label: 'General interest',
        subreddits: 'AskReddit,todayilearned,changemyview,NoStupidQuestions',
        targetAudience: 'curious Medium readers interested in thoughtful, practical insight',
        articleStyle: 'insightful narrative essay with practical takeaways',
    },
    {
        label: 'Technology',
        subreddits: 'technology,Futurology,programming,artificial',
        targetAudience: 'curious readers interested in technology, work, and practical insight',
        articleStyle: 'clear technology essay with source-backed insight and practical takeaways',
    },
    {
        label: 'Philosophy / Spirituality',
        subreddits: 'philosophy,Stoicism,spirituality,Meditation',
        targetAudience: 'reflective readers interested in meaning, self-knowledge, and modern life',
        articleStyle: 'contemplative essay with grounded examples, counterpoints, and practical reflection',
    },
    {
        label: 'Work / Career',
        subreddits: 'careerguidance,careers,jobs,productivity',
        targetAudience: 'professionals navigating work, career decisions, and sustainable ambition',
        articleStyle: 'practical career essay with human stories, tradeoffs, and actionable takeaways',
    },
    {
        label: 'Self Improvement',
        subreddits: 'selfimprovement,getdisciplined,DecidingToBeBetter,productivity',
        targetAudience: 'readers trying to build better habits, discipline, and emotional resilience',
        articleStyle: 'empathetic self-improvement essay with realistic advice and lived tension',
    },
    {
        label: 'Society / Culture',
        subreddits: 'changemyview,TrueReddit,AskSocialScience,socialscience',
        targetAudience: 'readers interested in culture, social change, and how people make sense of modern life',
        articleStyle: 'balanced cultural essay with strong thesis, counterpoints, and human stakes',
    },
    {
        label: 'Finance',
        subreddits: 'personalfinance,financialindependence,investing,povertyfinance',
        targetAudience: 'readers looking for grounded money lessons, financial tradeoffs, and practical judgment',
        articleStyle: 'practical finance essay with clear caveats, source-backed claims, and useful takeaways',
    },
];

export const themeOptions = [...themePresets.map(preset => preset.label), 'Custom'];

export const getThemePreset = (theme: string): ThemePreset | undefined =>
    themePresets.find(preset => preset.label === theme);

export const writingModeOptions: Array<{ value: WritingMode; label: string }> = [
    { value: 'research-report', label: 'Research report' },
    { value: 'publish-ready', label: 'Publish-ready essay' },
];
