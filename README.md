<p align="center">
  <img src="docs/banner.en.svg" alt="Which room? You already know." width="720">
</p>

# oopswhere

**Which room? You already know.** A timetable for students of universities that use
[USOS](https://usos.edu.pl), ZUT (Szczecin) first. It shows your timetable.

## What it does

- Shows where the room is.
- Shows when.
- Two classes at once? Side by side, like on paper.
- Works on a phone. Yes, that one. Part-time weekend students get a wide Saturday and Sunday instead of
  five empty columns.
- Signs you in once, through your university's own login page. Your password stays there. oopswhere
  never sees it.
- Remembers that you've already signed in. The only thing it keeps is your list of class groups, in an
  encrypted cookie on your device. There is no database.
- Loads the whole semester with the page, so switching weeks needs no network. A timetable turns out
  not to be a lot of data.
- Light and dark, keyboard and screen reader. You're welcome.

## Questions

**Is this the university's official site?** No. Being official has its advantages. We leave those to
the university.

**What if USOS has a bad day?** We show the last timetable we have and mention it quietly. Everyone
has bad days.

**Will I be signed out?** If you want to be. There's a button for that.

**Something's off.** Write in the [issues](https://github.com/MichalZak17/oopswhere/issues). We'll
answer.

## How it works

```
 you ──► oopswhere ──► USOS API: request token
  ◄──────── 303 ──────────────────────────────┐
 you ──► university login (SSO)  ─────────────┘   ← your password goes here, and only here
  ◄──── back to oopswhere with a one-time code
        oopswhere ──► USOS API: access token → your class groups + first name → revoke token
        your browser ◄── encrypted cookie: { first name, [group ids] }

 every visit: oopswhere ──► USOS API (public, anonymous): each group's whole-term timetable
```

Group timetables, rooms and lecturer names are public in USOS; only the _list of your groups_
needs your account, and only once per semester.

## Run it locally

Requirements: Node 22.12+ (24 recommended).

```bash
npm install
cp .env.example .env.local   # then fill it in, see below
npm run dev                  # http://localhost:4321
```

`/demo` (dev server only) works without any keys. To enable sign-in, register a free consumer key at
<https://usosapi.zut.edu.pl/developers/> and set:

| Variable                                             |                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `SESSION_SECRET`                                     | 32+ random bytes — `npm run secret`                                       |
| `SITE_URL`                                           | Public origin, used for the OAuth callback (e.g. `http://localhost:4321`) |
| `USOS_ZUT_CONSUMER_KEY` / `USOS_ZUT_CONSUMER_SECRET` | Your USOS API consumer                                                    |

## Deploy

oopswhere is self-hosted: one Docker image, one Node process, no database. The production instance
runs on [Coolify](https://coolify.io) behind Cloudflare.

**Coolify**

1. New resource → your Git repository, branch `master`, build pack **Dockerfile** (`/Dockerfile`).
2. Ports exposes: `4321`. Domains: your domain(s), e.g. `https://oopswhere.com` (Cloudflare in
   front: `http://` is fine too, Cloudflare terminates TLS).
3. Environment variables (runtime only: untick _Available at Buildtime_, the build needs none):

   | Variable                                             |                                                                                              |
   | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
   | `SESSION_SECRET`                                     | 32+ random bytes, `npm run secret`. To rotate, move the old one to `SESSION_SECRET_PREVIOUS` |
   | `SITE_URL`                                           | The public origin exactly as visitors type it, e.g. `https://oopswhere.com` (see below)      |
   | `USOS_ZUT_CONSUMER_KEY` / `USOS_ZUT_CONSUMER_SECRET` | Your USOS API consumer                                                                       |

4. Health check: the image has a `HEALTHCHECK` on `/api/health`, which Coolify uses as is. If you
   enable Coolify's own health check, point it at `/api/health` too (not `/`).

Why `SITE_URL` matters: behind a TLS-terminating proxy (Cloudflare → Traefik) the app only ever sees
plain `http://`. `SITE_URL` tells it the truth, and it decides the OAuth callback, `Secure`/`__Host-`
cookies, HSTS, the Origin check on sign-in, and the canonical host: requests for any other host
(`www.`, the server IP) are redirected there with a 308.

On Cloudflare, also turn on **Always Use HTTPS** (SSL/TLS → Edge Certificates); the app can't see
whether a visitor arrived over http.

Redeploys are zero-downtime: Coolify waits for the new container's health check, then stops the old
one; `server.mjs` drains in-flight requests on `SIGTERM`. The timetable cache lives in process memory,
so the first visits after a deploy refetch from USOS (groups that miss the 1.5 s budget load right after the page).

**Any Docker host**

```bash
cp .env.example .env    # fill in
docker compose up --build
```

The image is a plain Node server on port 4321 with a health check at `/api/health`. Put it behind any
reverse proxy that terminates TLS and set `SITE_URL` to the public origin.

## Development

```bash
npm run check      # types (Astro + Svelte + TS)
npm test           # unit tests
npm run test:e2e   # end-to-end against a mock USOS (signature-verifying)
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the rules that keep it fast and private, and
[CONTRIBUTING.md](docs/CONTRIBUTING.md) to add your university.

## Limits

Exams and one-off events aren't in the data. Cancelled classes simply disappear, which is one way of
announcing them. USOSweb remains the authority on both.

## License

[MIT](LICENSE). Not affiliated with ZUT or the USOS developers.

No need to thank us.
