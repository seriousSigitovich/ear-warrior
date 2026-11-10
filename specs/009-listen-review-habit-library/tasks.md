# Tasks: Listening Controls, Mistake Review, Daily Habit and Melody Library

**Input**: Design documents from `/specs/009-listen-review-habit-library/`
**Prerequisites**: plan.md, spec.md

**Tests**: pure logic and the playback contract are unit-tested; `.tsx`/hooks are checked on the emulator because the
Jest runner is pure-logic only. The tests were written alongside the code in this change.

## Phase 1: User Story 1 — Control the melody while listening (P1)

- [X] T001 [US1] Add `pause()`/`resume()` to `ClipHandle` and `AudioPlayback`; a stop, a tap or a new melody lifts a pause in src/services/audio/playback.ts
- [X] T002 [US1] Tests: a paused clip ends as much later as it was held; a stop ends a paused clip and the next melody is not held in tests/contract/playback.test.ts
- [X] T003 [US1] Add `listenThrough` and `pauseListening`/`resumeListening`/`restartListening`/`skipListening` (replacing `skipIntro`), plus the `paused` state, in src/features/practice/usePracticeLoop.ts
- [X] T004 [US1] Show Pause/Resume · Restart · Skip while the tune or a phrase plays in src/components/controls/TransportControls.tsx; "Paused" on the stage in src/components/practice/PracticeStage.tsx
- [X] T005 [US1] Wire the controls in app/practice.tsx; a restart is tracked as `melody_replay` with `where: playingMelody`

## Phase 2: User Story 2 — Mistakes (P1)

- [X] T006 [P] [US2] Tests for score, mistakes, sentences and recent reviews in tests/unit/lib/review.test.ts
- [X] T007 [US2] Implement src/lib/review.ts
- [X] T008 [US2] List mistakes on the closing card (first six, the rest counted) in src/components/feedback/TuneComplete.tsx
- [X] T009 [US2] Add `useHistory` (src/features/progress/useHistory.ts) and "Recent melodies" with every mistake to app/progress.tsx; make the screen scroll

## Phase 3: User Story 3 — Score, praise, daily habit (P1)

- [X] T010 [P] [US3] Tests for streak, today's count, best run, local days and wording in tests/unit/lib/streak.test.ts
- [X] T011 [US3] Implement src/lib/streak.ts (daily goal 3)
- [X] T012 [US3] Percentage, praise and the habit line on the closing card (TuneComplete.tsx, fed from app/practice.tsx)
- [X] T013 [US3] Streak and Today cards on Home (app/index.tsx) and a streak row on Progress (app/progress.tsx)

## Phase 4: User Story 4 — Melody library (P2)

- [X] T014 [P] [US4] Tests for the catalog (every tune once, by level, named; best score; unknown id) in tests/unit/melody/catalog.test.ts
- [X] T015 [US4] Implement src/services/melody/catalog.ts
- [X] T016 [US4] Add app/melodies.tsx, register it in app/_layout.tsx, add the Melodies button on Home
- [X] T017 [US4] Serve `?tune=<id>` first in app/practice.tsx; add the `adapts` dep to the loop so a picked tune is recorded but does not move the level; record the tune's own level with the attempt

## Phase 5: Polish

- [X] T018 Run `npm test`, `npm run lint`, `npm run typecheck`; fix what fails (386 tests pass; `typecheck:app` keeps its one pre-existing error in FretboardAnswer.tsx)
- [X] T019 Check on the Android emulator: pause holds the player, resume/restart/skip, closing card, Home, Progress, Melodies, a picked tune leaves the level alone
- [ ] T020 Release (owner's go-ahead): OTA with EXPO_PUBLIC_* inline; no server deploy needed first
- [ ] T021 Note the change in docs/beta-checklist.md once released

## Dependencies

- T001 → T003 → T004 → T005
- T007 → T008, T009; T011 → T012, T013; T015 → T016 → T017
- Polish after all stories
