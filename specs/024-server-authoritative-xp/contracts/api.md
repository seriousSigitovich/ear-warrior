# API Contract: spec 024

All learner routes need `Authorization: Bearer <session token>` (an account session or an anonymous one). Errors: `{ ok:false, error }` with 401 `invalid_session`, 400 `bad_request`, 404 `unknown_tune`, 409 `phrase_closed` where noted, 429 `rate_limited`, 502 `store_failed`.

## Auth

### `POST /api/auth/anonymous`
Body `{ device_id }` (`dev_` + 32 hex). Creates (or returns the existing, by device link) an anonymous user and a session.
`200 { ok:true, token }`. One anonymous identity per device id; rate-limited per source.
The app keeps this token apart from the signed-in session's. At `POST /api/auth/verify` / Google exchange, the anonymous user that has had a session on the same device is merged into the account (ledger union by key, checks moved, daily totals summed); response unchanged plus `merged: boolean`.

## Library

### `GET /api/melodies`
Headers: `If-None-Match: <etag>`. `304` when unchanged.
`200 { ok:true, etag, tunes: [{ id, title, level, tempo_bpm, phrases:[noteCount,…], beats:[length,…], moves:{counts,total}, scale, audio_url, audio_sha256, audio_bytes }] }`
`beats` is each note's length in beats (the rhythm the app times a phrase by); `moves` counts the tune's melodic moves by kind (for "practise this kind of jump"). Neither carries a pitch. `answer:[midi,…]` (one per note) is present **only** for tunes of level ≤ 2 (`LOCAL_ANSWER_MAX_LEVEL`): the app grades those itself; every other tune has no `answer`.
Visible tunes only, ordered by level then id. **No `notes`.** `audio_url` is a public Blob URL; the file's SHA-256 equals `audio_sha256`.

## Practice

### `POST /api/progress/phrase`
Body:
```json
{ "check_id": "uuid", "tune_id": "mary", "phrase": 0,
  "played": [64, 62, 60],
  "checked_at": "2026-11-16T10:00:00.000Z", "local_day": "2026-11-16" }
```
Idempotent on `check_id` (same body → same response, nothing recorded twice). `phrase` must exist; `played` 0–64 midi values 28–88.
`200`:
```json
{ "ok": true,
  "grade": { "accuracy": 92, "passed": true, "verdict": "incorrect",
             "note_results": [ { "status":"matched","target_index":0,"expected_midi":64,"detected_midi":64 } ] },
  "payout": { "paid": true, "xp": 14, "base": 15, "level_mult": 1.0, "attempt_no": 1,
              "attempt_factor": 1, "hint_factor": 1, "cap_factor": 1,
              "reason": null },
  "state": { "total_xp": 214,
             "rank": { "id":"apprentice","name":"Apprentice","index":1,"xp_to_next":236,"next_name":"Listener","pct":43 },
             "rank_up": null,
             "streak": { "days": 3, "extended": false },
             "challenges": [ { "id":"melodies-3","progress":2,"target":3,"reward_xp":15,"completed":false } ],
             "challenges_paid": [ { "id":"accuracy-90","reward_xp":20 } ],
             "all_bonus_xp": 0 } }
```
`payout.reason` when `paid` is false: `below_pass` | `already_paid` | `answer_shown`. `rank_up` is `{ "id","name" }` only on the check that crossed a threshold.
Note results never include notes the learner did not already play, except `expected_midi` for matched/wrong notes at positions the learner reached (it reveals only what was played against).

### `POST /api/phrase/hint`
Body `{ tune_id, phrase }` → `200 { ok:true, first_midi }`. Records a hint event for the phrase (once); once the phrase has passed it is answered the same but nothing is recorded.

### `POST /api/phrase/answer`
Body `{ tune_id, phrase }` → `200 { ok:true, notes:[midi,…] }`. Records an answer-shown event; the phrase will pay 0 if passed afterwards. After the phrase is paid it is returned freely (no event).

### `GET /api/progress/state`
`200 { ok:true, total_xp, rank, streak, active_days:["YYYY-MM-DD",…] (last fortnight), challenges, daily_bonus_xp, ranks:[{id,name,xp}], phrases: { "<tune>": [ "passed" | "open", … ] } }`. `rank.next` is `{id,name,xp}`. The same `rank`, `streak`, `active_days`, `challenges`, `daily_bonus_xp` ride in the `state` of a phrase check (without `ranks`/`phrases`). Used on launch and after sync; the only source of what the Home/Progress/Journey screens show.

### `POST /api/progress/legacy-import` (one-time, see research D10)
Body `{ phrases: [ { tune_id, phrase, accuracy, at } ] }` ≤ 500. Accepted once per identity (a zero-XP ledger row `legacy-import:done` on the sentinel day 1970-01-01 marks it) and before `LEGACY_IMPORT_UNTIL` (default 2026-12-31). `200 { ok:true, imported, total_xp }`; a second call `409 already_imported`; after the cutoff `410`.

## Retired

### `POST /api/progress/gamification`
Accepted but ignored for rank until adoption (rollout step 5), then `410 { ok:false, error:"gone" }`.
`GET /api/progress/gamification` — replaced by `/api/progress/state`.

## Admin (admin token, same guard as `/admin/challenges`)

- `GET /admin/tunes` — HTML page: list, edit fields, upload audio, hide/show, validation messages.
- `GET /admin/tunes.json` — list with answers (admin only).
- `POST /admin/tunes/:id` — create/update fields (validated per data-model); `422` with the failing rule.
- `PUT /admin/tunes/:id/audio` — raw m4a body; the server checks it is an m4a, stores it in Blob, records URL, bytes and SHA-256 (computed from the bytes). The tune stays as hidden or shown as it was; `?show=1` shows it.
- `POST /admin/tunes/:id/hide` / `/show`; `DELETE /admin/tunes/:id` (ledger rows of removed tunes are kept).
- `POST /admin/recompute?dry_run=1` — runs the migration (research D10) and returns counts / per-rank changes without writing when `dry_run`.
