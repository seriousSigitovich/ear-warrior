# Data Model: Social Analytics

Source of truth: `server/src/db/ddl.ts` (idempotent) mirrored by `server/src/db/schema.ts`.

## social_posts — one row per published post
| Column | Type | Notes |
|---|---|---|
| platform | text | `youtube` \| `instagram` — PK part |
| external_id | text | platform's id — PK part |
| title | text | YouTube title / first line of the Instagram caption (≤ 200) |
| url | text | link to the original |
| kind | text | `short` \| `video` (YouTube, ≤ 180 s = short), `reel` \| `post` (Instagram) |
| duration_s | int null | YouTube only |
| published_at | timestamptz | drives the "born inside the window" rule |
| video_no | int null | experiment number parsed from title/caption (`EAR CHALLENGE #N`, `ear-challenge-N`, `#N`) |
| first_seen_at | timestamptz | |

## social_snapshots — a post's cumulative metrics on one UTC day
PK `(platform, external_id, day)`, FK → `social_posts` (cascade). `day` is a UTC `date`.
Metrics, all **nullable** (`NULL` = platform does not report, never 0): `views, likes, comments, shares, saves, reach, avg_watch_s (real), avg_watch_pct (real), follows, profile_visits`; plus `collected_at`.
A second collection on the same day **overwrites** that day's row.

## social_account_snapshots — account level per UTC day
PK `(platform, day)`: `followers` (nullable), `extra` jsonb (`profile_views_28d`, `website_clicks_28d`, `reach_28d` on Instagram), `collected_at`.

## social_tokens — rotating credentials
PK `platform`: `value`, `expires_at` (nullable), `updated_at`. Only Instagram uses it today.

## social_runs — collector run log
`id` bigserial, `platform`, `started_at`, `finished_at`, `ok`, `posts`, `error` (≤ 500 chars, token-scrubbed). A row is created only for **configured** platforms. The page reads the latest *finished* run per platform; `started_at` of the latest run of any platform drives the 2-minute manual cooldown.

## Derived rules (implemented in `summary.ts`)
- **windowGain(series, publishedDay, startDay, endDay)** — end = last snapshot ≤ endDay; base = last snapshot ≤ startDay; if no base: `0` when the post was published after `startDay`, else **unknown**; if no end: `0` when published after `endDay`, else unknown; result clamped ≥ 0.
- **Platform gain** = sum over posts, **unknown if any post is unknown**; previous-window gain computed the same way; the percentage change is shown only when both are known and the previous is > 0.
- **Followers delta** = latest − last snapshot ≤ window start; unknown without a baseline.
- **Sorting** — growth: known first (desc), unknown last by lifetime views; views; date.

## State transitions
Post: *new* (first seen, one snapshot) → *tracked* (daily snapshots) → *stale* (platform stops returning it; history kept). Platform status on the page: *not connected* (no env) → *never collected* → *ok* / *failed* (latest finished run).
