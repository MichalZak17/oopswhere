export interface CacheEntry<T> {
    value: T;
    /** Unix ms when the value was fetched from upstream. */
    storedAt: number;
}

export interface CacheStore {
    get<T>(key: string): Promise<CacheEntry<T> | null>;
    set<T>(key: string, entry: CacheEntry<T>, ttlSec: number): Promise<void>;
}

/** Small LRU with per-entry expiry. Map iteration order doubles as recency order. */
export class MemoryStore implements CacheStore {
    private readonly map = new Map<string, { entry: CacheEntry<unknown>; expiresAt: number }>();

    constructor(
        private readonly maxEntries = 5000,
        private readonly now: () => number = Date.now,
    ) {}

    async get<T>(key: string): Promise<CacheEntry<T> | null> {
        const hit = this.map.get(key);
        if (!hit) return null;
        if (hit.expiresAt <= this.now()) {
            this.map.delete(key);
            return null;
        }
        this.map.delete(key);
        this.map.set(key, hit);
        return hit.entry as CacheEntry<T>;
    }

    async set<T>(key: string, entry: CacheEntry<T>, ttlSec: number): Promise<void> {
        this.map.delete(key);
        this.map.set(key, { entry, expiresAt: this.now() + ttlSec * 1000 });
        while (this.map.size > this.maxEntries) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined) break;
            this.map.delete(oldest);
        }
    }

    get size(): number {
        return this.map.size;
    }
}

/** A fast local tier in front of a shared one (e.g. Vercel Runtime Cache). */
export class TieredStore implements CacheStore {
    constructor(
        private readonly local: CacheStore,
        private readonly shared: CacheStore,
        private readonly localTtlSec = 60,
    ) {}

    async get<T>(key: string): Promise<CacheEntry<T> | null> {
        const local = await this.local.get<T>(key);
        if (local) return local;
        const shared = await this.shared.get<T>(key).catch(() => null);
        if (shared) await this.local.set(key, shared, this.localTtlSec);
        return shared;
    }

    async set<T>(key: string, entry: CacheEntry<T>, ttlSec: number): Promise<void> {
        await this.local.set(key, entry, Math.min(ttlSec, this.localTtlSec));
        await this.shared.set(key, entry, ttlSec).catch(() => {});
    }
}
