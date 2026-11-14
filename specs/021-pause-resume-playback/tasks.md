# Tasks: A Player on the Answer Screen

Test tasks come first in each group (constitution II). `[US#]` is the user story, `FR-###` the requirement.

## Foundation

- [X] T001 [US1, US6, FR-001] Pure: failing tests, then `src/lib/noteRow.ts` (note starts, mark state, nearest mark, end rule)
- [X] T002 [US1, US6, FR-001, FR-009] Service: failing contract tests, then `position()`, `pause()`, `offsetMs` in `playback.ts` (clip and note fallback)
- [X] T003 [US2, FR-005] Pure: failing tests, then `replaceTap` in `src/lib/fretboard.ts` (keeps the replaced note's time)
- [X] T004 [US1, US2, US3, US6, FR-003, FR-005, FR-010] Loop: `paused`, `pause`, `resume`, `seek`, `cursor`; a fret tap pauses a replay and replaces at the cursor; place and cursor dropped on phrase change

## Screen

- [X] T005 [US1, US2, US3, FR-002, FR-003, FR-004, FR-011] `NoteRow`: marks, ▶/⏸, backspace key, tap and drag, adjustable accessibility
- [X] T006 [US4, US5, FR-006, FR-007, FR-008] Answer screen: board + row, Check only when full, hint line in the title, settings icon and panel; old rail, chip, bottom buttons and Draft pill removed
- [X] T007 [US1, FR-001] Result screens: Replay / Pause / Resume

## Verification

- [X] T008 Checks: jest 563, typecheck (only the old `delaysContentTouches` error remains), lint
- [X] T009 [SC-001…SC-005] Emulator at 360×640 dp: pause/resume, drag, selection and replacement, Check on a full phrase, settings panel, the backspace key
- [ ] T010 (left open after release, owner shipped it before this check) [SC-003, SC-006] On a phone, by ear: the join after pause; a long touch near the screen edge; a 15–17 note phrase
- [X] T011 Release: OTA on the production channel, group `d90e4ec9`, 2026-11-14 (owner's go-ahead); no server change, no new events
