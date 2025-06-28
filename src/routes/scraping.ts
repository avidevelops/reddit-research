import { Request, Response, Router } from 'express';
import { ScrapingController } from '../controllers/ScrapingController';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * @swagger
 * tags:
 *   name: Scraping
 *   description: Subreddit scraping operations
 */

/**
 * @swagger
 * /api/scrape/{subreddit}:
 *   get:
 *     summary: Scrape posts and comments from a subreddit
 *     description: Retrieves recent posts and their comments from a specified subreddit
 *     tags: [Scraping]
 *     parameters:
 *       - in: path
 *         name: subreddit
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the subreddit to scrape
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         required: false
 *         description: Maximum number of posts to retrieve (default 10)
 *     responses:
 *       200:
 *         description: Successfully retrieved posts and comments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subreddit:
 *                   type: string
 *                 count:
 *                   type: integer
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RedditPostWithComments'
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/scrape/{subreddit}/{postId}:
 *   get:
 *     summary: Scrape a single post and its comments by postId
 *     description: Retrieves a single post and all its comments from a subreddit
 *     tags: [Scraping]
 *     parameters:
 *       - in: path
 *         name: subreddit
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the subreddit
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *         required: true
 *         description: Reddit post ID
 *     responses:
 *       200:
 *         description: Successfully retrieved the post and comments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RedditPostWithComments'
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */

const router = Router();
const scrapingController = new ScrapingController();

router.get('/:subreddit/:postId',
    asyncHandler(async (req: Request, res: Response) => {
        await scrapingController.scrapeSubreddit(req, res);
    })
);

router.get('/:subreddit',
    asyncHandler(async (req: Request, res: Response) => {
        await scrapingController.scrapeSubreddit(req, res);
    })
);

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     RedditPostWithComments:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         author:
 *           type: string
 *         selftext:
 *           type: string
 *         created_utc:
 *           type: number
 *         comments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RedditCommentThread'
 *     RedditCommentThread:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         body:
 *           type: string
 *         author:
 *           type: string
 *         created_utc:
 *           type: number
 *         replies:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RedditCommentThread'
 */
