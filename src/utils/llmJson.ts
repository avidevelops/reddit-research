import { ApiError } from '../middleware/errorMiddleware';

export type Validator<T> = (value: unknown) => value is T;

export function extractJson(text: string): unknown {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;

    const slice = getJsonSlice(candidate);
    if (!slice) {
        throw new ApiError(500, 'LLM response did not contain JSON');
    }

    return parseJsonWithRepair(slice);
}

export function parseJsonWithRepair(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (strictError) {
        const repaired = repairCommonJsonIssues(text);
        try {
            return JSON.parse(repaired);
        } catch {
            throw strictError;
        }
    }
}

function getJsonSlice(candidate: string): string {
    try {
        JSON.parse(candidate);
        return candidate;
    } catch {
        const firstBrace = candidate.indexOf('{');
        const lastBrace = candidate.lastIndexOf('}');
        const firstBracket = candidate.indexOf('[');
        const lastBracket = candidate.lastIndexOf(']');

        const objectSlice = firstBrace >= 0 && lastBrace > firstBrace
            ? candidate.slice(firstBrace, lastBrace + 1)
            : '';
        const arraySlice = firstBracket >= 0 && lastBracket > firstBracket
            ? candidate.slice(firstBracket, lastBracket + 1)
            : '';

        return objectSlice || arraySlice;
    }
}

function repairCommonJsonIssues(text: string): string {
    return escapeUnescapedQuotesInsideStrings(stripTrailingCommas(text));
}

function stripTrailingCommas(text: string): string {
    return text.replace(/,\s*([}\]])/g, '$1');
}

function escapeUnescapedQuotesInsideStrings(text: string): string {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];

        if (char === '"' && !escaped) {
            if (!inString) {
                inString = true;
                result += char;
                continue;
            }

            if (isLikelyClosingQuote(text, index)) {
                inString = false;
                result += char;
                continue;
            }

            result += '\\"';
            continue;
        }

        result += char;
        escaped = char === '\\' && !escaped;
        if (char !== '\\') {
            escaped = false;
        }
    }

    return result;
}

function isLikelyClosingQuote(text: string, quoteIndex: number): boolean {
    let nextIndex = quoteIndex + 1;
    while (nextIndex < text.length && /\s/.test(text[nextIndex])) {
        nextIndex++;
    }

    const next = text[nextIndex];
    return next === undefined || next === ',' || next === '}' || next === ']' || next === ':';
}

export function parseValidatedJson<T>(
    text: string,
    validate: Validator<T>,
    label: string
): T {
    const parsed = extractJson(text);
    if (!validate(parsed)) {
        throw new ApiError(500, `Invalid ${label} response shape`);
    }
    return parsed;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}
