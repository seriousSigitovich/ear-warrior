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

- [ ] T001 Initialize Expo + TypeScript app with expo-router at repo root (`package.json`, `tsconfig.json`, `app/`)
- [ ] T002 [P] Install runtime deps (`react-native-pitchy`, `expo-av`, `expo-sqlite`, `@supabase/supabase-js`, `expo-asset`, `expo-file-system`) in `package.json`
- [ ] T003 [P] Configure TypeScript `strict` + ESLint + Prettier (`tsconfig.json`, `.eslintrc.js`, `.prettierrc`)
- [ ] T004 [P] Configure Jest with `jest-expo` preset + React Native Testing Library (`jest.config.js`, `jest.setup.ts`, `test` script in `package.json`)
- [ ] T005 [P] Create `eas.json` with a `development` (dev client) profile and an internal/ad-hoc distribution profile for iOS + Android
- [ ] T006 [P] Configure `app.config.ts`: iOS/Android bundle IDs, microphone usage strings (`NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`), plugins, and `EXPO_PUBLIC_SUPABASE_*` env
- [ ] T007 Create source-tree scaffolding: `src/{components/{feedback,controls,common},features/{practice,difficulty,progress},services/{audio,melody,grading,storage,logging},models,lib}`, `tests/{unit,contract,fixtures}`, `assets/samples`, `supabase/migrations`

**Checkpoint**: Project builds, lints, and `npm test` runs (0 tests) on a dev client.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, pure math, persistence, permissions, and navigation that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T008 [P] Define domain types in `src/models/index.ts` (Note, DifficultyLevel, Melody, NoteResult, Attempt, Session, ProgressProfile) per data-model.md
- [ ] T009 [P] Write failing unit tests for pitch↔note math (Hz→MIDI, cents deviation, nearest-note within ±50 cents, guitar-range guard) in `tests/unit/lib/pitchNote.test.ts`
- [ ] T010 Implement pitch↔note + cents/tolerance helpers in `src/lib/pitchNote.ts` to pass T009
- [ ] T011 Initialize `expo-sqlite` database with schema/migration for `sessions` and `attempts` in `src/services/storage/db.ts`
- [ ] T012 [P] Implement Session & Attempt repositories (create/read/update; survive app restart per FR-018) in `src/services/storage/repositories.ts`
- [ ] T013 [P] Implement anonymous per-install device-id generator (no PII) in `src/lib/deviceId.ts`
- [ ] T014 [P] Implement microphone-permission + audio-session helper (playback fully stops before capture, R7) in `src/services/audio/session.ts`
- [ ] T015 [P] Create root navigation shell + shared UI primitives/theme in `app/_layout.tsx` and `src/components/common/`
- [ ] T016 [P] Seed a default DifficultyLevel (L1) config in `src/services/melody/levels.ts`

**Checkpoint**: Foundation ready — user stories can now begin.

---

## Phase 3: User Story 1 - Listen, Play Back, Get Feedback (Priority: P1) 🎯 MVP

**Goal**: The complete core loop — app plays a generated melody, learner reproduces it on guitar, app
detects the notes, grades them with best-fit alignment (±50-cent match), and shows immediate feedback.

**Independent Test**: Start a session, hear one melody, play it back on a guitar; confirm the app reports
a correct/incorrect verdict identifying matched/wrong/missed/extra notes, and supports replay/retry/next.

### Tests for User Story 1 (REQUIRED per constitution — write FIRST, ensure they FAIL) ⚠️

- [ ] T017 [P] [US1] Unit tests for melody generator (length == noteCount; range/scale membership; no consecutive identical pitches per FR-001; deterministic by seed; invalid level throws) in `tests/unit/melody/generator.test.ts`
- [ ] T018 [P] [US1] Unit tests for pitch-stream segmentation (pitch-change + silence-gap → note sequence; low-clarity treated as silence) using recorded fixtures in `tests/unit/lib/segment.test.ts` (+ fixtures in `tests/fixtures/`)
- [ ] T019 [P] [US1] Table-driven unit tests for grading engine best-fit alignment (exact, one wrong, missed, extra, **mid-phrase insertion/omission must NOT cascade** per FR-005, octave mismatch, ±50-cent boundary, timeout, low-confidence) in `tests/unit/grading/grade.test.ts`
- [ ] T020 [P] [US1] Contract test for the pitch-detection wrapper against a mocked `react-native-pitchy` (permission handling, silence/low-clarity pass-through, clean teardown) in `tests/contract/pitch.test.ts`
- [ ] T021 [P] [US1] Contract test for audio playback against a mocked `expo-av` (correct sample per `midi`, `playMelody` resolves after last note, idempotent `stop`) in `tests/contract/playback.test.ts`
- [ ] T021A [P] [US1] Unit tests for the pure tuning-detection rule (warn when median signed cents offset > threshold across ≥ min-count notes mostly the same direction; no warn on a single sharp/flat note or scattered offsets; thresholds calibratable) per FR-014 in `tests/unit/lib/tuning.test.ts`

### Implementation for User Story 1

- [ ] T022 [P] [US1] Implement melody generator (pure) in `src/services/melody/generator.ts` to pass T017
- [ ] T023 [P] [US1] Implement pitch-stream segmentation (pure) in `src/lib/segment.ts` to pass T018
- [ ] T024 [US1] Implement grading engine with best-fit (edit-distance/LCS) alignment + ±50-cent nearest-note match + octave sensitivity in `src/services/grading/grade.ts` to pass T019 (depends on T010, T023)
- [ ] T025 [P] [US1] Add pre-rendered note-sample assets for the L1 note pool + manifest loader in `assets/samples/` and `src/services/audio/samples.ts`
- [ ] T026 [US1] Implement pitch-detection wrapper over `react-native-pitchy` in `src/services/audio/pitch.ts` to pass T020 (depends on T014)
- [ ] T027 [US1] Implement audio playback (expo-av sample sequencing + reference tone) in `src/services/audio/playback.ts` to pass T021 (depends on T025)
- [ ] T028 [US1] Implement practice-loop state machine (idle→playingMelody→awaitingInput→capturing→grading→feedback; replay/retry/next) in `src/features/practice/usePracticeLoop.ts` (depends on T022, T024, T026, T027)
- [ ] T029 [US1] Implement no-input timeout (~8 s) + end-on-silence (~2 s) + low-confidence/polyphony retry handling (FR-015, FR-017) in `src/features/practice/capture.ts` (depends on T028)
- [ ] T030 [US1] Implement the **pure** tuning-detection rule (median signed cents offset > threshold across ≥ min-count notes, same direction; calibratable) in `src/lib/tuning.ts` to pass T021A, then wire the reference-tone warning + **advisory (non-blocking)** behavior — learner may dismiss and proceed to grading (FR-014) — in `src/features/practice/tuning.ts` (depends on T021A, T027)
- [ ] T031 [P] [US1] Build feedback UI (verdict banner + per-note matched/wrong/missed/extra chips) in `src/components/feedback/`
- [ ] T032 [P] [US1] Build transport controls (Play / Replay / Retry / Next + "your turn" cue) in `src/components/controls/`
- [ ] T033 [US1] Persist Session + Attempt on each graded attempt (FR-012, FR-018) in `src/features/practice/persist.ts` (depends on T012, T028)
- [ ] T034 [US1] Wire the practice screen `app/practice.tsx` to the loop, controls, and feedback (depends on T028–T033)
- [ ] T035 [US1] Implement start-session on `app/index.tsx` (create Session, launch practice) (depends on T011, T033)
- [ ] T035A [P] [US1] Unit tests for session lifecycle transitions (`active→paused→active→ended`; `ended` terminal; completed attempts persist across pause and app interruption) per FR-018 in `tests/unit/practice/session.test.ts`
- [ ] T035B [US1] Implement session pause/resume/end (state transitions + persist `endedAt`; survive interruption, FR-018) in `src/features/practice/session.ts`, and wire pause/end controls into `app/practice.tsx`, to pass T035A (depends on T012, T035)

**Checkpoint**: US1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Adjustable & Adaptive Difficulty (Priority: P2)

**Goal**: Difficulty matches ability — generated melodies reflect the level's note count/range/tempo, and
difficulty auto-adjusts on win/loss streaks or stays fixed when the learner chooses.

**Independent Test**: Select a fixed level and confirm melodies match its parameters; in adaptive mode,
confirm several correct answers raise difficulty and several failures lower it.

### Tests for User Story 2 (REQUIRED per constitution — write FIRST, ensure they FAIL) ⚠️

- [ ] T036 [P] [US2] Unit tests for adaptive difficulty (raise after win streak, lower after loss streak, fixed mode never adjusts) in `tests/unit/difficulty/adapt.test.ts`
- [ ] T037 [P] [US2] Unit tests: generator honors each level's params (noteCount / range / scale / tempo) in `tests/unit/melody/levels.test.ts`

### Implementation for User Story 2

- [ ] T038 [US2] Define the full DifficultyLevel set (2→8 notes, ranges, tempos, ranks) in `src/services/melody/levels.ts` (extends T016) to pass T037
- [ ] T039 [US2] Implement adaptive-difficulty engine + manual fixed mode in `src/features/difficulty/adapt.ts` to pass T036 (depends on T038)
- [ ] T040 [US2] Wire difficulty selection (adaptive/fixed) into session + generator in `src/features/practice/usePracticeLoop.ts` (depends on T039, T028)
- [ ] T041 [P] [US2] Build settings screen `app/settings.tsx` (choose fixed level or adaptive) (depends on T039)

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Progress Tracking Over Time (Priority: P3)

**Goal**: Show accuracy trends, practice volume, and weak areas across sessions; record a per-session
summary.

**Independent Test**: Complete attempts across two sessions, then open the progress view and confirm it
shows accuracy trend, practice volume, and identified weak areas derived from real results.

### Tests for User Story 3 (REQUIRED per constitution — write FIRST, ensure they FAIL) ⚠️

- [ ] T042 [P] [US3] Unit tests for progress aggregation (accuracy trend by session, practice volume, weak areas by interval/length) in `tests/unit/progress/aggregate.test.ts`

### Implementation for User Story 3

- [ ] T043 [US3] Implement progress aggregation queries over stored attempts in `src/services/storage/progress.ts` (depends on T012) to pass T042
- [ ] T044 [US3] Implement progress feature/view logic in `src/features/progress/useProgress.ts` (depends on T043)
- [ ] T045 [US3] Record per-session summary (accuracy, attempt count) on session end (FR-012) in `src/features/practice/persist.ts` (depends on T033)
- [ ] T046 [P] [US3] Build progress screen `app/progress.tsx` (accuracy trend, volume, weak areas) (depends on T044)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Anonymous telemetry, accessibility, performance validation, and distribution.

- [ ] T047 [P] Add Supabase migration (`attempt_log` table + insert-only RLS policy) in `supabase/migrations/0001_attempt_log.sql` per `contracts/supabase-attempt-log.md`
- [ ] T048 [P] Unit test for the anonymous logging outbox against a mocked Supabase client (best-effort insert, queue on failure, flush on reconnect, never blocks the loop) in `tests/contract/logging.test.ts`
- [ ] T049 Implement the Supabase attempt-log outbox service (anon insert, offline queue, non-blocking flush; anonymized payload only) in `src/services/logging/attemptLog.ts` to pass T048 (depends on T013)
- [ ] T050 Wire non-blocking attempt logging into attempt completion in `src/features/practice/persist.ts` (depends on T033, T049)
- [ ] T051 [P] Accessibility pass on interactive controls + feedback (labels, contrast, focus order) across `src/components/` (Constitution Principle III)
- [ ] T052 [P] On-device performance validation vs budgets (detection < 100 ms/frame, feedback < 2 s, full cycle < 15 s) — record results (SC-001/002/003)
- [ ] T053 Run `quickstart.md` manual validation (US1 core loop on an iOS and an Android device; offline loop; telemetry row appears)
- [ ] T054 [P] Build & distribute via EAS (development dev client + internal/TestFlight) to 10–15 testers

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **User Stories (Phases 3–5)**: all depend on Foundational; then independent of each other (US2/US3 may integrate with US1 but stay independently testable). Priority order P1 → P2 → P3.
- **Polish (Phase 6)**: depends on US1 (attempts exist to log); telemetry is deliberately cross-cutting so it does not block US1's independent test.

### Key within-story dependencies

- US1: T010 & T023 → T024 (grading); T014 → T026 (pitch); T025 → T027 (playback); T021A → T030 (tuning: test before pure rule); T022/T024/T026/T027 → T028 (loop) → T029/T033 → T034 → T035; T035 → T035B (session lifecycle, after T035A).
- US2: T038 → T039 → T040; T041 after T039.
- US3: T043 → T044 → T046; T045 after T033.
- Polish: T013 → T049 → T050; T048 before T049 (test-first).

### Parallel opportunities

- Setup: T002–T006 in parallel.
- Foundational: T008, T009, T012, T013, T014, T015, T016 in parallel (T010 after T009).
- US1 tests (T017–T021, T021A, T035A) all in parallel; then pure impls T022 & T023 in parallel; UI T031 & T032 in parallel.
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
