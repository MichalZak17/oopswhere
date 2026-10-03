/**
 * Stale-while-revalidate over a CacheStore, with single-flight per key.
 *
 *   age < fresh        → cached value
 *   age < swr          → cached value, refreshed in the background
 *   age < maxStale     → refetch; if upstream fails, the cached value (stale: true)
 *   otherwise          → refetch or fail
 */
import type { CacheEntry, CacheStore } from "./store";

export interface SwrPolicy {
    freshSec: number;
    swrSec: number;
    maxStaleSec: number;
}

export interface SwrResult<T> {
    value: T;
    /** True when served from an old entry because the refresh failed. */
    stale: boolean;
    /** Unix ms when the value was fetched from upstream. */
    storedAt: number;
}

export interface SwrDeps {
    store: CacheStore;
    waitUntil: (p: Promise<unknown>) => void;
    now?: () => number;
    /** Errors that mean "this resource is gone" and must not fall back to stale data. */
    isPermanent?: (err: unknown) => boolean;
}

export function createSwr(deps: SwrDeps) {
    const now = deps.now ?? Date.now;
    const inflight = new Map<string, Promise<unknown>>();

    function refresh<T>(
        key: string,
        fetcher: () => Promise<T>,
        policy: SwrPolicy,
    ): Promise<CacheEntry<T>> {
        const running = inflight.get(key);
        if (running) return running as Promise<CacheEntry<T>>;
        const p = (async () => {
            const entry = { value: await fetcher(), storedAt: now() };
            await deps.store.set(key, entry, policy.maxStaleSec);
            return entry;
        })().finally(() => inflight.delete(key));
        inflight.set(key, p);
        return p;
    }

    return async function swr<T>(
        key: string,
        fetcher: () => Promise<T>,
        policy: SwrPolicy,
    ): Promise<SwrResult<T>> {
        const entry = await deps.store.get<T>(key).catch(() => null);
        const ageSec = entry ? (now() - entry.storedAt) / 1000 : Infinity;

        if (entry && ageSec < policy.freshSec) return { ...entry, stale: false };

        if (entry && ageSec < policy.swrSec) {
            deps.waitUntil(refresh(key, fetcher, policy).catch(() => {}));
            return { ...entry, stale: false };
        }

        try {
            return { ...(await refresh(key, fetcher, policy)), stale: false };
        } catch (err) {
            if (entry && !deps.isPermanent?.(err)) return { ...entry, stale: true };
            throw err;
        }
    };
}
