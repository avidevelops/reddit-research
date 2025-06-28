import { Request, Response } from 'express';
import { RedditService } from '../services/RedditService';
import { Logger } from '../utils/logger';

export class ScrapingController {
    private redditService: RedditService;

    constructor() {
        this.redditService = new RedditService();
    }

    async scrapeSubreddit(req: Request, res: Response) {
        try {
            const { subreddit, postId } = req.params;
            const limit = Number(req.query.limit) || 10;

            if (!subreddit) {
                return res.status(400).json({ error: 'Subreddit parameter is required' });
            }

            // Get posts (single or multiple)
            const posts = await this.redditService.getSubredditPosts(subreddit, limit, postId);

            // For each post, fetch its comments
            const postsWithComments = await Promise.all(
                posts.map(async (post) => {
                    const comments = await this.redditService.getPostComments(post.id, subreddit);
                    return {
                        ...post,
                        comments
                    };
                })
            );

            Logger.info(`Scraped ${postsWithComments.length} post(s) with comments from r/${subreddit}`);

            this.saveToText(postsWithComments[0], `./${subreddit}-${postId || 'all'}.txt`);

            // If a single postId was requested, return just the post object
            if (postId && postsWithComments.length === 1) {
                return res.json(postsWithComments[0]);
            }

            res.json({
                subreddit,
                count: postsWithComments.length,
                posts: postsWithComments
            });
        } catch (error) {
            Logger.error('Error in subreddit scraping:', error);
            res.status(500).json({ error: 'Failed to scrape subreddit' });
        }
    }

    saveToText(post: any, filename: string): void {
      const fs = require('fs');
      
      let content = '';
      
      // Post info
      content += `POST: ${post.title}\n`;
      content += `Author: ${post.author}\n`;
      content += `Date: ${new Date(post.created_utc * 1000).toISOString()}\n`;
      content += `Score: ${post.score}\n`;
      content += `URL: https://reddit.com${post.permalink}\n`;
      
      if (post.selftext) {
        content += `\nContent:\n${post.selftext}\n`;
      }
      
      content += `\nCOMMENTS (${post.comments.length}):\n`;
      content += '-'.repeat(50) + '\n';
      
      // Process comments recursively
      function processComment(comment: any, depth: number = 0): void {
        const indent = '  '.repeat(depth);
        
        content += `${indent}${comment.author}: ${comment.body}\n`;
        content += `${indent}Date: ${new Date(comment.created_utc * 1000).toISOString()}\n`;
        content += `${indent}${'-'.repeat(40)}\n`;
        
        if (comment.replies && Array.isArray(comment.replies)) {
          comment.replies.forEach((reply: any) => {
            processComment(reply, depth + 1);
          });
        }
      }
      
      // Process all comments
      post.comments.forEach((comment: any) => {
        processComment(comment, 0);
      });
      
      // Write to file
      fs.writeFileSync(filename, content, 'utf8');
      console.log(`Data saved to ${filename}`);
    }
}
