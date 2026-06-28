import { extractJson, parseValidatedJson } from '../utils/llmJson';
import { isArticleDraft } from '../utils/pipelineValidators';

describe('llmJson utilities', () => {
    it('extracts JSON from fenced responses', () => {
        const parsed = extractJson('```json\n{"title":"Test","items":[1]}\n```');
        expect(parsed).toEqual({ title: 'Test', items: [1] });
    });

    it('extracts JSON from surrounding prose', () => {
        const parsed = extractJson('Here is the result: {"ok":true} Thanks.');
        expect(parsed).toEqual({ ok: true });
    });

    it('validates parsed response shape', () => {
        const parsed = parseValidatedJson(
            '{"title":"Draft","markdown":"# Draft","sourceLinks":[],"estimatedReadTime":5}',
            isArticleDraft,
            'draft'
        );
        expect(parsed.title).toBe('Draft');
    });

    it('repairs unescaped quotes inside LLM string values', () => {
        const parsed = extractJson(`
        {
          "trendingTopics": [
            {
              "topic": "Why developers say "AI coding" feels different",
              "hooks": ["The phrase "AI pair programmer" hides the real story"]
            }
          ],
          "overallTheme": "Developers are debating "AI work"",
          "bestStoryOpportunity": {
            "title": "The "AI coding" hangover",
            "angle": "Workflow over hype",
            "whyItWillWork": "It captures a live debate"
          }
        }
        `) as any;

        expect(parsed.trendingTopics[0].topic).toBe('Why developers say "AI coding" feels different');
        expect(parsed.bestStoryOpportunity.title).toBe('The "AI coding" hangover');
    });

    it('repairs fenced JSON with trailing commas', () => {
        const parsed = extractJson('```json\n{"title":"Draft","items":["one",],}\n```') as any;
        expect(parsed.items).toEqual(['one']);
    });
});
