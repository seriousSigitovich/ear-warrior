# Tasks: Useful Insights

**Tests**: required first for the pure logic (constitution II); the screen is checked on the emulator.

- [X] T001 [US1,US2,US4] Write failing tests for note events, weekly/daily note accuracy, interval kinds and stats, and miss patterns in tests/unit/lib/insights.test.ts
- [X] T002 [US1,US2,US4] Implement src/lib/insights.ts
- [X] T003 [P] [US3,US5] Write failing tests for `perfect` per level and `tunesForInterval` in tests/unit/melody/catalog.test.ts
- [X] T004 [US3,US5] Implement them in src/services/melody/catalog.ts
- [X] T005 [US1–US5] Rebuild app/progress.tsx: headline + trend, streak row, interval map, practise-this, how you miss, library, recent melodies
- [X] T006 Delete src/services/storage/progress.ts, src/features/progress/useProgress.ts, `ProgressProfile` in src/models/index.ts and tests/unit/progress/aggregate.test.ts
- [X] T007 Run `npm test`, `npm run lint`, `npm run typecheck` (397 tests pass); check Progress, a practice pick and the closing card on the Android emulator
- [X] T009 [FR-010] Recent melodies show progress by phrase (`phraseScores` in src/lib/review.ts, tests in tests/unit/lib/review.test.ts); the closing card gets the compact strip + chips review (src/components/feedback/TuneReview.tsx)
- [ ] T008 Release with the next OTA (owner's go-ahead)

## Dependencies

T001 → T002 → T005; T003 → T004 → T005; T005 → T006 → T007
