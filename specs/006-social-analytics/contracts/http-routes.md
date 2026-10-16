# Contract: HTTP routes

Both routes live in `server/src/routes/social.ts`. Auth is HTTP Basic: user `ADMIN_USER` (default `admin`), password `ADMIN_PASSWORD`, compared in constant time.

## GET /admin/social
Query (all optional, invalid values fall back to defaults): `days` ∈ {7, 28, 90} (default 7), `platform` ∈ {youtube, instagram}, `sort` ∈ {gain, views, date} (default gain).

| Condition | Response |
|---|---|
| `ADMIN_PASSWORD` unset | `404 {"ok":false,"error":"not_found"}` |
| missing/wrong credentials | `401`, `WWW-Authenticate: Basic realm="ear-warrior admin"` |
| ok | `200 text/html; charset=utf-8`, `Cache-Control: no-store`, page has `robots: noindex,nofollow` |

Page contract: status chip per platform (*not connected* / *never collected* / *updated … ago* / *failed + message*), one card per platform with data, "what worked" list (posts with known growth > 0, top 5), all posts as collapsible items. Every platform-originating string is HTML-escaped.

## POST /admin/social/collect
Runs every configured collector (same auth rules as above).

| Condition | HTML client (`Accept: text/html`) | Other clients |
|---|---|---|
| a run started < 2 min ago | `303 → /admin/social` (no run) | `429 {"ok":false,"error":"cooldown"}` |
| ran | `303 → /admin/social` | `200 {"ok":bool,"reports":[{platform,status,posts?,error?}]}` |

`status` ∈ `ok | failed | skipped` (`skipped`: not configured, or another run in progress).
The cooldown exists because a browser that cached Basic credentials sends them on cross-site form posts; the endpoint can only refresh data, and at most once per cooldown.

## GET /api/cron/social
Scheduler hook (Vercel Cron, daily; `vercel.json`). Runs the same collectors as the button, without cooldown.

| Condition | Response |
|---|---|
| `CRON_SECRET` unset | `404 {"ok":false,"error":"not_found"}` |
| missing / wrong `Authorization: Bearer <CRON_SECRET>` | `401 {"ok":false,"error":"unauthorized"}` |
| ok | `200 {"ok":bool,"reports":[…]}` as for the manual route |

The admin password and the cron secret are separate credentials; neither opens the other's route.

## CLIs
- `npm run collect` — one pass; prints `platform: status (n posts) — error`; exit code 1 if any configured platform failed.
- `npm run yt:auth` — one-time YouTube authorization; exit code 1 on state mismatch, missing refresh token, timeout (5 min).
