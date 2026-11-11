# Implementation Plan: Gamification MVP

**Branch**: `013-gamification` (not created — work lands on `master`) | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Summary

One configuration (`src/config/gamification.ts`), one pure module of rules (`src/lib/gamification.ts`: phrase XP,
rank derivation, level mastery, daily challenges, streak days) and one service (`src/services/gamification/`) that
persists awards over the existing `RowStore` and is the only place XP is awarded. Awards are append-only rows with
deterministic ids, which makes every award idempotent and keeps stored XP stable when the config changes. The
practice screen reports two things to the service — a phrase checked, a melody completed — and renders what comes
back; analytics events are derived from the same result, so they fire once per award.

## Technical Context

**Language/Version**: TypeScript 5 (Expo / React Native) · **Dependencies**: none new

**Storage**: four new tables in the existing SQLite document store (`completions`, `xp_awards`, `mastery`,
`gamification_meta`); an in-memory store backs the tests

**Testing**: Jest for the rules and the service (restart = a new service over the same store); screens on the emulator

**Constraints**: offline; JS-only (OTA); the new event names MUST be on the server allowlist before the OTA

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Config, rules, service, UI are separate; no reward numbers outside the config | ✅ |
| II. Test-first | Tests for rules and service are written before the code | ✅ |
| III. UX consistency | Existing Nocturne components; rank-up is text plus motion, not colour alone | ✅ |
| IV. Performance | Linear passes over a few hundred rows; one snapshot per screen focus | ✅ |

## Source Code

```text
src/config/gamification.ts                  # NEW rewards, ranks, mastery criteria, challenges
src/lib/gamification.ts                     # NEW pure rules
src/services/gamification/service.ts        # NEW the XP service (+ one-time conversion of past attempts)
src/services/gamification/instance.ts       # NEW shared instance over the device store
src/services/gamification/events.ts         # NEW service results → analytics events (pure)
src/services/storage/db.ts                  # + four tables
src/features/gamification/useGamification.ts  # NEW snapshot hook (re-read on focus)
src/components/gamification/*               # NEW RankCard, ChallengeCard, RankUpModal, Flame
app/challenges.tsx, app/journey.tsx         # NEW screens
app/index.tsx, app/progress.tsx, app/practice.tsx, app/_layout.tsx   # wired
src/components/feedback/TuneComplete.tsx, VerdictBanner.tsx          # + reward lines
src/services/logging/eventLog.ts, server/src/routes/events.ts        # + 8 event names
src/lib/streak.ts                           # day-key based week and streak
tests/unit/lib/gamification.test.ts, tests/unit/gamification/*.test.ts, server/src/routes/events.test.ts
```

## Complexity Tracking

None.
