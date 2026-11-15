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

## Strings and neck (third round, superseded)

- [X] T012…T020 Sounding strings, then a neck with the answered notes lit (commits `34e86fe`, `2963ce1`). Dropped in the fourth round: the owner found the neck off-theme and useless. The code is removed, along with `AudioPlayback.pluck`.

## Last result (fourth round)

- [X] T021 [US6, FR-009] Pure: failing tests, then `src/lib/lastResult.ts` (when, the line, the summary and its choice) and `last` on the continue target
- [X] T022 [US6, FR-009] `LastResultBlock`; Home shows it in the free height, with the intro line for a new learner
- [X] T023 [SC-005] Emulator: the block shows the latest attempt, named, with chips and the line
- [X] T025 [US2, FR-005, FR-009] Continue leads to the last played melody (saved place or finished attempt, the later), "Try again" for a finished one; a melody only opened no longer replaces it; Home shows only that melody's result
- [ ] T024 [SC-005] Emulator: a half-answered phrase shows "Last phrase" with its own result

## Verification

- [X] T007 Checks: jest 621, typecheck, lint
- [X] T008 [SC-001] Emulator: week card, rank row, bottom bar, no scroll (owner's screenshots)
- [ ] T009 [SC-002…SC-004] Emulator: Continue card with a saved place and with a melody only opened; gone after finishing
- [ ] T010 [SC-001] Emulator at 360×640 dp with a large system font
- [ ] T011 Release: OTA on the production channel (owner's go-ahead); no server change, no new events
