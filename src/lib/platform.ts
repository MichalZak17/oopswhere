/**
 * The few things that differ between hosts: where the shared cache lives and how to
 * keep background work alive after the response is sent.
 *   Vercel  → Vercel Runtime Cache (+ a 60 s in-memory tier), waitUntil from @vercel/functions
 *   Node    → one in-memory LRU per process (Docker / Coolify)
 */
import { MemoryStore, TieredStore, type CacheEntry, type CacheStore } from "./cache/store";

export interface Platform {
    store: CacheStore;
    waitUntil: (p: Promise<unknown>) => void;
}

let platform: Promise<Platform> | undefined;

async function createPlatform(): Promise<Platform> {
    if (process.env.VERCEL) {
        const fns = await import("@vercel/functions");
        const runtime = fns.getCache({ namespace: "oopswhere" });
        const shared: CacheStore = {
            async get<T>(key: string) {
                return ((await runtime.get(key)) as CacheEntry<T> | null) ?? null;
            },
            async set<T>(key: string, entry: CacheEntry<T>, ttlSec: number) {
                await runtime.set(key, entry, { ttl: ttlSec, name: "" });
            },
        };
        return {
            store: new TieredStore(new MemoryStore(1000), shared),
            waitUntil: (p) => fns.waitUntil(p.catch(() => {})),
        };
    }
    return {
        store: new MemoryStore(5000),
        waitUntil: (p) => void p.catch(() => {}),
    };
}

export function getPlatform(): Promise<Platform> {
    platform ??= createPlatform();
    return platform;
}
