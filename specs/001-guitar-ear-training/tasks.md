---

description: "Task list for Guitar Ear Training — Melody Recall & Playback Feedback"
---

# Tasks: Guitar Ear Training — Melody Recall & Playback Feedback

**Input**: Design documents from `/specs/001-guitar-ear-training/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. Per Constitution Principle II (Test-First, NON-NEGOTIABLE) and plan.md, all pure
logic (grading, segmentation, pitch↔note, generator, difficulty, progress) is developed test-first, and
each service boundary in `contracts/` has a contract test against mocked native modules. Native
pitch-detection accuracy and audio fidelity are validated on-device via `quickstart.md`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, and Polish tasks carry no story label)
- File paths follow the single-project mobile layout in plan.md (`app/`, `src/`, `tests/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Expo dev-client project and tooling.

- [X] T001 Initialize Expo + TypeScript app with expo-router at repo root (`package.json`, `tsconfig.json`, `app/`)
- [X] T002 [P] Install runtime deps (`react-native-pitchy`, `expo-audio`, `expo-sqlite`, `@supabase/supabase-js`, `expo-asset`, `expo-file-system`) in `package.json` — note: `@supabase/supabase-js` later **removed** (backend moved to the Node/Postgres server; client uses `fetch`)
- [X] T003 [P] Configure TypeScript `strict` + ESLint + Prettier (`tsconfig.json`, `.eslintrc.js`, `.prettierrc`)
- [X] T004 [P] Configure Jest with `jest-expo` preset + React Native Testing Library (`jest.config.js`, `jest.setup.ts`, `test` script in `package.json`)
- [X] T005 [P] Create `eas.json` with a `development` (dev client) profile and an internal/ad-hoc distribution profile for iOS + Android
- [X] T006 [P] Configure `app.config.ts`: iOS/Android bundle IDs, microphone usage strings (`NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`), plugins, and `EXPO_PUBLIC_SUPABASE_*` env — note: env later **renamed** to `EXPO_PUBLIC_API_URL` (single Node backend base URL)
- [X] T007 Create source-tree scaffolding: `src/{components/{feedback,controls,common},features/{practice,difficulty,progress},services/{audio,melody,grading,storage,logging},models,lib}`, `tests/{unit,contract,fixtures}`, `assets/samples`, `supabase/migrations` — note: `supabase/` **superseded** by `server/` (Fastify + Drizzle + Postgres)

**Checkpoint**: Project builds, lints, and `npm test` runs (0 tests) on a dev client.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, pure math, persistence, permissions, and navigation that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 [P] Define domain types in `src/models/index.ts` (Note, DifficultyLevel, Melody, NoteResult, Attempt, Session, ProgressProfile) per data-model.md
- [X] T009 [P] Write failing unit tests for pitch↔note math (Hz→MIDI, cents deviation, nearest-note within ±50 cents, guitar-range guard) in `tests/unit/lib/pitchNote.test.ts`
- [X] T010 Implement pitch↔note + cents/tolerance helpers in `src/lib/pitchNote.ts` to pass T009
- [X] T011 Initialize `expo-sqlite` database with schema/migration for `sessions` and `attempts` in `src/services/storage/db.ts`
- [X] T012 [P] Implement Session & Attempt repositories (create/read/update; survive app restart per FR-018) in `src/services/storage/repositories.ts`
- [X] T013 [P] Implement anonymous per-install device-id generator (no PII) in `src/lib/deviceId.ts`
- [X] T014 [P] Implement microphone-permission + audio-session helper (playback fully stops before capture, R7) in `src/services/audio/session.ts`
- [X] T015 [P] Create root navigation shell + shared UI primitives/theme in `app/_layout.tsx` and `src/components/common/`
- [X] T016 [P] Seed a default DifficultyLevel (L1) config in `src/services/melody/levels.ts`

**Checkpoint**: Foundation ready — user stories can now begin.

---

## Phase 3: User Story 1 - Listen, Play Back, Get Feedback (Priority: P1) 🎯 MVP

**Goal**: The complete core loop — app plays a generated melody, learner reproduces it on guitar, app
detects the notes, grades them with best-fit alignment (±50-cent match), and shows immediate feedback.

**Independent Test**: Start a session, hear one melody, play it back on a guitar; confirm the app reports
a correct/incorrect verdict identifying matched/wrong/missed/extra notes, and supports replay/retry/next.

### Tests for User Story 1 (REQUIRED per constitution — write FIRST, ensure they FAIL) ⚠️

- [X] T017 [P] [US1] Unit tests for melody generator (length == noteCount; range/scale membership; no consecutive identical pitches per FR-001; deterministic by seed; invalid level throws) in `tests/unit/melody/generator.test.ts`
- [X] T018 [P] [US1] Unit tests for pitch-stream segmentation (pitch-change + silence-gap → note sequence; low-clarity treated as silence) using recorded fixtures in `tests/unit/lib/segment.test.ts` (+ fixtures in `tests/fixtures/`)
- [X] T019 [P] [US1] Table-driven unit tests for grading engine best-fit alignment (exact, one wrong, missed, extra, **mid-phrase insertion/omission must NOT cascade** per FR-005, octave mismatch, ±50-cent boundary, timeout, low-confidence) in `tests/unit/grading/grade.test.ts`
- [X] T020 [P] [US1] Contract test for the pitch-detection wrapper against a mocked `react-native-pitchy` (permission handling, silence/low-clarity pass-through, clean teardown) in `tests/contract/pitch.test.ts`
- [X] T021 [P] [US1] Contract test for audio playback against a mocked `NativePlayer` (expo-audio boundary): correct note per `midi`, notes in order, `playMelody` resolves after last note, idempotent `stop`, in `tests/contract/playback.test.ts`
- [X] T021A [P] [US1] Unit tests for the pure tuning-detection rule (warn when median signed cents offset > threshold across ≥ min-count notes mostly the same direction; no warn on a single sharp/flat note or scattered offsets; thresholds calibratable) per FR-014 in `tests/unit/lib/tuning.test.ts`
- [X] T021B [P] [US1] Unit tests for the pure tone synth + note-range guard (deterministic Karplus–Strong render by seed, canonical 16-bit mono WAV encoding, E2–E6 range guard throws) in `tests/unit/audio/synth.test.ts` and `tests/unit/audio/samples.test.ts`
- [X] T021C [P] [US1] Unit tests for the capture window (FR-015): times out when no voiced frame arrives within `noInputTimeoutMs`; a voiced frame starts the attempt and (re)arms the `endSilenceMs` end-timer; timers cleared on finish — in `tests/unit/practice/capture.test.ts` (regression test for the already-implemented `src/features/practice/capture.ts`; closes analyze finding C1)

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement melody generator (pure) in `src/services/melody/generator.ts` to pass T017
- [X] T023 [P] [US1] Implement pitch-stream segmentation (pure) in `src/lib/segment.ts` to pass T018
- [X] T024 [US1] Implement grading engine with best-fit (edit-distance/LCS) alignment + ±50-cent nearest-note match + octave sensitivity in `src/services/grading/grade.ts` to pass T019 (depends on T010, T023)
- [X] T025 [P] [US1] Implement runtime tone synthesis (Karplus–Strong render → 16-bit mono WAV, pure) in `src/services/audio/synth.ts` and the note-range guard in `src/services/audio/samples.ts` to pass T021B — no bundled samples; supersedes the earlier pre-rendered-asset approach (R6)
- [X] T026 [US1] Implement pitch-detection wrapper over `react-native-pitchy` (1.3.1 event mapping: `confidence`→clarity, `tCaptureMs`→timestamp; mic permission owned by the audio session, not pitchy) in `src/services/audio/pitch.ts` to pass T020 (depends on T014)
- [X] T027 [US1] Implement audio playback (expo-audio synthesized-tone playback via an injected `NativePlayer`, sequenced by `startMs`, + reference tone) in `src/services/audio/playback.ts` to pass T021 (depends on T025)
- [X] T028 [US1] Implement practice-loop state machine (idle→playingMelody→awaitingInput→capturing→grading→feedback; replay/retry/next) in `src/features/practice/usePracticeLoop.ts` (depends on T022, T024, T026, T027)
- [X] T029 [US1] Implement no-input timeout (~8 s) + end-on-silence (~2 s) + low-confidence/polyphony retry handling (FR-015, FR-017) in `src/features/practice/capture.ts` (depends on T028)
- [X] T030 [US1] Implement the **pure** tuning-detection rule (median signed cents offset > threshold across ≥ min-count notes, same direction; calibratable) in `src/lib/tuning.ts` to pass T021A, then wire the reference-tone warning + **advisory (non-blocking)** behavior — learner may dismiss and proceed to grading (FR-014) — in `src/features/practice/tuning.ts` (depends on T021A, T027)
- [X] T031 [P] [US1] Build feedback UI (verdict banner + per-note matched/wrong/missed/extra chips) in `src/components/feedback/`
- [X] T032 [P] [US1] Build transport controls (Play / Replay / Retry / Next + "your turn" cue) in `src/components/controls/`
- [X] T033 [US1] Persist Session + Attempt on each graded attempt (FR-012, FR-018) in `src/features/practice/persist.ts` (depends on T012, T028)
- [X] T034 [US1] Wire the practice screen `app/practice.tsx` to the loop, controls, and feedback (depends on T028–T033)
- [X] T035 [US1] Implement start-session on `app/index.tsx` (create Session, launch practice) (depends on T011, T033)
- [X] T035A [P] [US1] Unit tests for session lifecycle transitions (`active→paused→active→ended`; `ended` terminal; completed attempts persist across pause and app interruption) per FR-018 in `tests/unit/practice/session.test.ts`
- [X] T035B [US1] Implement session pause/resume/end (state transitions + persist `endedAt`; survive interruption, FR-018) in `src/features/practice/session.ts`, and wire pause/end controls into `app/practice.tsx`, to pass T035A (depends on T012, T035)

**Checkpoint**: US1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Adjustable & Adaptive Difficulty (Priority: P2)

**Goal**: Difficulty matches ability — 7 ranks differing in melody length only (`noteCount = rank + 1`,
2→8), auto-adjusting on asymmetric streaks (3 correct → +1, 2 incorrect → −1) or held fixed when the
learner chooses, with mode and both rank values persisted across restarts.

**Independent Test**: Select a fixed rank and confirm every melody has `rank + 1` notes and never moves;
in adaptive mode, confirm 3 correct first attempts raise the rank by one and 2 incorrect first attempts
lower it by one, while retries and low-confidence captures leave it untouched.

**Design refs**: `contracts/difficulty-adaptation.md`, `data-model.md` (DifficultyLevel,
DifficultySettings), spec FR-010/FR-011/FR-011a/FR-011b, research R11/R13.

> **Note on IDs**: T036–T041 were re-scoped after the 2026-07-23 clarifications (the old ladder varied
> range/scale/tempo and had no persistence). T058–T062 are the additional work those decisions introduced;
> they belong to this phase and run in the order listed, not after Phase 6.

### Tests for User Story 2 (REQUIRED per constitution — write FIRST, ensure they FAIL) ⚠️

- [X] T036 [P] [US2] Unit tests for the difficulty reducer in `tests/unit/difficulty/adapt.test.ts` covering the full transition table from `contracts/difficulty-adaptation.md`: `effectiveRank` per mode; 3 consecutive eligible correct → +1 (2 do not); 2 consecutive eligible incorrect → −1 (1 does not); a correct attempt mid-incorrect-streak restarts the count at 1; counter resets after every rank change so a 4th correct does not double-promote; each ineligible outcome (`graded: false`, `isFirstAttemptOnMelody: false`) leaves settings byte-identical; fixed mode never touches `adaptiveRank`; clamping at ranks 1 and 7; `setFixedRank` preserves `adaptiveRank` and the adaptive→fixed→adaptive round-trip restores the effective rank; invalid rank throws
- [X] T037 [P] [US2] Unit tests for the level ladder in `tests/unit/melody/levels.test.ts`: exactly 7 levels with contiguous ranks 1–7; `noteCount === rank + 1` (2→8); `scale`, `rangeLowMidi`, `rangeHighMidi`, and `tempoBpm` identical across every rank; the fixed pool resolves to 8 distinct pitches so the no-consecutive-repeats rule holds at rank 7
- [X] T058 [P] [US2] Contract test for the DifficultySettings repository in `tests/contract/difficultySettings.test.ts`: first launch returns the documented defaults (`adaptive`, both ranks 1, empty streak); a round-trip save/load preserves every field; writing `fixedRank` leaves `adaptiveRank` unchanged on disk (FR-011b)

### Implementation for User Story 2

- [X] T059 [US2] Add the `DifficultySettings` entity to `src/models/index.ts` (mode, adaptiveRank, fixedRank, streakKind, streakCount) per `data-model.md`
- [X] T038 [US2] Replace the seeded single level with the full 7-rank ladder in `src/services/melody/levels.ts` to pass T037 — ranks 1–7, `noteCount = rank + 1`, and the fixed pool `C_major` / MIDI 60–72 / 60 BPM at every rank. **This changes the existing `L1` from `C_major_pentatonic` to `C_major`**; keep `getLevel`/`allLevels` working and add a `getLevelByRank` lookup for the reducer
- [X] T060 [US2] Add the DifficultySettings table + repository (singleton row, defaults on first launch) in `src/services/storage/repositories.ts` and its migration in `src/services/storage/db.ts` to pass T058 (depends on T059)
- [X] T039 [US2] Implement the pure reducer (`effectiveRank`, `applyAttempt`, `setFixedRank`, `setMode`) in `src/features/difficulty/adapt.ts` to pass T036 — no IO, no clock, no randomness (depends on T059)
- [X] T040 [US2] Wire difficulty into `src/features/practice/usePracticeLoop.ts`: load settings on mount, generate from `effectiveRank`, and after each attempt call `applyAttempt` with the correct `AttemptOutcome` — the loop MUST track `isFirstAttemptOnMelody` (false once the learner has retried) and set `graded: false` for timed-out or low-confidence captures, then persist the returned settings (depends on T038, T039, T060, T028)
- [X] T061 [US2] Announce rank changes in the feedback step via a shared component in `src/components/feedback/` (e.g. "Level up — 4 notes"), carrying an accessible label so screen readers report it, so difficulty never shifts silently (Constitution III, SC-009) (depends on T040)
- [X] T041 [US2] Rebuild `app/settings.tsx` against real persisted state: mode toggle and rank picker write through the repository, the ladder shows **7** levels (the current `TOTAL_LEVELS = 6` is wrong), and the current-level card reads the effective level instead of the hardcoded `L1` import (depends on T039, T060). Supersedes T057
- [X] T062 [US2] Replace the hardcoded `L1` import and `Level {L1.rank}` tag in `app/practice.tsx` with the effective rank from the loop, and the fabricated "Level 3 of 6" stat in `app/index.tsx` with the real current rank out of 7 (depends on T040)
- [X] T063 [P] [US2] Update the stale `C_major_pentatonic` fixtures in `tests/unit/melody/generator.test.ts`, `tests/unit/lib/schedule.test.ts`, `tests/contract/logging.test.ts`, and `tests/contract/playback.test.ts` to the shipped `C_major` pool so fixtures match the real ladder (these construct their own level objects, so they pass either way — the risk is silent drift, not a red suite)

**Checkpoint**: US1 and US2 both work independently. Validate with quickstart US2 scenarios 1–8 —
scenario 5 (two low-confidence captures must NOT demote) is the one most likely to fail if `graded` is
threaded incorrectly through T040.

---

## Phase 5: User Story 3 - Progress Tracking Over Time (Priority: P3)

**Goal**: Show accuracy trends, practice volume, and weak areas across sessions; record a per-session
summary.

**Independent Test**: Complete attempts across two sessions, then open the progress view and confirm it
shows accuracy trend, practice volume, and identified weak areas derived from real results.

### Tests for User Story 3 (REQUIRED per constitution — write FIRST, ensure they FAIL) ⚠️

- [X] T042 [P] [US3] Unit tests for progress aggregation (accuracy trend by session, practice volume, weak areas by interval/length) in `tests/unit/progress/aggregate.test.ts`

### Implementation for User Story 3

- [X] T043 [US3] Implement progress aggregation queries over stored attempts in `src/services/storage/progress.ts` (depends on T012) to pass T042
- [X] T044 [US3] Implement progress feature/view logic in `src/features/progress/useProgress.ts` (depends on T043)
- [X] T045 [US3] Record per-session summary (accuracy, attempt count) on session end (FR-012) — **implemented in `useSession`/`lib/sessionState`, not `persist.ts`**: `useSession` writes `attemptCount`/`accuracyPct`/`endedAt` to the Session row on every attempt and on end, so the summary is recorded and viewable. persist.ts deliberately does NOT write the Session summary (documented there) to avoid conflicting tallies. The aggregation (T043) recomputes accuracy from source attempts for robustness rather than trusting the denormalized field.
- [X] T046 [P] [US3] Build progress screen `app/progress.tsx` (accuracy trend, volume, weak areas) (depends on T044)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Anonymous telemetry, accessibility, performance validation, and distribution.

> **Backend migration note (2026-08-15)**: T047–T050 (and T067) originally targeted **Supabase** (anon
> key + insert-only RLS). The remote backend was later replaced by a self-hosted **Node/Postgres server**
> (`server/`, Fastify + Drizzle). The client payload and privacy guarantees are unchanged; the transport
> moved to HTTPS `POST /api/attempts`, the tables now live in `server/src/db/`, `@supabase/supabase-js`
> was removed, and the client env is `EXPO_PUBLIC_API_URL` (was `EXPO_PUBLIC_SUPABASE_*`). A new
> `src/services/sync/` + `POST/GET /api/sync` add durable game-history sync. See the updated
> `contracts/attempt-log.md` and research R9. The task lines below are kept as the historical record.

- [X] T047 [P] Add Supabase migration (`attempt_log` table + insert-only RLS policy) in `supabase/migrations/0001_attempt_log.sql` per `contracts/attempt-log.md` — **superseded**: table now in `server/src/db/{schema,ddl}.ts` (Postgres)
- [X] T048 [P] Unit test for the anonymous logging outbox against a mocked Supabase client (best-effort insert, queue on failure, flush on reconnect, never blocks the loop) **and** an assertion that the payload carries only the allowed anonymized aggregate fields — no audio, raw frames, note-by-note pitches, or PII (FR-019, SC-008) — in `tests/contract/logging.test.ts`
- [X] T049 Implement the Supabase attempt-log outbox service (anon insert, offline queue, non-blocking flush; anonymized payload only) in `src/services/logging/attemptLog.ts` to pass T048 (depends on T013)
- [X] T050 Wire non-blocking attempt logging into attempt completion in `src/features/practice/persist.ts` (depends on T033, T049)
- [ ] T051 [P] Accessibility pass to the **WCAG 2.1 AA, mobile-adapted** baseline (SC-009): accessible label + role on every interactive control, text/icon contrast ≥ 4.5:1, logical focus/announcement order, touch targets ≥ 44pt (iOS)/48dp (Android), and layouts intact at the largest OS font scale — across `src/components/` (Constitution Principle III)
- [ ] T052 [P] On-device performance validation vs budgets (detection < 100 ms/frame, feedback < 2 s, full cycle < 15 s) — record results (SC-001/002/003)
- [ ] T053 Run `quickstart.md` manual validation (US1 core loop on an iOS and an Android device; offline loop; telemetry row appears; **no audio/PII egress** per SC-008; **VoiceOver/TalkBack screen-reader walkthrough** per SC-009)
- [ ] T054 [P] Build & distribute via EAS (development dev client + internal/TestFlight) to 10–15 testers

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **User Stories (Phases 3–5)**: all depend on Foundational; then independent of each other (US2/US3 may integrate with US1 but stay independently testable). Priority order P1 → P2 → P3.
- **Polish (Phase 6)**: depends on US1 (attempts exist to log); telemetry is deliberately cross-cutting so it does not block US1's independent test.

### Key within-story dependencies

- US1: T010 & T023 → T024 (grading); T014 → T026 (pitch); T021B → T025 (synth: test before pure impl); T025 → T027 (playback); T021A → T030 (tuning: test before pure rule); T022/T024/T026/T027 → T028 (loop) → T029/T033 → T034 → T035; T035 → T035B (session lifecycle, after T035A). T021C is a retroactive regression test for the already-built T029 capture logic (C1).
- US2: T059 (model) → T038 (ladder) & T060 (persistence) & T039 (reducer) → T040 (loop wiring) → T061 (announcement) & T062 (screens); T041 after T039 + T060. T063 is independent of all of them. Tests T036/T037/T058 are written first and must fail.
- US3: T043 → T044 → T046; T045 after T033.
- Polish: T013 → T049 → T050; T048 before T049 (test-first).

### Parallel opportunities

- Setup: T002–T006 in parallel.
- Foundational: T008, T009, T012, T013, T014, T015, T016 in parallel (T010 after T009).
- US1 tests (T017–T021, T021A, T021B, T021C, T035A) all in parallel; then pure impls T022 & T023 in parallel; UI T031 & T032 in parallel.
- US2 tests T036, T037, T058 in parallel; then T038 (ladder), T060 (persistence), and T039 (reducer) in parallel once T059 lands — they touch different files. T063 can run at any point.
- Different user stories can proceed in parallel once Foundational is done (separate developers).

---

## Parallel Example: User Story 1 tests

```bash
# Write these failing tests together before implementing US1:
Task T017: "Unit tests for melody generator in tests/unit/melody/generator.test.ts"
Task T018: "Unit tests for segmentation in tests/unit/lib/segment.test.ts"
Task T019: "Unit tests for grading best-fit alignment in tests/unit/grading/grade.test.ts"
Task T020: "Contract test for pitch detection in tests/contract/pitch.test.ts"
Task T021: "Contract test for audio playback in tests/contract/playback.test.ts"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1) — tests first, then implementation.
3. **STOP and VALIDATE**: run the US1 quickstart scenarios on a real iOS and Android device.
4. This is a shippable MVP for the closed tester group.

### Incremental delivery

- MVP (US1) → add US2 (difficulty) → add US3 (progress) → Polish (telemetry, a11y, performance, distribution).
- Each story keeps the test suite green and is independently demoable.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Tests are written FIRST and must FAIL before implementation (Constitution Principle II).
- Native pitch-detection accuracy and audio fidelity cannot be unit-tested — they are validated on-device via `quickstart.md` (T052/T053).
- The empirical tuning constants (clarity threshold, segmentation stability/gap, tuning-offset threshold) are calibrated during on-device validation and exposed as config, per research.md.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.

---

## Phase 7: Convergence

**Purpose**: Close code-vs-intent gaps found by `/speckit-converge` that the existing task checkboxes do
not reveal. These are distinct from the already-tracked unbuilt work (US2/US3 in T036–T046, a11y/perf in
T051–T054, capture regression in T021C), which converge does not duplicate.

- [X] T055 [US1] Add a regression test for the real `react-native-pitchy` adapter `defaultNativePitch()` in `src/services/audio/pitch.ts` (added as `tests/contract/nativePitch.test.ts`, mocking the library so the `.default` export path and `confidence`/`tCaptureMs` mapping are asserted): assert it resolves the library's **default export** (so `init`/`start`/`addListener`/`stop` are invoked on the real surface, not the module namespace) and maps `confidence`/`tCaptureMs` correctly — the existing `tests/contract/pitch.test.ts` only exercises the injected fake `NativePitchModule` and so missed the default-export defect that crashed on-device capture. Align the pitch mock to the real module shape per `Constitution II` (bug fixes MUST include a regression test) and `contracts/pitch-detection.md` (partial)
- [X] T056 [US3] ~~Gate or label the illustrative statistics in `app/progress.tsx`~~ — **resolved by T046**: the screen was rebuilt on real `useProgress` data with loading/empty states, so no fabricated figures (82%, +6%, 6-day streak, 142 attempts, hardcoded trend) remain to gate. Gate or label the illustrative statistics in `app/progress.tsx` (82% accuracy, "+6% this week", 6-day streak, 142 attempts, the hardcoded 7-session trend) as placeholder — or hide the figures — until US3 aggregation (T043–T046) supplies real values, so the screen never presents fabricated data as real per FR-013 / US3 (contradicts)
- [X] T057 [US2] ~~Mark the difficulty mode toggle and level ladder in `app/settings.tsx` as not-yet-active (disabled/"coming soon")~~ — **obsolete, not performed.** This was a stopgap for shipping before US2. T041 rebuilt the screen against real persisted state, so the controls now do what they claim and there is nothing to disable

---

## Phase 8: Convergence

**Purpose**: Close code-vs-intent gaps found by a `/speckit-converge` pass after US2 (Phase 4) landed.
The headline finding is that the persistence and telemetry layer is fully built and unit-tested but
**never invoked from any screen** — T033/T035/T035B/T050 are marked complete, yet nothing in `app/`
imports `persistGradedAttempt` or `useSession`, so no Session or Attempt row is ever written at
runtime. These are distinct from already-tracked unbuilt work (US3 in T042–T046, a11y/perf in
T051–T054, T021C, T055, T056), which converge does not duplicate.

- [X] T064 **CRITICAL** Install and wire the lint/format toolchain (`eslint`, `prettier`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, and any config peers) into `package.json` devDependencies and add an `npm run lint` script, so `.eslintrc.js` — which already references `@typescript-eslint/eslint-plugin` — can actually run; today `npx eslint` aborts with "couldn't find the plugin" and there are no eslint/prettier packages installed at all, making the "green linter is a merge prerequisite" rule unenforceable per `Constitution I` (contradicts)
- [X] T065 **CRITICAL** Extract the streak-eligibility derivation out of `src/features/practice/usePracticeLoop.ts` into a pure, exported function (e.g. `toAttemptOutcome(grade, hasGradedThisMelody)` in `src/features/difficulty/`) and cover it with unit tests in `tests/unit/difficulty/`: a timed-out or low-confidence grade yields `graded: false`; the attempt after an ungraded one is still `isFirstAttemptOnMelody: true`; a retry after a graded attempt is false. Today this rule lives inline in the React hook with no test — the current jest setup (ts-jest, node env, no RNTL) cannot execute hooks — and it is the logic quickstart US2 scenario 5 depends on per `Constitution II` / FR-011a (partial)
- [X] T066 **CRITICAL** Wire session lifecycle and attempt persistence into the running app: create a `Session` row when practice starts, drive `useSession` (`src/features/practice/session.ts`) for pause/resume/end, and call `persistGradedAttempt` (`src/features/practice/persist.ts`) from the practice loop after each graded attempt, passing the effective `DifficultyLevel`. Both modules exist and are tested but are imported by nothing outside `src/`, so FR-012 (record each attempt) and FR-018 (results survive interruption) are unmet at runtime despite T033/T035/T035B being marked complete (partial)
- [X] T067 Construct the anonymous attempt-log outbox (`createAttemptLogOutbox` in `src/services/logging/attemptLog.ts`) with the device id and app version, and supply it to `persistGradedAttempt` so telemetry is actually enqueued. `createAttemptLogOutbox` is currently never called anywhere in `app/` or `src/`, and its only consumer (`persist.ts`) is itself unreachable, so no row can ever reach the backend — leaving FR-019 / SC-008 untestable end-to-end despite T050 being marked complete (partial). Depends on T066
- [X] T068 Remove or explicitly label the hardcoded "Streak — 6 days" stat in `app/index.tsx`, which now sits beside a real, persisted level value and so reads as genuine. T056 covers only the fabricated figures in `app/progress.tsx` and does not mention the home screen, so this presents invented data as real per FR-013 (contradicts)
- [X] T069 Resolve the dangling `Melody` reference in storage: either add a melodies table/repository alongside `sessions`/`attempts`/`difficulty_settings` in `src/services/storage/db.ts`, or record the decision to denormalize the melody into the `Attempt` row and update `data-model.md`'s "Relationships & integrity" accordingly. `data-model.md` declares the `Melody` entity and `Attempt.melodyId → Melody.id`, but no melody store exists, so persisted attempts would carry a `melodyId` pointing at nothing — which also blocks US3's weak-areas-by-melody-characteristic aggregation (missing)
