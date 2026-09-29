# Spend

A calm, voice-first spend tracker. Say *“450 at Starbucks and 180 for an auto”*, and Spend logs
both, sorts them into categories, and shows you where your money goes.

- **Voice first.** Tap the mic and talk. Typing works too, and so do several spends in one sentence
  or phrases like *yesterday* and *last friday*.
- **Learns from you.** Fix a category once and every future spend with that name follows it. The
  parser runs entirely on rules and your own history. There are no AI calls and no API keys.
- **A dashboard that notices things.** Budget pace, categories that are up or down against the same
  point last month, small spends that quietly add up, your priciest weekday, no-spend days, your top
  places, a running total against last month, and more.
- **Private by default.** Username and a 6-digit PIN, invite-only signups, and a strict set of
  security headers. Details are below.
- **Installable PWA** that works on phone and desktop, in light and dark mode.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App + BFF | **Next.js 16** (App Router) on **Vercel** | Pages and the API (`app/api/*`) ship as one project. The API routes are the backend-for-frontend: the browser never talks to the database. |
| Database | **Neon Postgres** (free tier) | Serverless Postgres over HTTP, suspends itself when idle, one-click Vercel integration. |
| Data fetching | SWR | Caches responses and refreshes when you come back to the tab, so your devices stay in sync. |
| Validation | zod | Every request body and query string is validated on the server. |

There's no Redis, no queue and no paid API. Rate limits live in Postgres too.

```
app/
  (auth)/login, (auth)/signup   username + PIN screens
  (app)/  page, activity, settings   the signed-in app
  api/    auth/*, me, spends, dashboard   ← the BFF
components/                     UI (dashboard charts, sheets, dock, voice)
lib/
  parser.ts      speech → spends (pure, unit-tested)
  insights.ts    dashboard maths (pure, unit-tested)
  server/        db, auth, rate limits, queries (server-only)
db/schema.sql    the whole schema (idempotent)
proxy.ts         CSP nonce, CSRF check, login redirect
```

## Deploy on Vercel (about 5 minutes)

1. **Import the repo** in Vercel (*Add New → Project*). Don't deploy yet.
2. **Create the database.** In the project, open *Storage → Create Database → Neon* and pick the
   free plan and a region close to you. Connect it to the project. This sets `DATABASE_URL`
   automatically.
   *(Or create a project at [neon.tech](https://neon.tech) yourself and paste its connection string
   as `DATABASE_URL`.)*
3. **Add environment variables** under *Settings → Environment Variables*:

   | Name | Value |
   | --- | --- |
   | `PIN_PEPPER` | A long random secret. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `SIGNUP_CODE` | Any invite code you like. It's needed to create an account. |

4. **Deploy.** The build creates the tables first (`scripts/migrate.mjs` runs before `next build`
   and is safe to run on every deploy).
5. Open `/signup`, enter your invite code, and pick a username and PIN.
   To close signups afterwards, delete `SIGNUP_CODE` and redeploy.

> Keep `PIN_PEPPER` safe and never change it. Every PIN hash depends on it, so changing it locks
> everyone out.

Pick the same (or a nearby) region for your Vercel functions (*Settings → Functions → Region*) and
your Neon database. It's the biggest single factor in how fast the app feels.

## Run locally

```sh
cp .env.example .env.local   # fill in DATABASE_URL, PIN_PEPPER, SIGNUP_CODE
npm install
npm run db:migrate
npm run dev                  # http://localhost:3000
npm test                     # parser, insights and auth tests
```

`DATABASE_URL` can point at Neon, or at any local Postgres (`postgres://user@localhost:5432/spend`).
Local URLs use a regular Postgres driver, and everything else uses Neon's serverless HTTP driver.

## Security

This is a personal app on the open internet, so it assumes people will poke at it.

- **PINs**: HMAC-peppered with a server-only secret, then hashed with scrypt and a per-user salt. A
  leaked database alone can't be brute-forced offline, even though a PIN has only 10⁶ values. Easy
  PINs such as `123456`, `000000` and `121212` are refused.
- **Brute force**: after 5 wrong PINs the account locks for 15 minutes, doubling up to 24 hours. There's
  also a per-IP limit on login and signup. Unknown usernames take the same time as real ones and get
  the same error message, so the login form doesn't reveal which usernames exist.
- **Signups** are invite-only (`SIGNUP_CODE`, compared in constant time) and closed when it isn't set.
- **Sessions** are random 256-bit tokens in an `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` cookie.
  Only their SHA-256 is stored. They expire after 30 days, extended while you're active, and can be
  revoked with *Log out of every device*. Changing your PIN signs out every other device.
- **CSRF**: state-changing API calls must come from the app's own origin (`Origin` /
  `Sec-Fetch-Site` are checked in `proxy.ts`), on top of `SameSite` cookies.
- **XSS**: a strict nonce-based Content-Security-Policy, so only the app's own scripts run. React
  escapes everything it renders.
- **Injection**: every SQL value is a bound parameter. Inputs are validated with zod, request bodies
  are size-capped, and CSV exports neutralise spreadsheet formulas.
- **Access control**: every query is scoped to the signed-in user's id, so you can't read or change
  another account's spends even by guessing ids.
- **Headers**: HSTS, `X-Frame-Options: DENY`, `nosniff`, a same-origin referrer policy, and a
  permissions policy that allows only the microphone.
- **No third parties**: no AI, analytics or trackers. Fonts are self-hosted at build time.

## Running cost

Built to run for free:

- **Vercel Hobby** covers a personal (non-commercial) app like this.
- **Neon free tier**: a spend row is a few hundred bytes, so the free storage holds hundreds of
  thousands of spends. The database suspends when idle, so it doesn't use up compute while you're
  not using the app.
- There are no paid APIs. Speech recognition runs in the browser (Chrome, Edge and Safari; Firefox
  falls back to typing).

## How categorisation works

1. `lib/parser.ts` pulls amounts (`₹1,200`, `2.5k`, *“two hundred and fifty”*), places (*at …*),
   items (*on …*, *for …*) and dates out of the sentence. It then matches around 300 keywords across 8
   categories, including common Indian and global brands.
2. Before saving, the server checks your history. If you've filed that place before, the category
   you chose most often wins. So correcting *“Bluebird”* to *Fun* once is enough.
