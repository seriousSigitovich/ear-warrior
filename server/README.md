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
ADMIN_PASSWORD=choose-one npm run dev     # page: http://localhost:8080/admin/social (user: admin)
npm run collect                           # one collection pass from the CLI (exit 1 on failure)
npm test                                  # collectors run against a fake fetch, no network
```

Without `ADMIN_PASSWORD` the page answers 404. To collect automatically either set
`SOCIAL_COLLECT_INTERVAL_HOURS=6` (in-process timer) or call `node dist/collect.js` / `POST
/admin/social/collect` from any scheduler. Repeated runs on the same UTC day overwrite that day.

### Connect YouTube (one-time, ~15 min)

1. [Google Cloud Console](https://console.cloud.google.com) → new project → enable **YouTube Data API v3**
   and **YouTube Analytics API**.
2. OAuth consent screen → External → add your Google account as a test user. **Then publish the app
   ("In production")**: in "Testing" status refresh tokens expire after 7 days. An unverified app
   with your own account works, you just click through the warning once.
3. Credentials → OAuth client ID → type **Web application**, authorized redirect URI
   `https://developers.google.com/oauthplayground` → `YT_CLIENT_ID`, `YT_CLIENT_SECRET`.
4. [OAuth Playground](https://developers.google.com/oauthplayground) → ⚙ "Use your own OAuth
   credentials" → scopes `https://www.googleapis.com/auth/youtube.readonly` and
   `https://www.googleapis.com/auth/yt-analytics.readonly` → authorize with the channel owner
   account → "Exchange authorization code" → copy the **refresh token** → `YT_REFRESH_TOKEN`.

### Connect Instagram (one-time, ~15 min)

1. [developers.facebook.com](https://developers.facebook.com) → create an app (type Business) → add
   the **Instagram** product → "API setup with Instagram login".
2. Add the Business account as an Instagram tester/account, accept the invite in the Instagram app
   (Settings → Apps and websites), then **Generate token** for it with permissions
   `instagram_business_basic` and `instagram_business_manage_insights`. For your own account in
   development mode no app review is needed.
3. Put the token in `IG_ACCESS_TOKEN`. It is long-lived (60 days) and is refreshed automatically;
   after the first run the current token lives in the `social_tokens` table, the env var only seeds it.

> The collectors were written against the documented API shapes and tested with fakes. Run
> `npm run collect` once with real credentials and check the status chips on the page: an API
> change or a missing permission shows up there as the exact error text.
