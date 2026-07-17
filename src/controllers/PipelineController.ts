import { Request, Response } from 'express';
import { config } from '../config/config';
import { ArticlePipelineService } from '../services/ArticlePipelineService';
import { ArtifactStorageService } from '../services/ArtifactStorageService';
import { ApiError } from '../middleware/errorMiddleware';
import { Logger } from '../utils/logger';
import { SSEEmitter } from '../utils/sseEmitter';

export class PipelineController {
    private pipelineService: ArticlePipelineService;

    constructor(pipelineService = new ArticlePipelineService()) {
        this.pipelineService = pipelineService;
    }

    async streamPipeline(req: Request, res: Response): Promise<void> {
        const sse = new SSEEmitter(res);
        req.setTimeout(600000, () => {
            sse.emit('error', { error: 'Request timeout' });
            sse.done();
        });

        try {
            await this.pipelineService.runPipeline(req.body, (event, data) => {
                sse.emit(event, data);
            });
            sse.done();
        } catch (error: any) {
            Logger.error('Pipeline stream failed', error);
            sse.emit('error', { error: error?.message || 'Pipeline failed' });
            sse.done();
        }
    }

    async runPipelineSync(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.pipelineService.runPipeline(req.body);
            res.json(result);
        } catch (error) {
            Logger.error('Pipeline run failed', error);
            throw error;
        }
    }

    async resumePipeline(req: Request, res: Response): Promise<void> {
        const sse = new SSEEmitter(res);
        req.setTimeout(600000, () => {
            sse.emit('error', { error: 'Request timeout' });
            sse.done();
        });

        try {
            await this.pipelineService.resumePipeline(req.params.runId, (event, data) => {
                sse.emit(event, data);
            });
            sse.done();
        } catch (error: any) {
            Logger.error('Pipeline resume failed', error);
            sse.emit('error', { error: error?.message || 'Pipeline resume failed' });
            sse.done();
        }
    }

    async discoverOpportunities(req: Request, res: Response): Promise<void> {
        try {
            const opportunities = await this.pipelineService.discoverOpportunities(req.body);
            res.json({ opportunities });
        } catch (error) {
            Logger.error('Opportunity discovery failed', error);
            throw error;
        }
    }

    async listRuns(req: Request, res: Response): Promise<void> {
        const runs = await ArtifactStorageService.listRuns(req.query.outputDir?.toString());
        res.json({ runs });
    }

    async getRun(req: Request, res: Response): Promise<void> {
        const run = await ArtifactStorageService.getRun(req.params.runId, req.query.outputDir?.toString());
        if (!run) {
            throw new ApiError(404, 'Pipeline run not found');
        }
        res.json(run);
    }

    async exportRun(req: Request, res: Response): Promise<void> {
        const format = this.getExportFormat(req.query.format?.toString());
        const run = await ArtifactStorageService.getRun(req.params.runId, req.query.outputDir?.toString());
        if (!run) {
            throw new ApiError(404, 'Pipeline run not found');
        }

        const content = ArtifactStorageService.exportRun(run, format);
        const filename = ArtifactStorageService.getExportFilename(run, format);
        res.setHeader('Content-Type', ArtifactStorageService.getExportContentType(format));
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
    }

    async getReviewArtifact(req: Request, res: Response): Promise<void> {
        const artifact = req.params.artifact;
        if (artifact !== 'research-bundle' && artifact !== 'reference-material' && artifact !== 'reference-summary') {
            throw new ApiError(400, 'Unsupported review artifact');
        }

        const run = await ArtifactStorageService.getRun(req.params.runId, req.query.outputDir?.toString());
        if (!run) {
            throw new ApiError(404, 'Pipeline run not found');
        }

        const result = await ArtifactStorageService.readReviewArtifact(run, artifact);
        if (!result) {
            throw new ApiError(404, 'Review artifact not found for this run');
        }

        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
        res.send(result.content);
    }

    async deleteRun(req: Request, res: Response): Promise<void> {
        const deleted = await ArtifactStorageService.deleteRun(req.params.runId, req.query.outputDir?.toString());
        if (!deleted) {
            throw new ApiError(404, 'Pipeline run not found');
        }
        res.status(204).send();
    }

    async regenerateSection(req: Request, res: Response): Promise<void> {
        const run = await ArtifactStorageService.getRun(req.params.runId, req.query.outputDir?.toString());
        if (!run) {
            throw new ApiError(404, 'Pipeline run not found');
        }

        const { sectionIndex, instruction } = req.body;
        if (typeof sectionIndex !== 'number') {
            throw new ApiError(400, 'sectionIndex must be a number');
        }

        const result = await this.pipelineService.regenerateSection(run, sectionIndex, instruction);
        res.json(result);
    }

    async getProviders(req: Request, res: Response): Promise<void> {
        res.json({
            activeProvider: config.llmProvider,
            model: config.model,
            providers: ['gemini', 'lmstudio', 'claude'],
        });
    }

    async generateBrief(req: Request, res: Response): Promise<void> {
        try {
            const { researchBundle, targetAudience, articleStyle, theme, writingMode } = req.body;
            if (!researchBundle) {
                res.status(400).json({ error: 'researchBundle is required' });
                return;
            }
            const brief = await this.pipelineService.generateBrief(researchBundle, {
                targetAudience: targetAudience || 'curious Medium readers',
                articleStyle: articleStyle || 'insightful narrative essay',
                theme: theme || 'General interest',
                writingMode: writingMode || 'research-report',
            });
            res.json({ brief });
        } catch (error) {
            Logger.error('Brief generation failed', error);
            throw error;
        }
    }

    async generateDraft(req: Request, res: Response): Promise<void> {
        try {
            const { brief, researchBundle, targetAudience, articleStyle, theme, writingMode } = req.body;
            if (!brief || !researchBundle) {
                res.status(400).json({ error: 'brief and researchBundle are required' });
                return;
            }
            const draft = await this.pipelineService.generateDraft(brief, researchBundle, {
                targetAudience: targetAudience || 'curious Medium readers',
                articleStyle: articleStyle || 'insightful narrative essay',
                theme: theme || 'General interest',
                writingMode: writingMode || 'research-report',
            });
            res.json({ draft });
        } catch (error) {
            Logger.error('Draft generation failed', error);
            throw error;
        }
    }

    async editDraft(req: Request, res: Response): Promise<void> {
        try {
            const { draft, brief, researchBundle, targetAudience, articleStyle, theme, writingMode } = req.body;
            if (!draft || !brief || !researchBundle) {
                res.status(400).json({ error: 'draft, brief, and researchBundle are required' });
                return;
            }
            const editorialReview = await this.pipelineService.editDraft(draft, brief, researchBundle, {
                targetAudience: targetAudience || 'curious Medium readers',
                articleStyle: articleStyle || 'insightful narrative essay',
                theme: theme || 'General interest',
                writingMode: writingMode || 'research-report',
            });
            res.json({ editorialReview });
        } catch (error) {
            Logger.error('Draft editing failed', error);
            throw error;
        }
    }

    private getExportFormat(format?: string): 'markdown' | 'html' | 'plaintext' {
        if (!format) return 'markdown';
        if (format === 'html' || format === 'plaintext' || format === 'markdown') return format;
        throw new ApiError(400, 'format must be markdown, html, or plaintext');
    }
}
