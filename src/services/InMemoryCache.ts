export class InMemoryCache<T> {
    private readonly entries = new Map<string, { value: T; expiresAt: number }>();

    constructor(
        private readonly ttlMs: number,
        private readonly maxEntries = 100
    ) {}

    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }

        // Refresh insertion order so frequently used entries survive eviction.
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    set(key: string, value: T): void {
        this.pruneExpired();
        this.entries.delete(key);
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });

        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value as string | undefined;
            if (!oldestKey) break;
            this.entries.delete(oldestKey);
        }
    }

    clear(): void {
        this.entries.clear();
    }

    values(): T[] {
        this.pruneExpired();
        return Array.from(this.entries.values(), entry => entry.value);
    }

    private pruneExpired(): void {
        const now = Date.now();
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) this.entries.delete(key);
        }
    }
}
