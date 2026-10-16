# Research: Social Analytics Dashboard

Decisions as taken between 2026-10-16 (build session). Format: Decision / Rationale / Alternatives.

## R1. Own collector + own page
- **Decision**: build a collector and a page inside `server/`.
- **Rationale**: the owner wants the numbers beside the app's own data (signups, later attempts) and tied to `docs/experiments.md`; the app's backend already exists; the learning goal (product-engineer loop) favours owning the pipeline.
- **Alternatives**: SaaS (Metricool/Buffer/Later) — fastest but metrics are theirs and cannot be joined; Looker Studio + paid Instagram connector — ~$20–50/mo and still no join; Sheets + Apps Script/n8n — free but a spreadsheet becomes a fragile database.

## R2. Daily snapshots of cumulative counters (no backfill)
- **Decision**: store one snapshot per post per UTC day; growth = difference of snapshots; unknown when no baseline.
- **Rationale**: platforms expose cumulative totals; Instagram offers no per-post history at all; a single mechanism works for both. Honest "unknown" beats fabricated numbers (spec FR-005).
- **Alternatives**: YouTube Analytics `day` dimension could backfill history for YouTube only — rejected for v1 (two mechanisms, Instagram still has none); storing only latest values — loses all trend.

## R3. YouTube: Data API for counters + Analytics API for watch behaviour
- **Decision**: Data API v3 (`channels`, `playlistItems`, `videos`) for list, views, likes, comments, duration; Analytics API (lifetime, `dimensions=video`, top 200) for average view duration/percentage, shares, subscribers gained.
- **Rationale**: Data API counters are near-real-time, Analytics lags ~2 days; each fills what the other lacks. Analytics failure is non-fatal (public counters are still stored).
- **Not available**: Studio's "viewed vs swiped away" — not in the API; stays manual.

## R4. Instagram: "Instagram API with Instagram Login" (graph.instagram.com)
- **Decision**: use the Instagram-Login flavour of the Graph API with a long-lived token.
- **Rationale**: works for a Business/Creator account without a Facebook Page; insights per media (`views, reach, saved, shares, ig_reels_avg_watch_time, follows, profile_visits`) and account insights over 28 days.
- **Verified live 2026-10-16.** Meta rejects a whole insights call if one metric is invalid for that media, hence the per-metric fallback (see contracts). The live probe showed `follows`, `profile_visits`, `profile_activity` and `impressions` are not supported for reels (story-only), so the normal request is now `views, reach, saved, shares, ig_reels_avg_watch_time` — one call per post.

## R5. Rotating credential lives in the database
- **Decision**: Instagram's 60-day token is kept in `social_tokens`; `IG_ACCESS_TOKEN` only seeds it; refreshed when < 20 days remain or expiry unknown.
- **Rationale**: a value that changes over time cannot be an env var without a redeploy.
- **Alternatives**: manual re-issue every 60 days — a silent outage by design.

## R6. YouTube authorization via a loopback helper, not OAuth Playground
- **Decision**: `npm run yt:auth` starts a localhost listener, opens Google consent, exchanges the code and writes `YT_REFRESH_TOKEN` to `.env` without printing it. Requires `http://localhost:8765/callback` as a redirect URI of the (Web application) client.
- **Rationale**: Playground needs the client id/secret pasted into a web form; the helper keeps secrets out of chat, clipboards and forms.
- **Alternatives**: Desktop-app client type (loopback allowed natively) — equivalent; Playground — more copying.

## R7. Publish the OAuth app to Production
- **Decision**: set the consent screen to "In production" (unverified, own account).
- **Rationale**: in "Testing" a refresh token expires after 7 days, which would break the daily collector weekly.
- **Dependency**: Google requires a home page and a privacy-policy URL → `https://earwarrior.app/privacy/` (landing `10d5cd3`); authorised domain `earwarrior.app`.
- **Trade-off**: unverified app shows a one-time warning and is capped at 100 users — irrelevant for one owner.

## R8. Server-rendered HTML, no client JS, Basic auth
- **Decision**: one `renderPage()` string, `<details>` for drill-down, inline SVG for charts, HTTP Basic auth, `noindex`, 404 without `ADMIN_PASSWORD`.
- **Rationale**: no build step, no second deployable, nothing to leak to a CDN; all third-party text escaped in one place.
- **Alternatives**: React/Next admin — a second app for one page; a Vercel page reading the API — needs a read API and public exposure.

## R10. Host the backend on Vercel; collect with Vercel Cron
- **Decision (2026-10-16)**: deploy `server/` as a Vercel serverless function (`api/index.js` hands every request to the compiled Fastify app; `vercel.json` rewrites all paths to it), Postgres from Neon through the Vercel integration, one daily cron call to `GET /api/cron/social` guarded by `CRON_SECRET`; the page's refresh button runs the same collectors on demand (≈ 20 s, inside the 60 s function limit).
- **Rationale**: the owner asked to deploy the backend "if Vercel can do it"; the landing already lives there; no server to keep running; history becomes gap-free without the laptop; the app will need the same backend (`/api/sync`, telemetry).
- **Serverless adjustments**: no in-process timer (cron instead); `DB_POOL_MAX=1` and `DB_PREPARE=false` for the pooled Neon URL; schema bootstrap runs lazily on the first non-`/health` request of an instance and is retried if it failed; framework auto-detection is turned off (`"framework": null`) because Vercel's zero-config Fastify mode expects an app entry in the output directory.
- **Alternatives**: keep it local and press the button (works today, history has gaps); GitHub Actions cron into a hosted DB (no server, but the page still needs a host); a container host (Fly/Railway/Render) with the existing Dockerfile (always-on, paid, nothing the owner asked for).
- **Limits to remember**: Hobby crons run at most once a day at an hour-level precision; each instance holds its own pool; the Instagram token is refreshed into the hosted database (the local database keeps its own copy).

## R9. Pure core, thin edges
- **Decision**: `summary.ts`, `page.ts`, `oauth.ts` are pure; collectors take an injected `fetch`, token store and clock.
- **Rationale**: the rules that decide what the owner believes are testable without network or database (constitution II).
