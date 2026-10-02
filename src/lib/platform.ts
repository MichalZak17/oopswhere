/**
 * Process-wide cache and background work. The app runs as one long-lived Node process
 * (Docker / Coolify), so an in-memory LRU is the shared cache and background refreshes
 * simply keep running after the response is sent.
 */
import { MemoryStore, type CacheStore } from "./cache/store";

export const store: CacheStore = new MemoryStore(5000);

export function waitUntil(p: Promise<unknown>): void {
    void p.catch(() => {});
}
