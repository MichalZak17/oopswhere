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

**Vercel** — import the repo, set the variables above (with your production `SITE_URL`). The adapter
switches automatically on Vercel; functions run in `fra1`, next to the university.

**Docker / Coolify**

```bash
cp .env.example .env    # fill in
docker compose up --build
```

The image is a plain Node server on port 4321 with a health check at `/api/health`.

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
