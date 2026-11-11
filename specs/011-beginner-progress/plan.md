# Implementation Plan: Progress for a Beginner

**Branch**: `011-beginner-progress` (not created — work lands on `master`) | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

## Summary

Three blocks drawn with Views (no SVG dependency): `Ring` (two rotating half-clips), `WeekStrip` and `MoveShape`.
Pure logic gains plain names and a signed "rise" per kind of move (`lib/insights.ts`) and the current week's days
(`lib/streak.ts`). Everything the removed blocks needed is deleted: `missPatterns`, `byDay`, `recentReviews`,
`phraseScores`, `perfect`, `streak.best`, `TrendLine`.

## Technical Context

**Language/Version**: TypeScript 5 (Expo / React Native) · **Dependencies**: none new · **Storage**: none new

**Testing**: Jest for pure `.ts`; components and the screen on the emulator

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Three small presentational components; removed blocks take their code and tests with them | ✅ |
| II. Test-first | Tests for names, rise and week days are written before the implementation | ✅ |
| III. UX consistency | Nocturne tokens only; warm reserved for the weak move; labels on ring, days and card | ✅ |
| IV. Performance | Native-driver rotation for the ring; no lists | ✅ |

## Source Code

```text
src/lib/insights.ts                     # plain intervalLabel, + intervalRise, + weakSpotTitle; − missPatterns, byDay
src/lib/streak.ts                       # + weekDays; − best
src/lib/review.ts                       # − recentReviews, phraseScores
src/services/melody/catalog.ts          # − perfect
src/components/common/Ring.tsx          # NEW progress ring from Views
src/components/progress/WeekStrip.tsx   # NEW seven day circles
src/components/progress/MoveShape.tsx   # NEW contour of a melodic move
src/components/common/TrendLine.tsx     # DELETED
app/progress.tsx                        # rebuilt: ring, week, next up
tests/unit/lib/{insights,streak,review}.test.ts, tests/unit/melody/catalog.test.ts  # updated
```
