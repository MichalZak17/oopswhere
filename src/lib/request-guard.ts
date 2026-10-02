/**
 * Request checks that work behind a TLS-terminating proxy. Under Cloudflare → Coolify's
 * Traefik the server only ever sees http://<host>, so the public origin (SITE_URL) is
 * passed in rather than read from the request URL.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Paths probed from inside the container (Host: localhost), never redirected. */
const PROBES = new Set(["/api/health"]);

/**
 * Replaces Astro's `checkOrigin`: a state-changing request must come from our own pages.
 * Browsers send Origin on every POST, so a missing one is treated as cross-site too.
 */
export function isCrossSiteWrite(request: Request, publicOrigin: string): boolean {
    if (SAFE_METHODS.has(request.method)) return false;
    return request.headers.get("origin") !== publicOrigin;
}

/**
 * Where to send a GET that arrived on another host (www., the server IP…), or null.
 * Login only works on the canonical host: the OAuth callback and its cookie live there.
 */
export function canonicalRedirect(request: Request, url: URL, publicOrigin: string): string | null {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    if (PROBES.has(url.pathname)) return null;
    const canonical = new URL(publicOrigin);
    if (url.host === canonical.host) return null;
    return new URL(`${url.pathname}${url.search}`, canonical).toString();
}
