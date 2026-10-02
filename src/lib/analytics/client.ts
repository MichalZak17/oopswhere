/**
 * Product analytics (PostHog), browser side. Opt-in: starts only when the page carries a
 * key (`<html data-ph>`, rendered from POSTHOG_KEY) and the visitor said yes
 * (`data-consent`, from the ow_consent cookie; see lib/consent.ts), and only once the
 * browser is idle, so it never competes with the first paint. The SDK and the two
 * extensions it needs (web vitals, error capture) are our own chunks: no PostHog-hosted
 * JS ever runs on the page.
 *
 * Privacy settings: cookieless (PostHog sets no cookies or storage), no person profiles,
 * no autocapture (the screen is a student's timetable), no session replay. Custom events
 * (track) carry closed-set values only.
 */
import type { PostHog } from "posthog-js";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, type Consent } from "@/lib/consent";

type Props = Record<string, string | number | boolean>;

// One instance even if the bundler duplicates this module across entry points.
const KEY = "__owAnalytics";
type State = { ready: Promise<PostHog | null>; started: boolean };
const g = globalThis as typeof globalThis & { [KEY]?: State };

function idle(): Promise<void> {
    return new Promise((resolve) => {
        if ("requestIdleCallback" in window)
            requestIdleCallback(() => resolve(), { timeout: 3000 });
        else setTimeout(resolve, 1500);
    });
}

async function start(key: string): Promise<PostHog | null> {
    await idle();
    // The extensions register themselves on window.__PosthogExtensions__, so the SDK
    // finds them instead of fetching them from its CDN.
    const [{ default: posthog }] = await Promise.all([
        import("posthog-js"),
        import("posthog-js/dist/web-vitals"),
        import("posthog-js/dist/exception-autocapture"),
    ]);
    posthog.init(key, {
        // PostHog Cloud EU. connect-src allows the API and the assets host (remote config
        // JSON); script-src allows neither (astro.config.mjs).
        api_host: "https://eu.i.posthog.com",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-08-30",
        disable_external_dependency_loading: true,
        // Otherwise localhost tries to enable person processing; `env` marks dev instead.
        internal_or_test_user_hostname: null,
        cookieless_mode: "always",
        person_profiles: "never",
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        capture_exceptions: true,
        capture_performance: { web_vitals: true, network_timing: false },
        capture_heatmaps: false,
        capture_dead_clicks: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        mask_personal_data_properties: true,
        respect_dnt: true,
    });
    // Lets dashboards filter out local testing.
    posthog.register({ env: import.meta.env.DEV ? "dev" : "prod" });
    return posthog;
}

/** Starts the SDK the first time the page has both a key and a yes; until then, nothing. */
function state(): State {
    const s = (g[KEY] ??= { ready: Promise.resolve(null), started: false });
    const { ph, consent } = document.documentElement.dataset;
    if (!s.started && ph && consent === "yes") {
        s.started = true;
        s.ready = start(ph).catch(() => null);
    }
    return s;
}

export function initAnalytics(): void {
    state();
}

/**
 * Remembers the answer in this browser and, on a yes, starts analytics on this page.
 * Turning it off again goes through a page load (the privacy page's form), which never
 * starts the SDK.
 */
export function setConsent(choice: Consent): void {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
    document.documentElement.dataset.consent = choice;
    state();
}

/** Queue-safe once consented: events captured before the SDK loads are sent once it has. */
export function track(event: string, props?: Props): void {
    void state().ready.then((ph) => ph?.capture(event, props));
}
