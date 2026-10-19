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

## Publishing videos (YouTube Shorts + Instagram Reels)

`npm run publish` takes a rendered video from `assets/video/challenge/out/` and publishes it through the
official APIs. It is local only: the write credentials live in `server/.env` under their own names and are
never pushed to Vercel (`scripts/vercel-env.sh` does not list them), so the hosted analytics stays read-only.

```bash
# 1) PLAN (default): checks the file, shows the final title/description/caption/tags/link, sends nothing
npm run publish -- --file ../assets/video/challenge/out/H14_youtube-A/ear-challenge-31.mp4 \
  --title "Everyone knows this one. Can you play it?" \
  --description "Part 1 of 4. One listen, then play it back by ear. Write the notes below." \
  --tags "#guitar #eartraining #playbyear"

# 2) PUBLISH: the same command plus --confirm
npm run publish -- <same arguments> --confirm
```

Options: `--platforms youtube,instagram` (default both) · `--caption` (Instagram text, defaults to `--description`) ·
`--no-publish` (Instagram: upload and process, do not publish — a safe rehearsal) · `--force` (publish a file again) ·
`--long` (YouTube only: a regular long-form video — needs a 16:9 file, no `#Shorts`, no 3-minute limit; YouTube turns any vertical or square video up to 3 min into a Short, so a vertical file cannot be a regular video; publish the vertical file to Instagram in a separate run) ·
`--video-no` (otherwise read from `ear-challenge-NN` in the file name) · `--category` (YouTube, default 10 Music).

- **YouTube** uploads as **private**: Google forces that for API projects that have not passed its audit, so you press Publish in Studio (the command prints the Studio link). The description gets `#Shorts`, the hashtags and a tracking link `earwarrior.app/?utm_source=youtube&utm_campaign=ear31&utm_content=desc`, which the landing page turns into the signup source `youtube:ear31:desc`.
- **Instagram** publishes a **public** Reel. Its API only takes a public `video_url` (resumable upload is rejected — verified live), so the file is parked in a Vercel Blob store for the minutes Meta needs, then deleted. The caption has no link (not clickable); the link stays in the bio.
- Each success is appended to `docs/published.json` (file, experiment number, platform, post id, link, visibility, title, time — no secrets). A file already recorded for a platform is refused unless `--force`.
- One platform failing does not stop the other; the exit status is 1 if anything failed.

Credentials (one-time): `npm run yt:auth -- --upload` writes `YT_UPLOAD_REFRESH_TOKEN` (consent for the upload permission only).
For Instagram add `instagram_business_content_publish` to the Meta app (Use cases → Permissions and features), generate a
token again (API setup with Instagram login → Generate token) and put it in `.env` as `IG_PUBLISH_TOKEN`. Create a Vercel Blob store
(`vercel blob create-store ear-warrior-publish`) and keep its read-write token in `.env` as `BLOB_READ_WRITE_TOKEN` (local only).
Spec: `specs/007-video-publishing/`.

## Deploy to Vercel (backend + daily collection)

The backend runs on Vercel as one serverless function (`api/index.js` → compiled Fastify app); a daily
Vercel Cron call collects both platforms, and the page's "refresh now" button collects on demand.

```bash
cd server
npx vercel link --yes --project ear-warrior-api      # once (done 2026-10-16; production: https://ear-warrior-api.vercel.app)
npx vercel integration add neon                      # Postgres; you accept the marketplace terms; sets DATABASE_URL
sh scripts/vercel-env.sh                             # pushes ADMIN_PASSWORD, YT_*, IG_ACCESS_TOKEN, CRON_SECRET… (DRY_RUN=1 to preview;
                                                     # VERCEL_BIN=/path/to/vercel avoids a slow or broken `npx` cache)
npx vercel deploy --prod
```

Notes: Hobby plans allow one cron run per day (06:00 UTC, see `vercel.json`); `DB_POOL_MAX=1` and
`DB_PREPARE=false` are set for Neon's pooled connection; the Instagram token is refreshed into the hosted
database, so treat production as the primary and the local database as a dev copy. Changing an env var needs
a redeploy. Check a preview without exposing it: `npx vercel curl /health --deployment <url>`.

> Both collectors are verified against the live APIs (2026-10-16). If an API changes or a permission
> is missing, the status chip on the page shows the platform's exact error text.
