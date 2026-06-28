import { ArticleBrief, ArticleDraft, EditorialReview, PipelineRun, QualityGate } from '../types/pipeline';
import { isQualityGate } from '../utils/pipelineValidators';
import { LLMService } from './LLMService';

export class ArticleQualityService {
    static async scoreArticle(
        draft: ArticleDraft,
        review: EditorialReview,
        brief: ArticleBrief
    ): Promise<QualityGate> {
        const prompt = `
Evaluate this Medium-style article for boost-worthy quality.

Score each dimension from 0-100:
- hookStrength: does sentence 1 create immediate curiosity?
- thesisClarity: is the core argument clear in the first 200 words?
- evidenceDensity: are claims backed by real Reddit data, not generic advice?
- narrativeArc: does it build to a satisfying conclusion?
- mediumFormatCompliance: heading hierarchy, blockquotes for quotes, no Wikipedia-style writing
- originality: would this feel distinct from 10 other Medium articles on this topic?

Return strict JSON:
{
  "passed": boolean,
  "score": 0-100,
  "dimensionScores": {
    "hookStrength": 0-100,
    "thesisClarity": 0-100,
    "evidenceDensity": 0-100,
    "narrativeArc": 0-100,
    "mediumFormatCompliance": 0-100,
    "originality": 0-100
  },
  "blockers": ["reason this would prevent Medium success"],
  "suggestions": ["specific improvement"]
}

Brief:
${JSON.stringify(brief, null, 2)}

Draft:
${draft.markdown}

Edited article:
${review.finalMarkdown}`;

        return LLMService.generateJson(prompt, isQualityGate, 'article quality score');
    }

    static async improveIfNeeded(
        run: PipelineRun,
        threshold = 72
    ): Promise<{ improved: boolean; finalMarkdown: string; finalScore: number; qualityGate: QualityGate }> {
        const qualityGate = await this.scoreArticle(run.draft, run.editorialReview, run.articleBrief);

        if (qualityGate.score >= threshold) {
            return {
                improved: false,
                finalMarkdown: run.editorialReview.finalMarkdown,
                finalScore: qualityGate.score,
                qualityGate,
            };
        }

        const prompt = `
Improve this Medium article so it clears the quality blockers below.

Rules:
- Return strict JSON matching the EditorialReview shape.
- Preserve real source links and do not invent claims, quotes, or statistics.
- Focus specifically on the blockers and suggestions.

Quality blockers:
${JSON.stringify(qualityGate.blockers, null, 2)}

Suggestions:
${JSON.stringify(qualityGate.suggestions, null, 2)}

Brief:
${JSON.stringify(run.articleBrief, null, 2)}

Current article:
${run.editorialReview.finalMarkdown}

Return strict JSON:
{
  "score": 0-100,
  "strengths": ["strength"],
  "improvements": ["improvement made"],
  "factCheckNotes": ["source or claim note"],
  "finalMarkdown": "# Improved article..."
}`;

        const improvedReview = await LLMService.generateJson<EditorialReview>(
            prompt,
            (value): value is EditorialReview => (
                typeof value === 'object' &&
                value !== null &&
                typeof (value as EditorialReview).score === 'number' &&
                Array.isArray((value as EditorialReview).strengths) &&
                Array.isArray((value as EditorialReview).improvements) &&
                Array.isArray((value as EditorialReview).factCheckNotes) &&
                typeof (value as EditorialReview).finalMarkdown === 'string'
            ),
            'article targeted improvement'
        );

        const improvedQualityGate: QualityGate = {
            ...qualityGate,
            passed: improvedReview.score >= threshold,
            score: Math.max(qualityGate.score, improvedReview.score),
        };

        run.editorialReview = {
            ...improvedReview,
            qualityGate: improvedQualityGate,
        };

        return {
            improved: true,
            finalMarkdown: improvedReview.finalMarkdown,
            finalScore: improvedQualityGate.score,
            qualityGate: improvedQualityGate,
        };
    }
}
