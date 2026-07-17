import { InMemoryCache } from '../services/InMemoryCache';

describe('InMemoryCache', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns cached values until their TTL expires', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const cache = new InMemoryCache<string>(1_000);

        cache.set('analysis', 'result');
        expect(cache.get('analysis')).toBe('result');

        jest.advanceTimersByTime(1_001);
        expect(cache.get('analysis')).toBeUndefined();
    });

    it('evicts the least recently used entry at capacity', () => {
        const cache = new InMemoryCache<number>(60_000, 2);
        cache.set('first', 1);
        cache.set('second', 2);
        expect(cache.get('first')).toBe(1);

        cache.set('third', 3);
        expect(cache.get('second')).toBeUndefined();
        expect(cache.values()).toEqual([1, 3]);
    });
});
