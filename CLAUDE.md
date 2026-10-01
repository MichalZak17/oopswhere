# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What is oopswhere

An open-source, premium-feeling replacement for the USOSweb timetable page (ZUT first, any USOS
university later). Students sign in **once** through their university's own login page; the app keeps
only their list of class groups in an encrypted cookie and renders the whole term from **public**
USOS data. No database, never sees passwords. Polish (default, `/`) and English (`/en/`).

## Commands

- `npm run dev` — dev server on http://localhost:4321 (reads `.env.local`). Works without keys:
  `/demo` uses public groups (dev only — production 404s unless `ENABLE_DEMO=true`, which e2e sets); the login button is disabled until `USOS_ZUT_CONSUMER_*` are set.
- `npm run check` — `astro check` (TS + Astro + Svelte). Must be 0 errors / 0 warnings.
- `npm test` — Vitest unit tests (`src/**/*.test.ts`, no network). The commit gate.
- `npm run test:e2e` — Playwright: builds the **Node** target and runs it against the mock USOS
  (`tests/mock-usos/server.ts`). Locally uses installed Chrome (`channel: "chrome"`); CI uses Chromium.
- `npm run build` (Vercel when `VERCEL=1`, else Node) · `npm run build:node` · `npm start`.
- `npm run fixtures` — refresh `tests/fixtures/zut` from the public API (anonymous GETs only).
- `npm run secret` — print a new `SESSION_SECRET`.

Use **npm** (not pnpm). TypeScript is pinned to 6.x: `@astrojs/check` and `@astrojs/svelte` don't
support TS 7 yet. `overrides` pins `path-to-regexp@6.3.0` under `@vercel/routing-utils` (audit fix).

## Architecture

**Astro 7 SSR + one Svelte 5 island (the calendar) + plain CSS.** No Tailwind/shadcn on purpose.

### Data flow (the core idea)

1. `POST /auth/[inst]/login` → USOS `oauth/request_token` (scope `studies`), request-token secret
   sealed into a 15-min `ow_oauth` cookie (path `/auth/`), 303 → `oauth/authorize` (university SSO).
2. `GET /auth/[inst]/callback` → verify `oauth_token` against the cookie (constant time — this is the
   CSRF guard, OAuth 1.0a has no `state`), `oauth/access_token`, read `groups/participant` +
   `users/user` (first name only), **always `revoke_token` in `finally`**, keep groups of current
   terms, warm the cache, write the `ow_profile` cookie (400 days).
3. Every page render: middleware unseals the profile → `loadTimetable()` fetches each group with the
   **anonymous** `tt/classgroup_dates2` (whole term) through a shared SWR cache, plus lecturer names via
   consumer-signed `users/users`. The whole term is embedded in the SSR HTML; week navigation is
   client-side with no network. Groups that miss the 1.5 s budget are listed in `missing` and the island
   refetches `GET /api/v1/timetable`.

Never store tokens, USOS user ids or emails. Never request `participants` (classmates' data).

### Key files

- `src/lib/oauth1/sign.ts` — RFC 5849 HMAC-SHA1 signer on Web Crypto (tested against RFC vectors).
- `src/lib/crypto/seal.ts` — AES-256-GCM cookie sealing, HKDF per purpose, AAD = purpose, key rotation
  via `SESSION_SECRET_PREVIOUS`.
- `src/lib/usos/{client,oauth,api}.ts` — USOS calls. Signed calls are POST + `Authorization` header;
  `oauth_*` params go to the header automatically.
- `src/lib/timetable/{load,normalize,types}.ts` — loader (budget, gone/missing/stale), raw → compact
  `MeetingTuple`s. `types.ts` ships to the browser: keep it free of server imports.
- `src/lib/cache/*` + `src/lib/platform.ts` — SWR (fresh 30 min / background refresh until 6 h /
  stale-on-error until 14 d), single-flight, concurrency limiter + circuit breaker. Node: in-memory LRU.
  Vercel: 60 s memory tier + Vercel Runtime Cache (detected at runtime via `process.env.VERCEL`).
- `src/lib/time/*` — wall-clock dates. USOS times are naive Europe/Warsaw; **never convert to UTC**.
  Dates are `YYYY-MM-DD` strings, math via `Date.UTC`; "now" via `zonedNow(timeZone)`.
- `src/lib/layout/lanes.ts` — clash layout (clusters → lanes → span); only truly overlapping pairs get
  `conflict`.
- `src/components/calendar/` — `Calendar.svelte` (state, keyboard, URL `?week=`, refresh),
  `WeekGrid` (grid; on < 720 px container width a scroll-snap day pager + day strip), `EventCard`,
  `NextUp`, `EventSheet` (native `<dialog>`), `model.ts`/`display.ts`/`format.ts` (pure helpers),
  `transitions.ts` (View Transitions: `slide()` for weeks, `morph()` card ↔ sheet).
- `src/config/installations.ts` — USOS installations (data only). Keys come from
  `USOS_<ID>_CONSUMER_KEY/SECRET`. Add the API origin **and its SSO login origin** to `USOS_ORIGINS` in `astro.config.mjs`
  (CSP `form-action`).
- `src/i18n/locales/{pl,en}.json` — `pl` is the source of truth, `en` must match its shape (`Dict` in `src/i18n/index.ts`). `pick()` chooses a USOS
  LangDict value with Polish fallback (ZUT's `en` is often empty).
- `src/middleware.ts` — profile → `locals`, `ow_lang` redirect for `/`, security headers,
  `Cache-Control: private, no-cache` on HTML.

### Rules that are easy to break

- **No Astro route caching / CDN caching on personal pages or `/api/v1/timetable`** — the cache key
  ignores cookies and would leak one student's plan to another. Set `Cache-Control` in middleware or
  endpoints; `Astro.response.headers` in nested components is lost once streaming starts.
- No `<ClientRouter />` and no inline `<script is:inline>` — CSP is hash-based. Inline `style=""`
  attributes are allowed (`style-src-attr 'unsafe-inline'`) because events are positioned with CSS vars.
- `light-dark()` only accepts colours; numeric per-theme tokens use the `prefers-color-scheme` block in
  `tokens.css`.
- Small text must use `--ink-3` or darker / `--accent-text` (axe AA is enforced in e2e). `--ink-faint`
  is for large display text only.
- Don't create `src/fetch.ts` (reserved by Astro 7).
- Never log query strings, tokens or cookies.

## Design language

"Printed timetable": warm paper / graphite, hairline grid, one vermilion accent for _now_, Schibsted
Grotesk (self-hosted via the Astro Fonts API), USOS class-type codes (WK, LB, CW, LK…) on cards with
muted per-type OKLCH tints. No gradients, glassmorphism, emoji, or stock component-library look.
Motion: transform/opacity only, `--ease-out`, 140/220/420 ms, everything off under
`prefers-reduced-motion`.

## Deployment

- **Vercel**: `vercel.json` pins `fra1`. Env: `SESSION_SECRET`, `SITE_URL`, `USOS_ZUT_CONSUMER_KEY`,
  `USOS_ZUT_CONSUMER_SECRET`.
- **Docker / Coolify**: `Dockerfile` (Node 24 alpine, non-root, healthcheck `/api/health`, port 4321),
  `docker-compose.yml`. `docker build --target test .` runs unit tests.

## Known limits (v1)

`classgroup_dates2` has no exams or ad-hoc meetings and no "cancelled" flag (cancelled meetings just
disappear). Students who change groups use "Odśwież grupy" (re-runs OAuth; near-instant with an active
SSO session).
