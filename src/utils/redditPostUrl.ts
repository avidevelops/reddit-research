export interface RedditPostLocator {
    postId: string;
    subreddit?: string;
}

export function parseRedditPostUrl(value: string): RedditPostLocator | null {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        const segments = url.pathname.split('/').filter(Boolean);

        if (hostname === 'redd.it') {
            const postId = segments[0]?.toLowerCase();
            return postId && /^[a-z0-9]+$/.test(postId) ? { postId } : null;
        }

        if (hostname !== 'reddit.com' && !hostname.endsWith('.reddit.com')) return null;

        const subredditIndex = segments.findIndex(segment => segment.toLowerCase() === 'r');
        const commentsIndex = segments.findIndex(segment => segment.toLowerCase() === 'comments');
        const postId = commentsIndex >= 0 ? segments[commentsIndex + 1]?.toLowerCase() : undefined;
        if (!postId || !/^[a-z0-9]+$/.test(postId)) return null;

        const subreddit = subredditIndex >= 0 && subredditIndex + 1 < commentsIndex
            ? segments[subredditIndex + 1]
            : undefined;
        return { postId, subreddit };
    } catch {
        return null;
    }
}

export function isSupportedRedditPostUrl(value: string): boolean {
    if (parseRedditPostUrl(value)) return true;
    try {
        const url = new URL(value.trim());
        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        if ((url.protocol !== 'https:' && url.protocol !== 'http:') ||
            (hostname !== 'reddit.com' && !hostname.endsWith('.reddit.com'))) {
            return false;
        }

        const segments = url.pathname.split('/').filter(Boolean);
        return segments.length >= 4 &&
            segments[0].toLowerCase() === 'r' &&
            segments[2].toLowerCase() === 's' &&
            /^[a-z0-9]+$/i.test(segments[3]);
    } catch {
        return false;
    }
}
