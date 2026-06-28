import {
    ArticleBrief,
    ArticleDraft,
    EditorialReview,
    QualityGate,
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

export function isQualityGate(value: unknown): value is QualityGate {
    if (!isRecord(value) || !isRecord(value.dimensionScores)) return false;
    const dimensions = value.dimensionScores;
    return (
        typeof value.passed === 'boolean' &&
        typeof value.score === 'number' &&
        typeof dimensions.hookStrength === 'number' &&
        typeof dimensions.thesisClarity === 'number' &&
        typeof dimensions.evidenceDensity === 'number' &&
        typeof dimensions.narrativeArc === 'number' &&
        typeof dimensions.mediumFormatCompliance === 'number' &&
        typeof dimensions.originality === 'number' &&
        isStringArray(value.blockers) &&
        isStringArray(value.suggestions)
    );
}
