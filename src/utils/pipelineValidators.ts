import {
    ArticleBrief,
    ArticleDraft,
    EditorialReview,
} from '../types/pipeline';
import { isRecord, isStringArray } from './llmJson';

export function isArticleBrief(value: unknown): value is ArticleBrief {
    if (!isRecord(value)) return false;
    return (
        typeof value.title === 'string' &&
        isStringArray(value.headlineOptions) &&
        isStringArray(value.hookOptions) &&
        typeof value.thesis === 'string' &&
        typeof value.targetAudience === 'string' &&
        typeof value.promise === 'string' &&
        Array.isArray(value.outline) &&
        value.outline.every(section =>
            isRecord(section) &&
            typeof section.heading === 'string' &&
            typeof section.purpose === 'string' &&
            isStringArray(section.evidence)
        ) &&
        isStringArray(value.counterarguments) &&
        isStringArray(value.practicalTakeaways) &&
        isStringArray(value.sourceNotes) &&
        isStringArray(value.risks)
    );
}

export function isArticleDraft(value: unknown): value is ArticleDraft {
    return (
        isRecord(value) &&
        typeof value.title === 'string' &&
        typeof value.markdown === 'string' &&
        isStringArray(value.sourceLinks) &&
        typeof value.estimatedReadTime === 'number'
    );
}

export function isEditorialReview(value: unknown): value is EditorialReview {
    return (
        isRecord(value) &&
        typeof value.score === 'number' &&
        isStringArray(value.strengths) &&
        isStringArray(value.improvements) &&
        isStringArray(value.factCheckNotes) &&
        typeof value.finalMarkdown === 'string'
    );
}
