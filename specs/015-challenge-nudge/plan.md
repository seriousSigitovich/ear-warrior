# Implementation Plan: Daily Challenge Nudge

**Branch**: `015-challenge-nudge` (not created — work lands on `master`) | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

## Summary

`challengesLeft(states)` in `src/lib/gamification.ts` (unit-tested) gives the count. A small `AttentionDot` component
draws the pulsing dot (a ring spreads and fades; still under reduced motion). Home puts it on the challenges tile
and reads the count from the standing it already loads.

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | One pure function, one small component | ✅ |
| II. Test-first | The counting is tested before it is written; the dot is checked on the emulator | ✅ |
| III. UX consistency | Existing Nocturne accent; the dot never stands alone | ✅ |
| IV. Performance | Nothing new is loaded | ✅ |

## Source Code

```text
src/lib/gamification.ts                      # + challengesLeft
src/components/gamification/AttentionDot.tsx # NEW
app/index.tsx                                # dot on the challenges tile
tests/unit/lib/gamification.test.ts          # + challengesLeft
```
