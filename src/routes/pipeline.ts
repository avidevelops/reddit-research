import { Request, Response, Router } from 'express';
import { PipelineController } from '../controllers/PipelineController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const pipelineController = new PipelineController();

const withLongTimeout = (req: Request, res: Response, next: () => void): void => {
    req.setTimeout(600000, () => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout' });
        }
    });
    next();
};

router.post('/run', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.streamPipeline(req, res);
}));

router.post('/run/sync', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.runPipelineSync(req, res);
}));

router.get('/providers', asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.getProviders(req, res);
}));

router.get('/runs', asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.listRuns(req, res);
}));

router.get('/runs/:runId', asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.getRun(req, res);
}));

router.get('/runs/:runId/export', asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.exportRun(req, res);
}));

router.delete('/runs/:runId', asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.deleteRun(req, res);
}));

router.post('/runs/:runId/regenerate-section', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.regenerateSection(req, res);
}));

router.post('/brief', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.generateBrief(req, res);
}));

router.post('/draft', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.generateDraft(req, res);
}));

router.post('/edit', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.editDraft(req, res);
}));

export default router;
