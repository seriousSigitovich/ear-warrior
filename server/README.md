# Ear Warrior backend

Fastify + Drizzle + Postgres. Replaces the previous Supabase setup (telemetry, waitlist) and
becomes the durable source of truth for game history synced from the app. The mobile app keeps a
local SQLite cache so practice still works fully offline; the cache syncs to this service.

## Endpoints

| Method | Path             | Purpose                                                        |
| ------ | ---------------- | ------------------------------------------------------------- |
| GET    | `/health`        | Liveness probe.                                               |
| POST   | `/api/subscribe` | Landing waitlist signup `{ email }`. Dedup by lower(email).   |
| POST   | `/api/attempts`  | Anonymous aggregate practice telemetry (was `attempt_log`).   |
| POST   | `/api/sync`      | Push local documents (last-write-wins on `updated_at`).       |
| GET    | `/api/sync`      | Pull documents changed since `?since=<ms>` for a `device_id`. |
| GET    | `/admin/social`  | Social analytics dashboard (Basic auth, see below).           |
| POST   | `/admin/social/collect` | Run the YouTube/Instagram collectors now.              |

Data model: `signups` and `attempt_log` are typed tables. Game history (sessions, attempts,
melodies, difficulty_settings, key_value) is stored losslessly as JSON documents in
`sync_documents`, keyed by `(device_id, collection, doc_id)`.

## Run locally

```bash
cp .env.example .env
docker compose up postgres      # start Postgres on :5432
npm install
npm run dev                     # Fastify on :8080, applies schema on boot
```

Or run the whole stack in Docker:

```bash
docker compose up --build       # Postgres + API
```

## Migrations

The server applies idempotent DDL at boot (`src/db/ddl.ts`), so no migration step is needed for
development. For tracked production migrations generated from the Drizzle schema:

```bash
npm run db:generate             # writes SQL into ./drizzle
```

## Client configuration

Point the app at this server with `EXPO_PUBLIC_API_URL` (see `app.config.ts` in the repo root),
e.g. `EXPO_PUBLIC_API_URL=http://localhost:8080`.

## Social analytics (YouTube + Instagram)

A collector pulls both platforms' own numbers into Postgres once a day; `/admin/social` shows them:
platform cards and the best posts for the last 7/28/90 days first, every post with its full
metrics and a views-over-time chart behind a click.

```
YouTube Data + Analytics API ─┐
                              ├─ collectors (src/social/) ─► social_posts / social_snapshots ─► /admin/social
Instagram Graph API ──────────┘        one row per post per UTC day (cumulative counters)
```

- **Growth is a difference of snapshots.** Platforms report cumulative totals; "+340 this week" is
  today's snapshot minus the one from the window start. Until a snapshot at the window start exists
  the page shows lifetime totals instead of a made-up number (`src/social/summary.ts`, tested).
- **`NULL` is not `0`.** A metric the platform does not report (YouTube has no saves) stays empty.
- **Not available through the APIs:** YouTube Studio's "viewed vs swiped away" and TikTok at all.
  Those stay in `docs/experiments.md`.

### Run

```bash
cp -n .env.example .env                   # scripts read .env via --env-file; set ADMIN_PASSWORD in it
npm run dev                               # page: http://localhost:8080/admin/social (user: admin)
npm run collect                           # one collection pass from the CLI (exit 1 on failure)
npm test                                  # collectors run against a fake fetch, no network
```

Without `ADMIN_PASSWORD` the page answers 404. To collect automatically either set
`SOCIAL_COLLECT_INTERVAL_HOURS=6` (in-process timer) or call `node dist/collect.js` / `POST
/admin/social/collect` from any scheduler. Repeated runs on the same UTC day overwrite that day.

### Connect YouTube (one-time)

1. [Google Cloud Console](https://console.cloud.google.com) → project → enable **YouTube Data API v3**
   and **YouTube Analytics API**.
2. Google Auth Platform → Branding: home page, privacy policy link (`https://earwarrior.app/privacy/`),
   authorised domain. Audience → **Publish app** ("In production"): in "Testing" status refresh
   tokens expire after 7 days. An unverified app with your own account works, you click through the
   warning once.
3. Clients → Create → **Web application**, redirect URI `http://localhost:8765/callback`. Put the ids in
   `.env` as `YT_CLIENT_ID` and `YT_CLIENT_SECRET` (the secret is shown only once).
4. `npm run yt:auth` — opens Google's consent screen (sign in with the account that owns the
   channel), catches the redirect on localhost and writes `YT_REFRESH_TOKEN` to `.env`. The token is
   never printed.
5. `npm run collect`, then open the page.

### Connect Instagram (one-time, as done on 2026-10-16)

1. [developers.facebook.com](https://developers.facebook.com) → **Create app** → use case **"Manage messaging & content on Instagram"** (Instagram API with Instagram Login), no business portfolio needed. Meta asks for your Facebook password once more at the end.
2. Use cases → Customize → **Permissions and features**: add `instagram_business_basic` and `instagram_business_manage_insights`.
3. App roles → **Add people** → role **Instagram Tester** → your Business account's username. Then, logged in to that account on instagram.com, open Settings → Apps and websites → **Tester invitations** → **Accept** (until you do, the role stays "pending" and no token can be made).
4. Use cases → Customize → **API setup with Instagram login** → step 2 → expand → **Generate token** for the account (log in and grant permissions in the Instagram window; the "Token generated" dialog can appear a few seconds late). It is shown **once**: tick "I understand", copy it, put it in `.env` as `IG_ACCESS_TOKEN`.
5. `npm run collect`. After the first run the token is refreshed automatically and kept in the `social_tokens` table; the env var only seeds it.

What Instagram gives per post (verified live): views, reach, likes, comments, shares, saves, average watch time. **Follows and profile visits per reel are not available through the API** (story-only metrics); account-level profile views, link taps and 28-day reach are.

> Both collectors are verified against the live APIs (2026-10-16). If an API changes or a permission
> is missing, the status chip on the page shows the platform's exact error text.
