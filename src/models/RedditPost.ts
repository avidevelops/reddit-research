import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Sentiment:
 *       type: object
 *       properties:
 *         label:
 *           type: string
 *           enum: [positive, negative, neutral]
 *           description: The overall sentiment of the post
 *         score:
 *           type: number
 *           description: Sentiment score between -1 and 1
 *         analysis:
 *           type: string
 *           description: Detailed sentiment analysis
 *         emotions:
 *           type: array
 *           items:
 *             type: string
 *           description: List of detected emotions
 *     RedditPost:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Reddit post ID
 *         title:
 *           type: string
 *           description: Post title
 *         author:
 *           type: string
 *           description: Post author username
 *         subreddit:
 *           type: string
 *           description: Subreddit name
 *         permalink:
 *           type: string
 *           description: Reddit post permalink
 *         sentiment:
 *           $ref: '#/components/schemas/Sentiment'
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: TTL expiration date
 */

const RedditPostSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    subreddit: { type: String, required: true },
    title: { type: String, required: true },
    selftext: { type: String },
    created_utc: { type: Number, required: true },
    author: { type: String, required: true },
    score: { type: Number, required: true },
    num_comments: { type: Number, required: true },
    sentiment: {
        type: {
            label: String,
            score: Number,
            emotions: [String],
            analysis: String
        },
        required: false
    },
    permalink: { type: String, required: true },
    processed: { type: Boolean, default: false },
    // Add expiration date field
    expiresAt: { 
        type: Date, 
        default: () => new Date(+new Date() + 30*24*60*60*1000), // 30 days from now
        index: { expires: 0 } // MongoDB will automatically remove documents when they expire
    }
}, {
    timestamps: true
});

export const RedditPost = mongoose.model('RedditPost', RedditPostSchema);
