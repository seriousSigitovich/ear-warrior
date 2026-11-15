# Tasks: Home Screen Layout and Continue

Test tasks come first in each group (constitution II). `[US#]` is the user story, `FR-###` the requirement.

## Foundation

- [X] T001 [US2, FR-005] Pure: failing tests, then `latestPlace` in `src/lib/melodyProgress.ts`
- [X] T002 [US2, FR-005, FR-006] Pure: failing tests, then `src/lib/lastOpened.ts` (store, `continueTarget`)
- [X] T003 [US3, FR-008, FR-009] `WeekStrip` `showCount`
- [X] T004 [US4, FR-004] Icons: `assets/nav` SVG → PNG, `scripts/build-nav-icons.sh`, `HomeNavBar`

## Screen

- [X] T005 [US1, US3, US4, FR-001, FR-003, FR-008] Home rebuilt: one layout, cards pinned and 8 dp apart, bottom bar; `isCompact` and the waveform removed
- [X] T006 [US2, FR-006, FR-007] `useContinueTarget`, Continue card; Practice records and clears the last opened melody

## Revision (second round)

- [X] T012 [US5, FR-010, FR-012, FR-013] Pure: failing tests, then `src/lib/homeCopy.ts` (greeting, rank lines) and `weekPracticeDays` / `WEEKLY_GOAL_DAYS` in `src/lib/streak.ts`
- [X] T013 [FR-015] `AnimatedBar`
- [X] T014 [US2, US3, US5, FR-010…FR-015] `PracticeCard`, `WeeklyActivityCard`, `RankXpCard` (with `XpGain`), `DailyChallengeCard`; Home recomposed with a compact header
- [X] T015 [SC-001] Emulator at 360×640 dp (adb `wm size`): header, Continue card, weekly activity and rank all visible with the bottom bar, no scroll

## Verification

- [X] T007 Checks: jest 619, typecheck, lint
- [X] T008 [SC-001] Emulator: week card, rank row, bottom bar, no scroll (owner's screenshots)
- [ ] T009 [SC-002…SC-004] Emulator: Continue card with a saved place and with a melody only opened; gone after finishing
- [ ] T010 [SC-001] Emulator at 360×640 dp with a large system font
- [ ] T011 Release: OTA on the production channel (owner's go-ahead); no server change, no new events
