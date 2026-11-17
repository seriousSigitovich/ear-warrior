---

description: "Task list for spec 024 — server-authoritative XP, ranks and melody library"
---

# Tasks: Server-Authoritative XP, Ranks and Melody Library

**Input**: `specs/024-server-authoritative-xp/` — plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: REQUIRED (constitution Principle II): every group starts with failing tests, then the implementation. Server tests run with `cd server && npm test` (Node 24 via nvm); app logic tests with `npm test` at the root (pure `.ts` only).

**Organization**: by user story. US2 (library on the server) is the server-side prerequisite of US1 (grading needs the answers), so its server tasks come first; US1 is the MVP once US2's server half exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no unfinished dependency)

---

## Phase 1: Setup

- [x] T001 Add `server/src/game/` and `server/src/tunes/` directories with empty module stubs and register their test globs in `server/package.json` `test` script (`src/game/*.test.ts src/tunes/*.test.ts`)
- [x] T002 [P] Add the DDL for `tunes`, `phrase_checks`, `phrase_events`, `xp_ledger`, `daily_xp`, and `users.anonymous` + nullable `users.email` in `server/src/db/ddl.ts`, mirrored in `server/src/db/schema.ts` (data-model.md)

---

## Phase 2: Foundational (pure rules; block every story)

- [x] T003 [P] Write failing tests for the reward configuration invariants in `server/src/game/config.test.ts`: multipliers strictly increase and are super-linear (`m[n+1]/m[n]` ≥ ratio of ranks), thresholds strictly increase, and the library-potential property (cumulative perfect XP of levels 1–5 < Maestro threshold; levels 1–7 < Mozart threshold; each rank needs a level above the previous one) computed from the tunes in `src/services/melody/library.ts`
- [x] T004 Implement `server/src/game/config.ts`: `PASS_ACCURACY=80`, base `10/+5/+5`, `LEVEL_MULT=[1,1.5,2,3,4,6,8,11,15]`, `ATTEMPT_FACTOR=[1,0.5,0]`, `HINT_FACTOR=0.5`, `DAILY_CAP_BASE=300`, `CAP_OVERFLOW_FACTOR=0.5`, ranks (names + thresholds `0,100,450,2000,5000,12000,32000`, pending owner approval)
- [x] T005 [P] Write failing grader tests in `server/src/game/grade.test.ts` using a shared fixture file `server/src/game/grade.fixtures.json` (exact, one wrong, one missed, one extra, octave mismatch, empty, longer than target) and a root-level test `tests/unit/graderParity.test.ts` that runs the same fixtures through `src/services/grading/grade.ts` so the two cannot drift
- [x] T006 Implement `server/src/game/grade.ts`: `gradePhrase(answer: number[], played: number[]) → { noteResults, accuracy, passed }` — the same edit-distance alignment as `src/services/grading/grade.ts`, on midi lists; accuracy = matched / answer length, rounded
- [x] T007 [P] Write failing payout tests in `server/src/game/xp.test.ts`: 100/90/80/79 % base amounts; level multiplier L1 vs L9 = 15×; attempt 1/2/3; hint ×0.5; answer shown 0; cap overflow splits a payout (part under the cap full, rest halved); cap counted pre-multiplier; rounding
- [x] T008 Implement `server/src/game/xp.ts`: `payout({accuracy, level, attemptNo, hint, answerShown, baseUsedToday}) → { xp, base, level_mult, attempt_factor, hint_factor, cap_factor, reason }`
- [x] T009 [P] Write failing tests in `server/src/game/rank.test.ts` (threshold edges, top rank, `xp_to_next`, `pct`, rank-up detection between two totals) and implement `server/src/game/rank.ts`

**Checkpoint**: `cd server && npm test` green for `src/game`.

---

## Phase 3: User Story 2 — The server owns the melody library (P1, server half first)

**Goal**: tunes with answers and audio live in Postgres/Blob; catalog without answers; admin page.

**Independent Test**: seed 100 tunes; `GET /api/melodies` lists them with no `notes`; add a tune in `/admin/tunes` and see it in the catalog.

- [x] T010 [P] [US2] Write the tunes store contract tests in `server/src/tunes/store.contract.ts` (+ `memoryStore.test.ts`, `pgStore.test.ts`): upsert, validation (phrases sum = notes, pitch range, level 1–9, audio before visible), hidden tunes excluded from the catalog, catalog version changes when audio hash or level changes, answers never in the catalog shape
- [x] T011 [US2] Implement `server/src/tunes/store.ts` (interface), `memoryStore.ts`, `pgStore.ts` and the validation helper `server/src/tunes/validate.ts`
- [x] T012 [P] [US2] Write failing seed tests `server/src/tunes/seed.test.ts`: all 100 tunes of `src/services/melody/library.ts` load with equal level, tempo, phrases, notes and source; running twice changes nothing
- [x] T013 [US2] Implement `server/src/tunes/seed.ts` (reads the generated library data; copy it into `server/src/tunes/library.data.ts` via a script `server/scripts/export-library.ts` so the server build does not import `src/`)
- [x] T014 [P] [US2] Write failing route tests `server/src/routes/melodies.test.ts`: catalog shape, `ETag`/`304`, hidden excluded, no `notes` anywhere in the JSON (deep scan), 401 not required for the catalog
- [x] T015 [US2] Implement `server/src/routes/melodies.ts` (`GET /api/melodies`) and register it in `server/src/app.ts`
- [x] T016 [P] [US2] Write failing admin tests `server/src/routes/adminTunes.test.ts` (admin guard like `adminChallenges`, create/update validation errors with 422, hide/show, audio upload records url/bytes/sha256 and un-hides) 
- [x] T017 [US2] Implement `server/src/routes/adminTunes.ts` and `server/src/tunes/adminPage.ts` (list, edit form, audio upload via `@vercel/blob`, with an injectable blob uploader for tests)
- [x] T018 [US2] Write `server/scripts/upload-tunes.ts` (`--dry-run`): reads `assets/app/audio/melodies/*.m4a`, computes SHA-256, uploads to Blob, upserts the `tunes` rows and un-hides them; document the command in `server/README.md`

**Checkpoint**: quickstart §2 passes against a local Postgres.

---

## Phase 4: User Story 1 — XP alone sets the rank, hard to cheat (P1) 🎯 MVP

**Goal**: the server grades a phrase, pays XP by the rules, keeps the ledger, derives the rank; the old reward path is ignored.

**Independent Test**: quickstart §3–§4 table.

- [x] T019 [P] [US1] Write the ledger store contract tests in `server/src/progress/ledger.contract.ts` (+ memory/pg runners): `recordCheck` idempotent on `check_id`; attempt number counts earlier checks; the paying check inserts exactly one ledger row (unique key) and later checks pay 0; hint/answer events recorded once; `daily_xp` accumulates per local day; `totals()` sums the ledger; two concurrent checks of one phrase pay once
- [x] T020 [US1] Implement `server/src/progress/ledger.ts` (interface), `ledgerMemoryStore.ts`, `ledgerPgStore.ts` — one atomic `recordCheck` that, in one transaction, reads events and earlier checks, computes the payout through `game/xp.ts` and writes check + ledger + daily row
- [x] T021 [P] [US1] Write failing route tests `server/src/routes/phrase.test.ts`: `POST /api/progress/phrase` full response shape (contracts/api.md), replay with the same `check_id` returns the identical body, a second phrase attempt pays 50 %, third 0 but `passed`, below 80 % pays nothing and stays open, hint then pass halves, answer then pass pays 0, L9 vs L1, daily cap overflow, bad `played` values 400, unknown tune/phrase 404, `local_day` outside ±1 day clamped to server day, 401 without session; `POST /api/phrase/hint` and `/answer` bodies and event recording; `GET /api/progress/state`
- [x] T022 [US1] Implement `server/src/routes/phrase.ts` (`POST /api/progress/phrase`, `POST /api/phrase/hint`, `POST /api/phrase/answer`, `GET /api/progress/state`) wiring tunes store + ledger + `game/*`; register in `server/src/app.ts`
- [x] T023 [P] [US1] Write failing forgery/regression tests `server/src/routes/progress.test.ts` (extend): a forged `award` row via `POST /api/progress/gamification` is accepted-but-ignored (total XP and rank unchanged); after `GAMIFICATION_GONE=1` it answers 410
- [x] T024 [US1] In `server/src/routes/progress.ts` stop reading game rows for any total; keep accepting them until the cutover flag; add the 410 switch; replace `GET /api/progress/gamification` with a redirect-free 410 and document in the file header
- [x] T025 [P] [US1] Write failing tests `server/src/challenges/evaluate.test.ts`: challenge progress and the all-done bonus computed from a day's accepted phrases (tune completed = all its phrases passed that day; accuracy goal = completed tune mean first-try accuracy), rewards paid once per (account, day, challenge)
- [x] T026 [US1] Implement `server/src/challenges/evaluate.ts` and call it from `recordCheck`'s transaction result in `server/src/routes/phrase.ts`; streak from ledger days in `server/src/game/streak.ts` (+ test `streak.test.ts`) — covers US5 on the server side
- [x] T027 [US1] Remove mastery everywhere on the server: stop returning mastery from any route, delete the `mastery`/`completion` kinds from `GameRowInput` handling once nothing reads them (`server/src/progress/store.ts`, `memoryStore.ts`, `pgStore.ts`, tests updated)
- [x] T028 [US1] Client: add `src/services/progress/phraseClient.ts` (typed calls for check/hint/answer/state, no logic) with `src/services/progress/phraseClient.test.ts` for response mapping and error mapping (401, 429, network)
- [x] T029 [US1] Client: rewrite `src/features/practice/usePracticeLoop.ts` so grading, hint and answer come from the server: `check()` sends the taps and renders the returned `note_results`; hint calls `/api/phrase/hint`; "show answer" calls `/api/phrase/answer`; keep draft mode (spec 008) local
- [x] T030 [US1] Client: replace the reward display layer — `src/services/gamification/` becomes a thin `gamificationState.ts` (holds the last `state` from the server, no rules), update `src/components/progress/RankCard.tsx`, `src/components/gamification/RankUpModal.tsx`, `src/components/feedback/TuneComplete.tsx`, `RankChangeBanner.tsx`, Home chips (spec 023) to read it; rank copy shows XP to the next rank only
- [x] T031 [US1] Client: delete `src/lib/gamification.ts`, `src/config/gamification.ts`, mastery/completion/XP-award logic in `src/services/gamification/service.ts` and `sync.ts`, their tests, and every import; `grep -ri mastery src` must find nothing (copy in `src/lib/levelLabels.ts`, `hints.ts`, screens updated)

**Checkpoint**: quickstart §3–§4 green; app shows server XP and rank; no client reward logic remains.

---

## Phase 5: User Story 3 — Audio downloaded and cached on the device (P2)

**Goal**: clips come from the server, cached by hash; 5 L1 clips stay bundled.

**Independent Test**: quickstart §6 audio bullets.

- [x] T032 [P] [US3] Write failing tests `src/services/tunes/cachePlan.test.ts` for the pure decisions: `needsDownload(entry, cachedFiles)`, `staleFiles(catalog, cachedFiles)`, `prefetchOrder(catalog, currentLevel)` (current then next level, bundled skipped when hash matches), partial download not marked cached
- [x] T033 [US3] Implement `src/services/tunes/cachePlan.ts` (pure) and `src/services/tunes/catalog.ts` (fetch with ETag, snapshot in the key-value store for offline start, types without `notes`)
- [x] T034 [US3] Implement `src/services/tunes/audioCache.ts` over an injected file service (expo-file-system adapter in `src/services/tunes/fileSystem.ts`): download to temp, verify bytes, rename to `<id>.<sha8>.m4a`, delete stale; background prefetch queue that pauses when the app is backgrounded
- [x] T035 [US3] Replace the bundled-library lookups: `src/services/melody/catalog.ts`, `curated.ts`, `library.ts` use the server catalog (phrases, level, tempo, title); keep the 5 bundled L1 entries as the offline fallback in `src/services/audio/bundled.ts` (regenerate with the 5 clips only; update `assets/guitar-rig/render_library.py` output list and `scripts/build-library.ts`)
- [x] T036 [US3] `src/services/audio/playback.ts`: resolve a clip id to a cached file URI (bundled fallback), "needs a connection" error text for an uncached tune while offline (actionable copy per constitution III)
- [x] T037 [US3] Bundle only 5 level-1 clips + the first melody's opening (Metro bundles what `src/services/audio/bundled.ts` requires: 6 clips, about 1 MB instead of 26 MB). The 100 rendered files stay in `assets/app/audio/melodies/` as the source for `server/scripts/upload-tunes.ts`; they are not bundled.

---

## Phase 6: User Story 4 — Offline queue and migration (P2)

**Goal**: offline checks queue and flush in order; existing XP recomputed; anonymous identity merges.

**Independent Test**: quickstart §5 and §6 offline bullet.

- [x] T038 [P] [US4] Write failing tests `src/services/progress/checkQueue.test.ts`: durable order, flush in order, retry after failure, drop on `404 unknown_tune`, idempotent resend by `check_id`, never loses an item when the app dies between send and ack
- [x] T039 [US4] Implement `src/services/progress/checkQueue.ts` (key-value store, same pattern as `outbox.ts`) and wire the practice loop's "Waiting for connection" state and "+ pending" XP in `src/features/practice/usePracticeLoop.ts` and the Home/Progress chips
- [x] T040 [P] [US4] Write failing store tests for anonymous identity and merge in `server/src/auth/store.contract.ts` (extend): create anonymous user once per device, `signIn` merges ledger by key, moves checks, sums `daily_xp`, deletes the anonymous user, is atomic; route tests in `server/src/routes/auth.test.ts` for `POST /api/auth/anonymous` (rate limit, idempotent) and `merged` in verify/Google exchange responses
- [x] T041 [US4] Implement `POST /api/auth/anonymous` in `server/src/routes/auth.ts`, the merge in `server/src/auth/pgStore.ts` / `memoryStore.ts` `signIn`, and the app side in `src/services/auth/client.ts` + `src/features/auth/authService.ts` (create the identity at first launch when there is no session; the token slot is shared with the signed-in session)
- [x] T042 [P] [US4] Write failing tests `server/src/progress/recompute.test.ts`: replays stored attempts per account, first-try accuracy per phrase from `note_results` split by phrase lengths, payout with attempt factor 1, daily cap by day, idempotent second run inserts 0, dry-run writes nothing and reports per-rank before/after
- [ ] T043 [US4] (code done; the owner's dry-run report on production data pending) Implement `server/src/progress/recompute.ts` and `POST /admin/recompute?dry_run=1` in `server/src/routes/adminTunes.ts` (or `adminRecompute.ts`); run it dry against a copy of production data and put the per-rank table in `specs/024-server-authoritative-xp/migration-report.md` for the owner
- [x] T044 [P] [US4] Write failing tests for `POST /api/progress/legacy-import` in `server/src/routes/phrase.test.ts` (empty ledger only, ≤ 500 rows, cutoff, once, cap and unique keys honoured, accuracy clamped 0–100) and implement it in `server/src/routes/phrase.ts`; client one-shot sender `src/services/progress/legacyImport.ts` reading the device's stored attempts (+ test)
- [x] T045 [US4] (amended: the old SQLite XP tables are no longer created and nothing reads them; they are not dropped on existing installs; there is no one-time rank note) First launch of the new app: after `GET /api/progress/state` succeeds, drop the SQLite XP tables and show the one-time "your rank was recalculated" note when the rank changed (`src/services/storage/db.ts`, Home)

---

## Phase 7: Polish & cross-cutting

- [x] T046 [P] Update `specs/013-gamification/spec.md` (status note: superseded in part by 024: mastery removed, server authority), `specs/019-progress-sync/spec.md`, `specs/018-backend-challenges/spec.md`, `specs/020-admin-challenges/spec.md` with one-line amendments and links
- [x] T047 [P] Update `server/README.md` (new routes, tables, upload script, env) and `docs/` entries for the XP rules and thresholds
- [ ] T048 Owner review gate: show the thresholds, multipliers, cap and the migration report (T043) and apply any changes in `server/src/game/config.ts` (tests from T003 must stay green)
- [x] T049 Full run (server 522, app 655, lint clean, app typecheck clean except one older unrelated error; NOT run on a device): `cd server && npm test`, root `npm test`, `npm run lint`, server typecheck; app typecheck status noted (pre-broken by expo per memory); run quickstart §1–§6 and record results in the Status of spec.md
- [ ] T050 Rollout checklist in `specs/024-server-authoritative-xp/rollout.md`: deploy server → seed/upload → recompute dry-run → owner approval → store build (bundle shrink) → monitor → set `GAMIFICATION_GONE=1`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 (US2 server) → Phase 4 (US1) → Phases 5 (US3) and 6 (US4) in parallel → Phase 7.
- Within Phase 4, server tasks T019–T027 precede client tasks T028–T031; T028 can start once `contracts/api.md` is fixed.
- T035 needs T033; T037 needs T034–T036 verified on a device.
- T041 (merge) needs the ledger from T020; T043 needs T020 and T013.

### Parallel opportunities

- T003, T005, T007, T009 (different test files) together; T010, T012, T014, T016 together; T019, T021, T023, T025 together; T032, T038, T040, T042, T044 together.

## Implementation Strategy

- **MVP = Phases 1–4**: the server owns tunes, grading, XP, rank and challenges; the app displays them (audio still bundled in the app until Phase 5, so nothing regresses).
- Then Phase 5 (audio cache, bundle shrink), Phase 6 (offline queue, merge, migration), Phase 7.
- Rollout order and the store build are in T050; the server must ship before the app (additive, old app keeps working).
