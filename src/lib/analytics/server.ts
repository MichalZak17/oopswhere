/**
 * Product analytics (PostHog), server side. Off unless POSTHOG_KEY is set, so dev, e2e and
 * other deployments send nothing.
 *
 * Events carry only closed-set values and counts: never USOS ids, group numbers, names,
 * tokens, URLs or query strings. Each server event gets a fresh random distinct id and no
 * person profile, so PostHog can count events but cannot link them to anyone.
 */
import { getSecret } from "astro:env/server";

/** PostHog Cloud EU. Also allowed in the CSP (astro.config.mjs). */
const POSTHOG_HOST = "https://eu.i.posthog.com";

/** Project API key: write-only and meant to be public (it ships to the browser). */
export function analyticsKey(): string | null {
    return getSecret("POSTHOG_KEY") || null;
}

export type EventProps = Record<string, string | number | boolean | null>;

export type LoginOutcome = "ok" | "denied" | "expired" | "error" | "nogroups";

/** Fire-and-forget: never awaited by a request, never throws. */
export function track(event: string, props: EventProps = {}): void {
    const key = analyticsKey();
    if (!key) return;
    void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: key,
            event,
            distinct_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            properties: {
                ...props,
                $process_person_profile: false,
                // The request comes from our server; its location means nothing.
                $geoip_disable: true,
                $lib: "oopswhere-server",
                env: import.meta.env.DEV ? "dev" : "prod",
            },
        }),
        signal: AbortSignal.timeout(5000),
    }).catch(() => {});
}

/** How a timetable load went: speed, and how much USOS could not deliver in time. */
export function trackTimetable(
    source: "page" | "api",
    payload: { inst: string; missing: unknown[]; stale: unknown[]; gone: unknown[] },
    groups: number,
    startedAt: number,
    demo: boolean,
): void {
    track("timetable_loaded", {
        inst: payload.inst,
        source,
        demo,
        duration_ms: Date.now() - startedAt,
        groups,
        missing: payload.missing.length,
        stale: payload.stale.length,
        gone: payload.gone.length,
    });
}
