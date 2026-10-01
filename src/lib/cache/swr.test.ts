import { describe, expect, it, vi } from "vitest";
import { Limiter, CircuitOpenError } from "./limit";
import { MemoryStore } from "./store";
import { createSwr } from "./swr";

const policy = { freshSec: 60, swrSec: 600, maxStaleSec: 3600 };

function setup() {
    let t = 1_000_000;
    const now = () => t;
    const background: Promise<unknown>[] = [];
    const store = new MemoryStore(100, now);
    const swr = createSwr({
        store,
        now,
        waitUntil: (p) => background.push(p),
        isPermanent: (e) => e instanceof Error && e.message === "gone",
    });
    return { swr, advance: (s: number) => (t += s * 1000), background, store };
}

describe("swr", () => {
    it("serves fresh values without refetching", async () => {
        const { swr } = setup();
        const fetcher = vi.fn().mockResolvedValue("v1");
        expect(await swr("k", fetcher, policy)).toEqual({ value: "v1", stale: false });
        expect(await swr("k", fetcher, policy)).toEqual({ value: "v1", stale: false });
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("serves the old value and revalidates in the background inside the swr window", async () => {
        const { swr, advance, background } = setup();
        await swr("k", async () => "v1", policy);
        advance(120);
        const fetcher = vi.fn().mockResolvedValue("v2");
        expect(await swr("k", fetcher, policy)).toEqual({ value: "v1", stale: false });
        await Promise.all(background);
        expect(fetcher).toHaveBeenCalledOnce();
        expect(await swr("k", fetcher, policy)).toEqual({ value: "v2", stale: false });
    });

    it("falls back to stale data when upstream fails, but not for permanent errors", async () => {
        const { swr, advance } = setup();
        await swr("k", async () => "v1", policy);
        advance(1200);
        expect(await swr("k", () => Promise.reject(new Error("down")), policy)).toEqual({
            value: "v1",
            stale: true,
        });
        await expect(swr("k", () => Promise.reject(new Error("gone")), policy)).rejects.toThrow(
            "gone",
        );
    });

    it("dedupes concurrent fetches (single flight)", async () => {
        const { swr } = setup();
        let calls = 0;
        const fetcher = () => new Promise<string>((r) => setTimeout(() => r(`v${++calls}`), 10));
        const [a, b, c] = await Promise.all([
            swr("k", fetcher, policy),
            swr("k", fetcher, policy),
            swr("k", fetcher, policy),
        ]);
        expect(calls).toBe(1);
        expect([a.value, b.value, c.value]).toEqual(["v1", "v1", "v1"]);
    });

    it("expires entries after maxStale", async () => {
        const { swr, advance } = setup();
        await swr("k", async () => "v1", policy);
        advance(3601);
        await expect(swr("k", () => Promise.reject(new Error("down")), policy)).rejects.toThrow(
            "down",
        );
    });
});

describe("Limiter", () => {
    it("caps concurrency", async () => {
        const limiter = new Limiter({ concurrency: 2 });
        let running = 0;
        let peak = 0;
        const job = () =>
            limiter.run(async () => {
                peak = Math.max(peak, ++running);
                await new Promise((r) => setTimeout(r, 5));
                running--;
            });
        await Promise.all(Array.from({ length: 6 }, job));
        expect(peak).toBe(2);
    });

    it("opens the circuit after repeated failures, then closes after the cooldown", async () => {
        let t = 0;
        const limiter = new Limiter({ failureThreshold: 2, cooldownMs: 1000, now: () => t });
        const fail = () => limiter.run(() => Promise.reject(new Error("x")));
        await expect(fail()).rejects.toThrow("x");
        await expect(fail()).rejects.toThrow("x");
        await expect(limiter.run(async () => 1)).rejects.toBeInstanceOf(CircuitOpenError);
        t = 1001;
        await expect(limiter.run(async () => 1)).resolves.toBe(1);
    });
});
