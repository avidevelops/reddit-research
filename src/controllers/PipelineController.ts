import { Request, Response } from 'express';
import { ArticlePipelineService } from '../services/ArticlePipelineService';
import { Logger } from '../utils/logger';

export class PipelineController {
    private pipelineService: ArticlePipelineService;

    constructor(pipelineService = new ArticlePipelineService()) {
        this.pipelineService = pipelineService;
    }

    async runPipeline(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.pipelineService.runPipeline(req.body);
            res.json(result);
        } catch (error) {
            Logger.error('Pipeline run failed', error);
            throw error;
        }
    }

    async generateBrief(req: Request, res: Response): Promise<void> {
        try {
            const { researchBundle, targetAudience, articleStyle } = req.body;
            if (!researchBundle) {
                res.status(400).json({ error: 'researchBundle is required' });
                return;
            }
            const brief = await this.pipelineService.generateBrief(researchBundle, {
                targetAudience: targetAudience || 'curious Medium readers',
                articleStyle: articleStyle || 'insightful narrative essay',
            });
            res.json({ brief });
        } catch (error) {
            Logger.error('Brief generation failed', error);
            throw error;
        }
    }

    async generateDraft(req: Request, res: Response): Promise<void> {
        try {
            const { brief, researchBundle, targetAudience, articleStyle } = req.body;
            if (!brief || !researchBundle) {
                res.status(400).json({ error: 'brief and researchBundle are required' });
                return;
            }
            const draft = await this.pipelineService.generateDraft(brief, researchBundle, {
                targetAudience: targetAudience || 'curious Medium readers',
                articleStyle: articleStyle || 'insightful narrative essay',
            });
            res.json({ draft });
        } catch (error) {
            Logger.error('Draft generation failed', error);
            throw error;
        }
    }

    async editDraft(req: Request, res: Response): Promise<void> {
        try {
            const { draft, brief, researchBundle, targetAudience, articleStyle } = req.body;
            if (!draft || !brief || !researchBundle) {
                res.status(400).json({ error: 'draft, brief, and researchBundle are required' });
                return;
            }
            const editorialReview = await this.pipelineService.editDraft(draft, brief, researchBundle, {
                targetAudience: targetAudience || 'curious Medium readers',
                articleStyle: articleStyle || 'insightful narrative essay',
            });
            res.json({ editorialReview });
        } catch (error) {
            Logger.error('Draft editing failed', error);
            throw error;
        }
    }
}
