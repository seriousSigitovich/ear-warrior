# Implementation Plan: Listening Controls, Mistake Review, Daily Habit and Melody Library

**Branch**: `009-listen-review-habit-library` (not created — work lands on `master`) | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-listen-review-habit-library/spec.md`

## Summary

Four pieces around the practice loop, all in the app (no server change):

1. **Listening controls** — the playback service learns `pause()`/`resume()` (the clip's media clock stands still;
   the note fallback waits before its next note). The loop wraps "listen before answering" in `listenThrough`, which
   replays while the learner asks for a restart and reports whether it was heard out or skipped.
2. **Mistake review** — pure `src/lib/review.ts` turns note results into score, mistakes and sentences; used by the
   closing card and a "Recent melodies" list on Progress.
3. **Daily habit** — pure `src/lib/streak.ts` derives streak / today / goal from the `createdAt` of finished tunes.
4. **Melody library** — pure `src/services/melody/catalog.ts` lists the library against the attempts; a new
   `app/melodies.tsx` screen starts `/practice?tune=<id>`; a picked tune is recorded but does not adapt the level.

## Technical Context

**Language/Version**: TypeScript 5 (Expo / React Native app)

**Primary Dependencies**: expo-audio (`player.pause()` / `play()`), expo-router (`useLocalSearchParams`); no new dependency

**Storage**: none new — everything is derived from the stored attempts and melodies

**Testing**: Jest (ts-jest, node) for pure `.ts` in `tests/unit/` and the playback contract in `tests/contract/`.
Hooks and `.tsx` are not unit-testable here — they stay thin and are checked on the emulator.

**Target Platform**: Android (beta) / iOS, via OTA (JS only, no native change)

**Project Type**: mobile app

**Performance Goals**: controls respond within the 200 ms interaction budget; the library list (100 rows) is a
virtualised `SectionList`

**Constraints**: offline-capable; no new analytics event names, so no server deploy has to precede the OTA

**Scale/Scope**: 1 new screen, 3 screens touched, 3 new pure modules, 1 new hook, playback service + loop extended

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Three small pure modules with one job each; loop gets one helper instead of two ad-hoc flags (`introSkippedRef` removed); no new dependency | ✅ |
| II. Test-first | Pure modules and the pause contract have tests (written alongside the code in this change, not strictly before — deviation noted); UI wiring checked on the emulator | ⚠️ noted |
| III. UX consistency | Existing Nocturne components and tokens only; labels and accessibility text on new controls and rows | ✅ |
| IV. Performance | Pause is a native player call; lists are virtualised; aggregations are linear over attempts | ✅ |

## Project Structure

### Source Code (repository root)

```text
src/services/audio/playback.ts               # + pause()/resume() on AudioPlayback and ClipHandle
src/features/practice/usePracticeLoop.ts     # + listenThrough, pause/resume/restart/skipListening, `adapts` dep
src/lib/review.ts                            # NEW score, mistakes, sentences, praise, recent reviews
src/lib/streak.ts                            # NEW day streak, today's count, daily goal
src/services/melody/catalog.ts               # NEW library as a list against the attempts
src/features/progress/useHistory.ts          # NEW attempts + melodies, re-read on focus
src/components/controls/TransportControls.tsx  # Pause/Resume · Restart · Skip while listening
src/components/practice/PracticeStage.tsx    # "Paused" state, idle hint for a picked tune
src/components/feedback/TuneComplete.tsx     # score, praise, habit line, mistakes
app/practice.tsx                             # ?tune=<id>, picked tunes do not adapt, streak, controls wiring
app/melodies.tsx                             # NEW library screen
app/progress.tsx                             # streak row, recent melodies with mistakes, scrollable
app/index.tsx                                # streak + today cards, Melodies button
app/_layout.tsx                              # registers the screen

tests/contract/playback.test.ts              # + pause/resume timeline, stop lifts a pause
tests/unit/lib/review.test.ts                # NEW
tests/unit/lib/streak.test.ts                # NEW
tests/unit/melody/catalog.test.ts            # NEW
```

**Structure Decision**: logic that can be pure lives in `src/lib/` / `src/services/` and is unit-tested; React pieces
only wire it.

## Complexity Tracking

None.
