# Implementation Plan: Useful Insights

**Branch**: `010-useful-insights` (not created — work lands on `master`) | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

## Summary

A pure module `src/lib/insights.ts` turns stored attempts (+ their melodies, for phrase boundaries) into note events
and from them: note accuracy by week and by day, accuracy per interval kind, and sentences about how the misses go.
`src/services/melody/catalog.ts` gains the interval make-up of library tunes (to recommend practice) and a per-level
"perfect" count. `app/progress.tsx` is rebuilt on these; the old verdict-based aggregation
(`services/storage/progress.ts`, `useProgress`, `ProgressProfile`) is deleted. A finished tune's review is made
compact (FR-010): Recent melodies show progress phrase by phrase (`phraseScores`), and the closing card shows a
note strip with the first wrong notes as chips (`TuneReview`).

## Technical Context

**Language/Version**: TypeScript 5 (Expo / React Native) · **Dependencies**: none new · **Storage**: none new

**Testing**: Jest (pure `.ts`) in `tests/unit/`; the screen is checked on the emulator

**Constraints**: offline; JS-only (OTA); no new event names

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | One pure module, one job per function; dead aggregation removed rather than left beside the new one | ✅ |
| II. Test-first | Tests for `insights.ts` and the catalog additions are written before the implementation | ✅ |
| III. UX consistency | Nocturne tokens and existing Card/Button/TrendLine; every figure has an accessibility label | ✅ |
| IV. Performance | Linear passes over attempts; library interval profile memoised per screen visit | ✅ |

## Source Code

```text
src/lib/insights.ts                    # NEW note events, accuracy, interval kinds/stats, miss patterns
src/services/melody/catalog.ts         # + perfect per level, tuneIntervals, tunesForInterval
src/lib/review.ts                      # + phraseScores, noteStrip, mistakeChip, missSummary; − mistakeLine
src/components/feedback/TuneReview.tsx # NEW note strip + miss count + wrong-note chips (closing card)
src/components/feedback/TuneComplete.tsx  # uses TuneReview instead of a line per mistake
app/progress.tsx                       # rebuilt
src/services/storage/progress.ts       # DELETED (with useProgress.ts, ProgressProfile, aggregate.test.ts)
tests/unit/lib/insights.test.ts        # NEW
tests/unit/melody/catalog.test.ts      # + perfect, tuneIntervals, tunesForInterval
tests/unit/lib/review.test.ts          # + phrase scores, strip, chip, summary
```

## Complexity Tracking

None.
