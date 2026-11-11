# Implementation Plan: Continue a Melody Where You Stopped

**Branch**: `017-resume-melody` (not created — work lands on `master`) | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

## Summary

Server: `progress_melodies` table, store (Postgres + memory, one contract test), three routes. App: a pure
`melodyProgress` module (resume point, merging local with remote), a local table `melody_progress` with an
unsent flag, a sync that flushes unsent changes then pulls the server's, client calls on the existing progress client.
The loop gains `resume` (restores first tries, starts at a phrase), `onProgress` (after each first-try check) and
`skipToSaved`. The Melodies screen shows places and Continue; practice shows "Skip to phrase N".

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Sync mirrors the existing outbox pattern; merge logic is pure | ✅ |
| II. Test-first | Store contract, route tests, pure-logic and repository tests before code; hook/screens on the emulator | ✅ |
| III. UX consistency | Existing row, button and link styles | ✅ |
| IV. Performance | One small write per checked phrase; list read once per focus | ✅ |

## Source Code

```text
server/src/db/{schema,ddl}.ts                    # + progress_melodies
server/src/progress/{store,memoryStore,pgStore,store.contract}.ts   # + melody places
server/src/routes/progress.ts (+ .test.ts)       # + PUT/GET/DELETE /api/progress/melodies
src/lib/melodyProgress.ts                        # NEW resume point, merge
src/services/storage/db.ts                       # + melody_progress table
src/services/progress/{client,melodyProgress,melodySync}.ts   # client calls, repository, sync
src/features/practice/usePracticeLoop.ts         # resume, onProgress, skipToSaved
app/practice.tsx, app/melodies.tsx, src/components/practice/FretboardAnswer.tsx
tests/unit/lib/melodyProgress.test.ts, tests/unit/progress/melodyProgress.test.ts
```
