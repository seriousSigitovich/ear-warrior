# Research: Server-Authoritative XP, Ranks and Melody Library

Facts below were read from the code on 2026-11-16 (branch point `fd4d58a`).

## Current state

- Client decides everything: `src/lib/gamification.ts` (rules), `src/config/gamification.ts` (numbers), `src/services/gamification/service.ts` (awards, mastery, challenges), pushed to the server as opaque rows (`POST /api/progress/gamification`, validated by shape only).
- Rank today = XP **and** mastered levels (`rankProgress`). Mastery: ≥10 completions, average of last 5 ≥ 85 %, ≥ 3 without hints.
- XP is already paid once per phrase (`phrase:<melodyId>:<phrase>`), 10/+5/+5 at 80/90/100 %, regardless of level.
- Library: 100 tunes, 436 phrases (`%%phrases` in `library.abc`), 9 levels, notes inside the client bundle; 101 clips in `assets/app/audio/melodies/` = 26 MB (~260 KB each, m4a).
- Grading is on the client: `gradeAttempt` (edit-distance alignment on midi lists; fretboard taps → `DetectedNote` with clarity 1).
- The server has accounts (email code / Google), sessions, `device_links`, `progress_attempts` (with per-note results), `progress_game_rows`, daily challenges as a pure function of the date, and `@vercel/blob`.
- Anonymous learners have no server identity today (optional auth, `android-release-decisions`).

## Decisions

### D1. Grading moves to the server; the app never holds answers

- **Decision**: the server holds answer notes and grades with a copy of the alignment grader (midi list in, per-note results out). The app sends `played: number[]` (midi in tap order) and gets `note_results` back for its feedback colouring.
- **Rationale**: a dumb client cannot be trusted with the answer (it would let a modified app send a perfect phrase). `tapsToDetected` only adds timing and clarity 1, which grading ignores for verdict, so midi order is enough.
- **Alternatives**: client grades and signs the result (no secret to sign with); share code from `src/` (separate packages, deployed separately) — rejected, a copy with a shared fixture test is simpler.
- **Consequence**: per-note feedback needs a round trip; offline Check cannot be graded locally (see D8).

### D1a. Levels 1–2 are graded on the device as well (owner, 2026-11-16)

- **Decision**: the tunes of levels up to `LOCAL_ANSWER_MAX_LEVEL = 2` ship in the app with their clip **and their answer**; the catalog carries `answer` for exactly those tunes. For them the app grades locally (instant, offline) and also sends the same check to the server, whose payout arrives afterwards (`grader.onReward`). Levels 3–9 stay server-only.
- **Rationale**: a new learner must play at once, with no network and no download. XP stays authoritative — the server re-grades every check. What is given up is that the L1–2 answers can be read from the app; `config.test.ts` asserts all the XP those levels can pay (1 800) is below the Musician threshold (2 000), so reading them cannot buy a rank beyond Listener.
- **Cost**: for these tunes the app serves the hint and the answer itself and tells the server in the background (it halves or voids the payout); offline, that help is recorded late or not at all. Accepted for levels 1–2.

### D2. Hints and "show answer" are server events

- **Decision**: `POST /api/phrase/hint` returns only the first note's midi and records a hint event for (account, tune, phrase); `POST /api/phrase/answer` returns the phrase's midi list and records answer-shown. A later check reads those events when paying.
- **Rationale**: if the client reported "hints used" it could report zero. The server must know because it is the one that revealed the information.
- **Rule**: events before the first passing check apply to its payout; events after it change nothing (the phrase is already paid).

### D3. Attempt counting and "pays once"

- **Decision**: each check is a row in `phrase_checks` (idempotent by client `check_id`). Attempt number = count of earlier checks of that phrase by the account + 1. The phrase pays on the first check with accuracy ≥ pass mark; the payout uses that check's attempt number (1 → ×1, 2 → ×0.5, ≥3 → ×0), then the phrase is closed (`passed`). Failed checks pay nothing.
- **Rationale**: matches the spec; closing the phrase after the first pass makes "pays once ever" structural, enforced by a unique key on the ledger (`account, 'phrase', tune, phrase`).
- **Alternative**: pay the best attempt — rejected: allows farming by deliberately failing first.

### D4. XP formula and daily cap

`xp = round(base(accuracy) × levelMult × attemptFactor × hintFactor × capFactor)` with:
`base = 10 + 5·[acc ≥ 90] + 5·[acc ≥ 100]`; `levelMult = [1, 1.5, 2, 3, 4, 6, 8, 11, 15]`; attempt `[1, 0.5, 0]`; hint `0.5` (first-note) or `0` (answer shown).
**Daily cap** is counted in *base XP* (before `levelMult`), default **300 per local day**, because a cap in final XP would punish hard levels (one L9 phrase pays ≈ 225–300 XP). Base XP above the cap is paid at ×0.5 (the part below the cap in full). The local day is the day the device reports for the check, bounded to within ±1 day of server time (a device cannot invent a fresh day to dodge the cap); recorded in `daily_xp(account, day, base_xp)`.

### D5. Rank thresholds from the library

Per-level XP potential (perfect, 20 base per phrase × multiplier), computed from the library:

| Level | Phrases | Max XP | Cumulative |
|---|---:|---:|---:|
| L1 | 30 | 600 | 600 |
| L2 | 40 | 1 200 | 1 800 |
| L3 | 46 | 1 840 | 3 640 |
| L4 | 52 | 3 120 | 6 760 |
| L5 | 49 | 3 920 | 10 680 |
| L6 | 53 | 6 360 | 17 040 |
| L7 | 53 | 8 480 | 25 520 |
| L8 | 42 | 9 240 | 34 760 |
| L9 | 71 | 21 300 | 56 060 |

Rule: each rank's threshold sits just above the cumulative maximum of the levels two below its target, so each rank needs real work one level higher than the last, and no rank can be bought on the easy levels.

| Rank | Threshold | Why it needs this level |
|---|---:|---|
| Beginner | 0 | |
| Apprentice | 100 | ~10 L1 phrases |
| Listener | 450 | most of L1 (max 600) |
| Musician | 2 000 | above all of L1+L2 (1 800) → L3 |
| Virtuoso | 5 000 | above L1–L3 (3 640) → L4 |
| Maestro | 12 000 | above L1–L5 (10 680) → L6 |
| Mozart | 32 000 | above L1–L7 (25 520) → L8–L9 |

SC-002 holds: L1–L5 at full value is 10 680 < 12 000 (Maestro). **These numbers are a proposal for the owner's approval (FR-014)**; they live in `game/config.ts` and a unit test recomputes the library potential and asserts the property, so a library change that breaks it fails the build.

### D6. Library on the server; audio in Blob

- **Decision**: table `tunes` (+ `audio_url`, `audio_sha256`, `audio_bytes`, `hidden`), seeded from `library.abc` by `seed.ts`; clips uploaded by `server/scripts/upload-tunes.ts` and, later, replaceable from `/admin/tunes`. `GET /api/melodies` returns the catalog without notes; ETag = catalog version hash.
- **Rationale**: Postgres rows for metadata/answers (small, transactional); Blob for files (keeps DB and backups small, direct CDN URL; `@vercel/blob` is already a dependency). Content hash gives cache invalidation.
- **Alternatives**: audio in Postgres bytea (bloats DB), keep clips in the bundle (defeats the goal).

### D7. Client audio cache

- **Decision**: cache directory under the app's document directory, one file per tune named `<id>.<sha8>.m4a`; the catalog entry decides: file with matching hash → play from disk; otherwise download to a temp name, verify size, rename. Prefetch current level + next after the catalog refresh, sequentially, pausing when the app is backgrounded; delete files whose id/hash is not in the catalog. Bundled fallback: 5 L1 clips (hotcrossbuns, mary, frere, london, michael); their bundled hash is compared like any other so a server replacement wins.
- **Rationale**: pure decision function (`needsDownload`, `staleFiles`) is testable in the ts-jest runner; file IO sits behind the existing injected-service pattern of `AudioPlayback`.

### D8. Offline and the dumb client

- **Decision**: the device queues `phrase checks` (taps + `check_id` + local time/day) in the key-value store and flushes them in order, like the existing progress outbox. While offline the Check button shows the phrase as "Waiting for connection" (no per-note colouring) and total XP shows the last known value with "+ pending". The learner cannot advance past an unchecked phrase.
- **Rationale**: the app cannot grade without answers (D1). This is the owner-accepted cost of a server-authoritative design; offline listening and tapping still work.
- **Risk flagged**: offline practice is weaker than today. Bundled L1 clips plus queueing keep the first-run offline case alive.

### D9. Anonymous identity and merge

- **Decision**: `POST /api/auth/anonymous` with the device id creates a `users` row with `anonymous = true` (email NULL) and a session token the app stores (the same token slot the signed-in session uses). At sign-in, `signIn` finds the anonymous user linked to the device and **merges** its ledger and checks into the account in one transaction: ledger rows with the same key are dropped from the anonymous side (the phrase counts once), `phrase_checks` are moved, the anonymous user is deleted, daily totals are summed per day.
- **Rationale**: `device_links` already ties a device to a user; the merge only needs the anonymous row to follow it. Rate limit: one anonymous identity per device id, and per-source limits like the sign-in code route.
- **Alternatives**: require sign-in (rejected by the owner), device-keyed ledger without users (harder merge).

### D10. Migration of existing XP

- **Accounts with stored attempts**: `recompute.ts` replays each account's `progress_attempts` (fretboard, non-timed) in order; the first-try accuracy of each phrase comes from the stored `note_results` split by the tune's phrase lengths (the same method the app's backfill uses today). Payout = new base × level multiplier, attempt factor 1, hint factor 1 (hints were not recorded), daily cap applied by day. Idempotent: ledger rows are keyed, so a re-run inserts nothing.
- **Anonymous devices with local XP only**: their attempts exist only on the device. One-time `POST /api/progress/legacy-import` accepts the device's stored first-try phrase accuracies (not XP amounts), payable once per phrase at attempt factor 1, subject to the same cap and the same unique keys; accepted only for an identity with an empty ledger, only before a cutoff date. The server computes the XP; the client supplies history it already had.
- **Risk**: legacy import is a window in which accuracies are client-claimed. Mitigation: bounded by one use per identity, the library's total potential, and a cutoff; owner can drop the endpoint if the beta population is small enough to skip it (open decision, default **keep**).

### D11. Challenges and streak

Challenge definitions stay as the pure function of the date (spec 018/020 overrides stay). Progress is evaluated from the day's accepted phrases/completions: a "melody completed" means all phrases of a tune passed on that local day; "accuracy ≥ N" means a completed tune whose mean first-try accuracy ≥ N. Rewards go to `xp_ledger` (`kind` challenge / daily-all), unique per (account, day, challenge id). Streak = consecutive local days with any ledger row.

### D12. Retiring the old path

`POST /api/progress/gamification` keeps accepting (for installed apps) but its rows are never read for rank. After the new app is adopted it returns 410. `GET /api/progress/gamification` is replaced by `GET /api/progress/state`. Mastery rows are ignored and dropped.

## Open questions (none blocking)

- Daily cap value (300 base) and thresholds — owner approval, tunable in `game/config.ts`.
- Keep the legacy import (D10)? Default keep; confirm with the owner after seeing the number of anonymous devices that have local XP.
