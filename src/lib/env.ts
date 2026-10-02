/**
 * Server-only configuration. Secrets are read at runtime (astro:env "secret"), so one
 * build works on any domain and with any key.
 */
import { getSecret } from "astro:env/server";
import { getInstallation, type Installation } from "@/config/installations";

const DEV_SECRET = "oopswhere-dev-only-secret-do-not-use-in-production";

export class ConfigError extends Error {}

/** Current secret first, then the previous one (for rotation). */
export function sessionSecrets(): string[] {
    const current = getSecret("SESSION_SECRET");
    const previous = getSecret("SESSION_SECRET_PREVIOUS");
    if (!current) {
        if (import.meta.env.DEV) return [DEV_SECRET];
        throw new ConfigError("SESSION_SECRET is not set. Generate one with `npm run secret`.");
    }
    return previous ? [current, previous] : [current];
}

export function hasSessionSecret(): boolean {
    return Boolean(getSecret("SESSION_SECRET")) || import.meta.env.DEV;
}

/** `/demo` exists only in `astro dev`, or when a test build opts in with ENABLE_DEMO. */
export function demoEnabled(): boolean {
    return import.meta.env.DEV || getSecret("ENABLE_DEMO") === "true";
}

/**
 * The public origin, as visitors see it: OAuth callbacks, canonical links, the Origin check.
 * Behind a TLS-terminating proxy the request URL says http://, so production relies on
 * SITE_URL. Falls back to the request origin in dev.
 */
export function siteOrigin(requestUrl: URL): string {
    const configured = getSecret("SITE_URL");
    return configured ? new URL(configured).origin : requestUrl.origin;
}

/** True when visitors reach us over HTTPS, even if the proxy hands us plain http. */
export function isHttps(requestUrl: URL): boolean {
    return siteOrigin(requestUrl).startsWith("https:");
}

export interface ResolvedInstallation extends Installation {
    consumer: { key: string; secret: string } | null;
}

export function resolveInstallation(id: string | undefined): ResolvedInstallation | null {
    const inst = getInstallation(id);
    if (!inst) return null;
    const prefix = `USOS_${inst.id.toUpperCase()}_`;
    const key = getSecret(`${prefix}CONSUMER_KEY`);
    const secret = getSecret(`${prefix}CONSUMER_SECRET`);
    const baseOverride = getSecret(`${prefix}BASE_URL`);
    return {
        ...inst,
        apiBaseUrl: baseOverride ? baseOverride.replace(/\/?$/, "/") : inst.apiBaseUrl,
        consumer: key && secret ? { key, secret } : null,
    };
}
