# Quickstart: validating spec 024 end to end

Prerequisites: Node 24 (`nvm`, see memory `node-version-for-tests`), local Postgres from `server/docker-compose.yml` (or the memory store for route tests), a copy of `server/.env` with a Blob token for the upload step.

## 1. Rules (no IO)

```bash
cd server && npm test
```
Expect green: XP payout table, attempt/hint/cap factors, rank thresholds and the library-potential property (L1–L5 full value < Maestro), grader fixtures, store contracts on memory (and Postgres when reachable).

## 2. Seed the library and audio

```bash
cd server && npx tsx --env-file=.env scripts/upload-tunes.ts --dry-run   # 100 tunes, 100 clips, hashes
npx tsx --env-file=.env scripts/upload-tunes.ts
curl -s localhost:3000/api/melodies | head -c 600   # no "notes" field anywhere
```

## 3. One learner, one phrase

1. `POST /api/auth/anonymous` with a fresh device id → token.
2. `POST /api/progress/phrase` with the correct midi of phrase 0 of `hotcrossbuns` → `payout.xp = 20 × 1` (100 % first try), `state.rank` Beginner/Apprentice per total.
3. Send the same body again → identical response, total XP unchanged (SC-001).
4. Send a different `check_id` for the same phrase → `payout.reason = "already_paid"`, XP unchanged.

## 4. The rules the owner asked for

| Try | Expect |
|---|---|
| Same phrase passed on 1st / 2nd / 3rd attempt (three fresh phrases) | 100 % / 50 % / 0 XP, all three marked passed |
| `POST /api/phrase/hint` then pass | XP halved |
| `POST /api/phrase/answer` then pass | 0 XP |
| Pass an L9 phrase and an L1 phrase identically | L9 pays 15× |
| 300 base XP of phrases in one local day, then one more | the extra pays half |
| Replay all of L1–L5 at 100 % (script) | total below Maestro threshold |
| `POST /api/progress/gamification` with a forged award | ignored; total XP unchanged (410 after cutover) |

## 5. Merge and migration

- Earn XP on an anonymous identity, then sign in with email code on the same device → account total = union, no phrase paid twice (`merged: true`).
- `POST /admin/recompute?dry_run=1` → per-rank change table for the owner; run for real; run again → `inserted: 0`.

## 6. The app

```bash
npx expo start    # dev build
```
- Fresh install, airplane mode: an L1 bundled tune plays; a non-bundled one says it needs a connection.
- Online: open level 1 → melodies download in the background; second play makes no network request.
- Replace one clip in `/admin/tunes` → after the next catalog refresh the app downloads it again and deletes the old file.
- Airplane mode during a phrase: Check shows "Waiting for connection"; reconnect → XP appears, queue empties.
- Rank screens show only "XP to next rank"; no mastery text anywhere (`grep -ri mastery src` finds nothing outside tests/docs).
