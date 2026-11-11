# Tasks: A Simpler Practice Flow

- [X] T001 Revert the playback service and its contract test to the contract before pause/resume (spec 009 FR-001 withdrawn)
- [X] T002 Rework src/features/practice/usePracticeLoop.ts: phrase plays on the answer screen, no intro, `ready`, `hearWhole`, `listenFirst`; delete listening state and controls
- [X] T003 Simplify TransportControls, PracticeStage and PhraseProgress; add "Hear whole melody" to FretboardAnswer
- [X] T004 Wire app/practice.tsx (autostart, fallback Play button, hear whole) and set `listenFirst` in app/first-melody.tsx
- [X] T005 Run `npm test`, `npm run lint`, `npm run typecheck`
- [X] T006 Emulator: Start practice plays at once; tap stops the phrase; Check mid-phrase; Next phrase plays on the answer screen; Hear whole melody; picked tune; first-run onboarding unchanged; leaving stops audio
- [ ] T007 Release with the next OTA (owner's go-ahead)
