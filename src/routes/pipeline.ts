import { Request, Response, Router } from 'express';
import { PipelineController } from '../controllers/PipelineController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const pipelineController = new PipelineController();

const withLongTimeout = (req: Request, res: Response, next: () => void): void => {
    req.setTimeout(900000, () => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout' });
        }
    });
    next();
};

router.post('/run', withLongTimeout, asyncHandler(async (req: Request, res: Response) => {
    await pipelineController.runPipeline(req, res);
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
