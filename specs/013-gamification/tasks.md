# Tasks: Gamification MVP

**Tests**: required first (constitution II) for the rules and the service; screens are checked on the emulator.

- [X] T001 Add src/config/gamification.ts (rewards, accuracy threshold, ranks, mastery criteria, challenges)
- [X] T002 Write failing tests for phrase XP, rank derivation and locks, level mastery, challenges, streak days in tests/unit/lib/gamification.test.ts
- [X] T003 Implement src/lib/gamification.ts
- [X] T004 Add the four tables to src/services/storage/db.ts
- [X] T005 Write failing tests for the service: idempotent phrase and completion awards, mastery kept, challenge rewards once, daily reset, streak, timezone, restart, conversion of past attempts in tests/unit/gamification/service.test.ts
- [X] T006 Implement src/services/gamification/service.ts and instance.ts
- [X] T007 [P] Events: results → events (src/services/gamification/events.ts + test), eight names in src/services/logging/eventLog.ts and server/src/routes/events.ts (+ server test)
- [X] T008 Wire app/practice.tsx: phrase XP, hints used, melody completion, events
- [X] T009 UI: useGamification, RankCard, Flame, ChallengeCard, RankUpModal; app/challenges.tsx, app/journey.tsx; Home, Progress, closing card, phrase result
- [X] T010 Run `npm test`, `npm run lint`, `npm run typecheck`, `cd server && npm test`; check the flow on the Android emulator
- [ ] T011 Release (owner's go-ahead): deploy the server first, then the OTA with EXPO_PUBLIC_* inline
- [X] T012 [FR-012] Seven rank icons: assets/ranks/*.svg and *.png, scripts/build-rank-icons.sh, RankIcon and rankIcons.ts, shown on the rank card, the ranks list and the rank-up modal; tests/unit/gamification/rankIcons.test.ts
