import { defineMiddleware } from "astro:middleware";
import { LANG_COOKIE, THEME_COOKIE, readProfile } from "@/lib/cookies";
import { isHttps, siteOrigin } from "@/lib/env";
import { canonicalRedirect, isCrossSiteWrite } from "@/lib/request-guard";
import { asTheme } from "@/lib/theme";

const SECURITY_HEADERS: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    // CSP (incl. frame-ancestors) comes from astro.config; this also covers API routes.
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};

export const onRequest = defineMiddleware(async (ctx, next) => {
    // The proxy hands us http://; SITE_URL says what visitors actually use.
    const origin = siteOrigin(ctx.url);
    if (isCrossSiteWrite(ctx.request, origin)) {
        return new Response("Cross-site form submissions are forbidden", { status: 403 });
    }
    const canonical = canonicalRedirect(ctx.request, ctx.url, origin);
    if (canonical) return ctx.redirect(canonical, 308);

    ctx.locals.profile = await readProfile(ctx.cookies, ctx.url);

    ctx.locals.theme = asTheme(ctx.cookies.get(THEME_COOKIE)?.value);

    // Remember the language choice without an Accept-Language redirect.
    if (
        ctx.request.method === "GET" &&
        ctx.url.pathname === "/" &&
        ctx.cookies.get(LANG_COOKIE)?.value === "en"
    ) {
        return ctx.redirect(`/en/${ctx.url.search}`, 302);
    }

    const response = await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        if (!response.headers.has(name)) response.headers.set(name, value);
    }
    // Pages render per-user data from the cookie: never let a shared cache keep them.
    // (no-cache rather than no-store keeps the back/forward cache working.)
    if (
        !response.headers.has("Cache-Control") &&
        response.headers.get("Content-Type")?.startsWith("text/html")
    ) {
        response.headers.set("Cache-Control", "private, no-cache");
    }
    if (isHttps(ctx.url)) {
        response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    return response;
});
