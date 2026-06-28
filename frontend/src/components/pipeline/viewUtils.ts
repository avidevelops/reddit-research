export const stageOrder = ['discovering', 'opportunities', 'researching', 'briefing', 'drafting', 'editing', 'quality', 'complete'];

export const stageLabel: Record<string, string> = {
    discovering: 'Discover',
    opportunities: 'Score',
    researching: 'Research',
    briefing: 'Brief',
    drafting: 'Draft',
    editing: 'Edit',
    quality: 'Quality',
    complete: 'Export',
    error: 'Error',
    idle: 'Idle',
};

export const scoreColor = (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'orange';
    return 'red';
};

export const formatDate = (value: string): string =>
    new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

export const qualityChartData = (dimensionScores?: object) => {
    if (!dimensionScores) return [];
    return Object.entries(dimensionScores).map(([dimension, score]) => ({
        dimension: dimension
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, char => char.toUpperCase()),
        score,
    }));
};
