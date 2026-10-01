# Security & data handling

## What oopswhere stores

| Where                                                                           | What                                                                                       | Lifetime                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Your browser, `ow_profile` cookie (HttpOnly, Secure, SameSite=Lax, AES-256-GCM) | first name, university id, term ids + end dates, `[unitId, groupNumber]` pairs, fetch time | up to 400 days, deleted on sign-out |
| Your browser, `ow_oauth` cookie (path `/auth/`, sealed)                         | one-time OAuth request token during sign-in                                                | ≤ 15 minutes, deleted on callback   |
| Your browser, `ow_lang` cookie                                                  | `pl` or `en`                                                                               | 1 year                              |
| Server memory / Vercel Runtime Cache                                            | public group timetables and public lecturer names                                          | ≤ 14 days                           |

The server has **no database** and stores nothing about individual users. OAuth access tokens are
used for two read-only calls during sign-in and revoked immediately. Passwords are only ever typed on
the university's own login page.

## Hardening

- OAuth 1.0a request tokens are bound to the browser via the sealed `ow_oauth` cookie and compared in
  constant time on callback (login CSRF protection).
- Sign-in, sign-out and group refresh are POST-only with Astro's origin check.
- Strict hash-based Content-Security-Policy, `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `nosniff`, COOP, HSTS on HTTPS. Fonts are self-hosted; no third-party requests from the browser.
- Personal pages are `Cache-Control: private, no-cache`.
- Cookie key rotation: move the old value to `SESSION_SECRET_PREVIOUS`, set a new `SESSION_SECRET`.

## Reporting a vulnerability

Please open a private security advisory on GitHub
(**Security → Report a vulnerability**) rather than a public issue.
