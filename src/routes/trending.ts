import {NextFunction, Request, Response, Router} from 'express';
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

/**
 * @swagger
 * /api/trending/{subreddit}/references:
 *   post:
 *     summary: Gather reference material for a specific topic
 *     description: Fetches full posts and comments to extract quotes, insights, and reference material for writing Medium articles
 *     tags: [Trending]
 *     parameters:
 *       - in: path
 *         name: subreddit
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the subreddit
 *         example: technology
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *               - postIds
 *             properties:
 *               topic:
 *                 type: string
 *                 description: The topic to gather references for
 *                 example: "AI Ethics in Healthcare"
 *               postIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of Reddit post IDs to analyze
 *                 example: ["1a2b3c", "4d5e6f", "7g8h9i"]
 *     responses:
 *       200:
 *         description: Successfully gathered reference material
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 topic:
 *                   type: string
 *                   example: "AI Ethics in Healthcare"
 *                 subreddit:
 *                   type: string
 *                   example: "technology"
 *                 postsAnalyzed:
 *                   type: integer
 *                   description: Number of posts analyzed
 *                   example: 5
 *                 totalComments:
 *                   type: integer
 *                   description: Total number of comments analyzed
 *                   example: 127
 *                 filepath:
 *                   type: string
 *                   description: Path where reference material was saved
 *                   example: "/reference-materials/technology-1234567890-reference.json"
 *                 summary:
 *                   type: object
 *                   properties:
 *                     keyInsights:
 *                       type: integer
 *                       example: 12
 *                     quotableComments:
 *                       type: integer
 *                       example: 8
 *                     painPoints:
 *                       type: integer
 *                       example: 5
 *                     successStories:
 *                       type: integer
 *                       example: 3
 *                 referenceMaterial:
 *                   type: object
 *                   properties:
 *                     topicId:
 *                       type: string
 *                       example: "technology-1234567890"
 *                     topic:
 *                       type: string
 *                     sourcePosts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     keyInsights:
 *                       type: array
 *                       items:
 *                         type: string
 *                     quotableComments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           text:
 *                             type: string
 *                           author:
 *                             type: string
 *                           context:
 *                             type: string
 *                           relevance:
 *                             type: string
 *                     commonPainPoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                     successStories:
 *                       type: array
 *                       items:
 *                         type: string
 *                     controversialPoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                     expertOpinions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     statistics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           metric:
 *                             type: string
 *                           value:
 *                             type: string
 *                           context:
 *                             type: string
 *                     narrativeElements:
 *                       type: object
 *                       properties:
 *                         hooks:
 *                           type: array
 *                           items:
 *                             type: string
 *                         personalStories:
 *                           type: array
 *                           items:
 *                             type: string
 *                         transformations:
 *                           type: array
 *                           items:
 *                             type: string
 *       400:
 *         description: Missing required parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Missing required parameters. Need subreddit, topic, and postIds array."
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to gather reference material"
 */

const router = Router();
const trendingController = new TrendingController();

// Multi-subreddit trending analysis must be registered before /:subreddit.
router.get('/multi',
    asyncHandler(async (req: Request, res: Response) => {
        await trendingController.getMultiSubredditTrends(req, res);
    })
);

// Single subreddit trending analysis
router.get('/:subreddit',
    (req: Request, res: Response, next: NextFunction) => {
        req.setTimeout(900000, () => {
            if (!res.headersSent) {
                return res.status(504).json({ error: 'Request timeout'});
            }
        });
        next();
    },
    asyncHandler(async (req: Request, res: Response) => {
        console.log('Trending request:', req.params.subreddit, req.query);
        await trendingController.getTrendingTopics(req, res);
    })
);

// Gather reference material for a topic
router.post('/:subreddit/references',
    (req: Request, res: Response, next: NextFunction) => {
        req.setTimeout(900000, () => {
            if (!res.headersSent) {
                return res.status(504).json({ error: 'Request timeout'});
            }
        });
        next();
    },
    asyncHandler(async (req: Request, res: Response) => {
        await trendingController.gatherReferences(req, res);
    })
);

export default router;
