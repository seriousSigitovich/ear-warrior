# Implementation Plan: Daily Challenges From the Backend

**Branch**: `018-backend-challenges` (not created — work lands on `master`) | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

## Summary

Server: a pure `challengesFor(date)` (seeded by the date) and a public route. App: a small HTTP client that validates
the answer; the XP service stores the day's challenges in `gamification_meta`, evaluates and pays against them, and
`refreshChallenges()` (called by the screens after their first read, never awaited by it) fetches them once a day.

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | One pure generator, one client, the existing service extended | ✅ |
| II. Test-first | Generator and route tests (node:test), client validation and service tests (Jest) before the code | ✅ |
| III. UX consistency | Same cards; text comes from the data | ✅ |
| IV. Performance | Home never waits for the network; one small request per day | ✅ |

## Source Code

```text
server/src/challenges/daily.ts (+ .test.ts)        # NEW pure generator
server/src/routes/challenges.ts (+ .test.ts)       # NEW GET /api/challenges/today
server/src/app.ts                                  # + registerChallenges
src/services/challenges/client.ts                  # NEW fetch + validate
src/lib/gamification.ts                            # challengeStates takes the day's definitions
src/services/gamification/service.ts               # day's definitions stored, refreshChallenges, bonus from them
src/services/gamification/instance.ts              # wires the client
src/features/gamification/useGamification.ts       # refresh after the first read
app/challenges.tsx, app/index.tsx                  # text and bonus from the snapshot
tests/unit/challenges/client.test.ts, tests/unit/gamification/service.test.ts
```
