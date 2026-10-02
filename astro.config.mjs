// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";

// Every origin the user passes through by redirect during login must be allowed as a
// form-action target: browsers check form-action on each hop of the redirect chain
// started by the login POST (303 → USOS → the university's SSO), not only the first.
// Keep in sync with src/config/installations.ts; a USOS_*_BASE_URL override (e2e mock)
// is added at build time.
const USOS_ORIGINS = [
    "https://usosapi.zut.edu.pl",
    "https://login.zut.edu.pl", // ZUT SSO (Keycloak), USOS redirects here to sign in
    ...[process.env.USOS_ZUT_BASE_URL].filter(Boolean).map((u) => new URL(String(u)).origin),
];

export default defineConfig({
    output: "server",
    adapter: node({ mode: "standalone" }),
    integrations: [svelte()],

    i18n: {
        locales: ["pl", "en"],
        defaultLocale: "pl",
        routing: { prefixDefaultLocale: false },
    },

    // Prefetch would happily follow links that change state, and the calendar
    // never navigates away anyway.
    prefetch: false,

    // No server-side sessions: everything about a user lives in their own sealed cookie.
    session: false,

    // No Markdown is rendered; Shiki's inline styles would also clash with the CSP.
    markdown: { syntaxHighlight: false },

    security: {
        // Behind a TLS-terminating proxy (Cloudflare → Coolify's Traefik) the server only
        // sees http://, so Astro's built-in check would reject every https:// Origin.
        // src/middleware.ts checks Origin against SITE_URL instead.
        checkOrigin: false,
        csp: {
            directives: [
                "default-src 'self'",
                "img-src 'self' data:",
                "font-src 'self'",
                // PostHog Cloud EU (product analytics; only used when POSTHOG_KEY is set):
                // event ingestion + the remote config JSON. Its JS is bundled, never loaded.
                "connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com",
                "base-uri 'none'",
                "object-src 'none'",
                "frame-ancestors 'none'",
                `form-action 'self' ${USOS_ORIGINS.join(" ")}`,
            ],
            styleDirective: {
                // Events are positioned with CSS custom properties in style="".
                resources: ["'self'", { resource: "'unsafe-inline'", kind: "attribute" }],
            },
        },
    },

    env: {
        schema: {
            SESSION_SECRET: envField.string({
                context: "server",
                access: "secret",
                optional: true,
                min: 32,
            }),
            SESSION_SECRET_PREVIOUS: envField.string({
                context: "server",
                access: "secret",
                optional: true,
            }),
            SITE_URL: envField.string({
                context: "server",
                access: "secret",
                optional: true,
                url: true,
            }),
            USOS_ZUT_CONSUMER_KEY: envField.string({
                context: "server",
                access: "secret",
                optional: true,
            }),
            USOS_ZUT_CONSUMER_SECRET: envField.string({
                context: "server",
                access: "secret",
                optional: true,
            }),
            USOS_ZUT_BASE_URL: envField.string({
                context: "server",
                access: "secret",
                optional: true,
                url: true,
            }),
            // Product analytics (PostHog Cloud EU). Off when unset. Runtime config like the
            // rest: the key is rendered into the page, not baked into the bundle.
            POSTHOG_KEY: envField.string({
                context: "server",
                access: "secret",
                optional: true,
            }),
            // /demo is dev-only; the e2e suite runs a production build and opts back in.
            ENABLE_DEMO: envField.boolean({
                context: "server",
                access: "secret",
                optional: true,
            }),
        },
    },

    fonts: [
        {
            provider: fontProviders.fontsource(),
            name: "Schibsted Grotesk",
            cssVariable: "--font-sans",
            weights: ["400 900"],
            styles: ["normal"],
            subsets: ["latin", "latin-ext"],
            fallbacks: ["system-ui", "sans-serif"],
        },
    ],
});
