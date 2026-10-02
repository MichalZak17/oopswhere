/**
 * Opt-in for browser analytics (posthog-js). The server-side counts in
 * `analytics/server.ts` don't need it: they run on our server, with no visitor IP or id.
 * Ships to the browser: keep it free of server imports.
 */
export type Consent = "yes" | "no";

/** Readable by the page script, so the choice applies without a reload. */
export const CONSENT_COOKIE = "ow_consent";

/** Ask again after about six months, whatever the answer was. */
export const CONSENT_MAX_AGE = 182 * 24 * 60 * 60;

export function asConsent(value: unknown): Consent | null {
    return value === "yes" || value === "no" ? value : null;
}

/** The answer stored in a `document.cookie` string, if any. */
export function consentFromCookies(cookies: string): Consent | null {
    const match = new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`).exec(cookies);
    return asConsent(match?.[1]);
}
