# Contributing

Thanks for helping! Bug reports, design feedback and new universities are all welcome.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Before opening a PR: `npm run check && npm test && npm run test:e2e`, and `npm run format`.

## Adding your university

1. Find its USOS API base URL (usually `https://usosapi.<domain>/`) and confirm the anonymous method
   `services/tt/classgroup_dates2` works there.
2. Add an entry to `src/config/installations.ts` (id, names, `apiBaseUrl`, `usoswebUrl`, `timeZone`,
   optional `buildingAliases`).
3. Add the API origin to `USOS_ORIGINS` in `astro.config.mjs` (CSP `form-action`).
4. Register a consumer key at `<apiBaseUrl>/developers/` and set `USOS_<ID>_CONSUMER_KEY` /
   `USOS_<ID>_CONSUMER_SECRET`.
5. Optionally add a few public demo groups to `src/config/demo.ts`.

## Principles

- Never store user data server-side; never request more USOS scopes than `studies`.
- Be gentle with USOS: cache, batch, and keep the concurrency limiter in place.
- Keep the look quiet: hairlines over boxes, one accent colour, motion only where it explains change.
