import { isSupportedRedditPostUrl, parseRedditPostUrl } from '../utils/redditPostUrl';

describe('parseRedditPostUrl', () => {
    it('parses canonical Reddit post URLs', () => {
        expect(parseRedditPostUrl('https://www.reddit.com/r/programming/comments/abc123/a_story/')).toEqual({
            postId: 'abc123',
            subreddit: 'programming',
        });
        expect(parseRedditPostUrl('https://old.reddit.com/r/AskReddit/comments/XYZ789/title')).toEqual({
            postId: 'xyz789',
            subreddit: 'AskReddit',
        });
    });

    it('parses redd.it short URLs', () => {
        expect(parseRedditPostUrl('https://redd.it/abc123')).toEqual({ postId: 'abc123' });
    });

    it('accepts Reddit share links for redirect resolution', () => {
        const shareUrl = 'https://www.reddit.com/r/programming/s/AbC123xyz';
        expect(parseRedditPostUrl(shareUrl)).toBeNull();
        expect(isSupportedRedditPostUrl(shareUrl)).toBe(true);
    });

    it('rejects non-post and non-Reddit URLs', () => {
        expect(parseRedditPostUrl('https://reddit.com/r/programming')).toBeNull();
        expect(parseRedditPostUrl('https://example.com/r/test/comments/abc123')).toBeNull();
        expect(parseRedditPostUrl('not a url')).toBeNull();
        expect(isSupportedRedditPostUrl('https://example.com/r/test/s/abc123')).toBe(false);
    });
});
