# Implementation Plan: Gamification and Practice Progress on the Server

**Branch**: `019-progress-sync` (not created — work lands on `master`) | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

## Summary

Server: one table `progress_game_rows (user, kind, id, data, seq)` for awards, completions and mastery, an added `seq`
on `progress_attempts`, and routes to push rows and to read rows and attempts after a cursor. App: local rows get a
`synced` flag; `gameSync` pushes the unsent and pulls after its cursor (union by id; mastery keeps the earlier
date); `attemptsPull` adds missing attempts and rebuilds their melodies from the library; a throttled runner runs
every step (attempts outbox, melody places, game rows, attempts) on launch, foreground, Home and after completion.

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Reuses the outbox/serial pattern; one table instead of three; no new dependency | ✅ |
| II. Test-first | Store contract, route tests, sync and pull tests, runner test — before code | ✅ |
| III. UX consistency | No new UI: figures follow from rows | ✅ |
| IV. Performance | Paged pulls with a cursor; at most one sync a minute | ✅ |

## Source Code

```text
server/src/db/{schema,ddl}.ts                                # + progress_game_rows, + seq on progress_attempts
server/src/progress/{store,memoryStore,pgStore,store.contract}.ts   # + game rows, attempts after a cursor
server/src/routes/progress.ts (+ .test.ts)                   # + POST/GET /api/progress/gamification, GET /api/progress/attempts
src/services/progress/client.ts                              # + pushGame, pullGame, pullAttempts
src/services/gamification/sync.ts                            # NEW push/pull of game rows
src/services/gamification/service.ts                         # rows carry no flag of their own; sync marks them
src/services/progress/attemptsPull.ts                        # NEW pull attempts, rebuild melodies
src/services/sync/runner.ts, instance.ts                     # NEW throttled runner and its wiring
app/_layout.tsx, src/features/gamification/useGamification.ts, app/practice.tsx   # trigger points
tests/unit/gamification/sync.test.ts, tests/unit/progress/attemptsPull.test.ts, tests/unit/sync/runner.test.ts
```
