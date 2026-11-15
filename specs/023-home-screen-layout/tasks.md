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

## Strings (third round)

- [X] T012 [US6, FR-016] Contract: failing test, then `AudioPlayback.pluck` (rings alongside, cuts nothing)
- [X] T013 [US6, FR-009, FR-016] Pure: failing tests, then `src/lib/openStrings.ts` (string at a touch, its note, the sine keyframes); `weekPracticeDays` in `streak.ts`
- [X] T014 [US6, FR-009, FR-016, FR-017] `StringsHero` (wave segments on one native clock, pluck swell, ring, strum by drag)
- [X] T015 [US3, FR-003, FR-008] Home rebuilt without cards: melody, strings, main button, strip
- [X] T016 [SC-005] Emulator: strings move, a tap swells the string under the finger and starts the player; a swipe starts several; smooth lines, no staircase
- [X] T018 [US6, FR-009, FR-018] Pure: failing tests, then `src/lib/neckNotes.ts` (neck positions of notes, fret scale, standing wave) and `src/services/melody/neckNotes.ts` (last answered phrase of a tune)
- [X] T019 [US6, FR-009, FR-018] `StringsHero` rebuilt as a neck: nut, frets to scale, inlays, numbers, pinned strings, lit notes; Home passes the notes
- [X] T020 [SC-005] Emulator: the neck looks like a neck, notes of an answered phrase sit on the right frets (checked with a temporary preview of Hot Cross Buns), a tap starts the player
- [ ] T017 [SC-005] On a phone, by ear: the six open strings are the right notes, a strum rings together, and the animation is smooth on a modest phone

## Verification

- [X] T007 Checks: jest 629, typecheck, lint
- [X] T008 [SC-001] Emulator: week card, rank row, bottom bar, no scroll (owner's screenshots)
- [ ] T009 [SC-002…SC-004] Emulator: Continue card with a saved place and with a melody only opened; gone after finishing
- [ ] T010 [SC-001] Emulator at 360×640 dp with a large system font
- [ ] T011 Release: OTA on the production channel (owner's go-ahead); no server change, no new events
