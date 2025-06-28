import { Request, Response, Router } from 'express';
import { SearchController } from '../controllers/SearchController';
import { validateSearchRequest } from '../middleware/validationMiddleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Reddit post search and sentiment analysis
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Search Reddit posts with sentiment analysis
 *     description: |
 *       Search for Reddit posts in a specific subreddit and analyze their sentiment using Google Gemini.
 *       The query format should be "sentiment in r/subreddit" (e.g., "positive reviews about Tesla in r/cars")
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query in format "sentiment in r/subreddit"
 *         example: "positive reviews about Tesla in r/cars"
 *     responses:
 *       200:
 *         description: Successfully retrieved and analyzed posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RedditPost'
 *       400:
 *         description: Invalid request format or parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid query format. Expected format: 'sentiment in r/subreddit'"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */

const router = Router();
const searchController = new SearchController();

router.get('/search', 
    validateSearchRequest,
    asyncHandler(async (req: Request, res: Response) => {
        await searchController.searchWithSentiment(req, res);
    })
);

export default router;
