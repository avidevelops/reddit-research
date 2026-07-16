import { ArticleBrief, ArticleDraft, EditorialReview, PipelineRun, QualityGate } from '../types/pipeline';
import { isQualityGate } from '../utils/pipelineValidators';
import { LLMService } from './LLMService';
import { buildQualityImprovePrompt, buildQualityScorePrompt, PromptContext } from './pipelinePrompts';

export class ArticleQualityService {
    static async scoreArticle(
        draft: ArticleDraft,
        review: EditorialReview,
        brief: ArticleBrief,
        context: PromptContext = {
            targetAudience: 'curious Medium readers',
            articleStyle: 'insightful narrative essay',
            theme: 'General interest',
            writingMode: 'research-report',
        }
    ): Promise<QualityGate> {
        const prompt = buildQualityScorePrompt(draft, review, brief, context);
        return LLMService.generateJson(prompt, isQualityGate, 'article quality score');
    }

    static async improveIfNeeded(
        run: PipelineRun,
        threshold = 72
    ): Promise<{ improved: boolean; finalMarkdown: string; finalScore: number; qualityGate: QualityGate }> {
        const qualityGate = await this.scoreArticle(run.draft, run.editorialReview, run.articleBrief, run.request);

        if (qualityGate.score >= threshold) {
            return {
                improved: false,
                finalMarkdown: run.editorialReview.finalMarkdown,
                finalScore: qualityGate.score,
                qualityGate,
            };
        }

        const prompt = buildQualityImprovePrompt(run, qualityGate);
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
