// @ts-check
import { defineConfig, envField, fontProviders } from "astro/config";
import svelte from "@astrojs/svelte";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";

// One codebase, two homes: Vercel (default when building on Vercel) or a plain
// Node server for Docker / Coolify. Override with DEPLOY_TARGET=node|vercel.
const target = process.env.DEPLOY_TARGET ?? (process.env.VERCEL ? "vercel" : "node");

// Every USOS installation the user can be sent to during login must be allowed
// as a form-action target (the login POST answers with a 303 to USOS). Keep in sync
// with src/config/installations.ts; a USOS_*_BASE_URL override (e2e mock) is added
// at build time.
const USOS_ORIGINS = [
    "https://usosapi.zut.edu.pl",
    ...[process.env.USOS_ZUT_BASE_URL].filter(Boolean).map((u) => new URL(String(u)).origin),
];

export default defineConfig({
    output: "server",
    adapter: target === "vercel" ? vercel() : node({ mode: "standalone" }),
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
        checkOrigin: true,
        csp: {
            directives: [
                "default-src 'self'",
                "img-src 'self' data:",
                "font-src 'self'",
                "connect-src 'self'",
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
