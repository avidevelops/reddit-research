import { Request, Response, Router } from 'express';
import { TrendingController } from '../controllers/TrendingController';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * @swagger
 * tags:
 *   name: Trending
 *   description: Trending topics analysis for Medium content creation
 */

/**
 * @swagger
 * /api/trending/{subreddit}:
 *   get:
 *     summary: Get trending topics from a subreddit worth writing about on Medium
 *     description: Analyzes recent posts to identify trending topics with high Medium success potential
 *     tags: [Trending]
 *     parameters:
 *       - in: path
 *         name: subreddit
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the subreddit to analyze
 *         example: technology
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 10
 *           maximum: 100
 *         required: false
 *         description: Number of posts to analyze (default 50)
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         required: false
 *         description: Time period to analyze (default week)
 *       - in: query
 *         name: gatherReferences
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Whether to gather reference material for top topics (default false)
 *       - in: query
 *         name: topicsToGather
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *         required: false
 *         description: Number of top topics to gather references for (default 3)
 *     responses:
 *       200:
 *         description: Successfully analyzed trending topics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subreddit:
 *                   type: string
 *                 timeframe:
 *                   type: string
 *                 postsAnalyzed:
 *                   type: integer
 *                 trendingTopics:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       topic:
 *                         type: string
 *                       category:
 *                         type: string
 *                       mediumSuccessProbability:
 *                         type: number
 *                       storyAngles:
 *                         type: array
 *                         items:
 *                           type: string
 *                 bestStoryOpportunity:
 *                   type: object
 *                 references:
 *                   type: array
 *                   description: Only included when gatherReferences is true
 */

/**
 * @swagger
 * /api/trending/multi:
 *   get:
 *     summary: Analyze trends across multiple subreddits
 *     description: Compare trending topics across multiple subreddits to find the best Medium content opportunities
 *     tags: [Trending]
 *     parameters:
 *       - in: query
 *         name: subreddits
 *         schema:
 *           type: string
 *         required: true
 *         description: Comma-separated list of subreddits
 *         example: technology,programming,artificial
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         description: Posts per subreddit to analyze (default 25)
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         required: false
 *         description: Time period to analyze (default week)
 *       - in: query
 *         name: gatherReferences
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Whether to gather reference material for top topics (default false)
 *       - in: query
 *         name: topicsToGather
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         required: false
 *         description: Number of top topics to gather references for (default 2)
 *     responses:
 *       200:
 *         description: Successfully analyzed trends across subreddits
 */

const router = Router();
const trendingController = new TrendingController();

// Single subreddit trending analysis
router.get('/:subreddit',
    asyncHandler(async (req: Request, res: Response) => {
        console.log('Trending request:', req.params.subreddit, req.query);
        await trendingController.getTrendingTopics(req, res);
    })
);

// Multi-subreddit trending analysis
router.get('/multi',
    asyncHandler(async (req: Request, res: Response) => {
        await trendingController.getMultiSubredditTrends(req, res);
    })
);

// Gather reference material for a topic
router.post('/:subreddit/references',
    asyncHandler(async (req: Request, res: Response) => {
        await trendingController.gatherReferences(req, res);
    })
);

export default router;