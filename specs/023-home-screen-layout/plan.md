# Implementation Plan: Home Screen Layout and Continue

**Branch**: `023-home-screen-layout` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

## Summary

One Home layout for every phone. The three outlined buttons become a bottom bar (`HomeNavBar`, bundled PNG icons); the
rank, streak and challenge tiles become a week card (the existing `WeekStrip`) and a one-row rank card; a Continue card
is added. What Continue opens is decided by pure code (`continueTarget`, over the saved places of spec 017 and a new
"last opened" value kept in the local key-value store); the practice screen writes that value when a melody is shown.
No server, no new events, no new dependency, so it ships by OTA.

Three layouts were shown to the owner as pictures (cards, bottom bar, status strip); the bottom bar was chosen, then
three ways to fill the free space (two buttons, card with the week, wave with a goal); the card with the week was chosen.

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Reuses `WeekStrip`, `RankIcon`, `useMelodyProgress`, `catalogTune`; removes `isCompact`, the waveform and the three-button row instead of keeping two layouts | ✅ |
| II. Test-first | `latestPlace` and `continueTarget`/the last-opened store are pure and tested; the hook and `.tsx` cannot run under the pure-logic runner and were checked on the emulator, as in specs 014, 017, 021 | ✅ (UI by emulator) |
| III. UX consistency | Nocturne tokens only; every control has a role and label; Continue has the same outlined style as Start practice | ✅ |
| IV. Performance | One extra key-value read on focus and one write per melody shown; no network | ✅ |

## Complexity Tracking

| Addition | Why | Simpler alternative rejected because |
|----------|-----|--------------------------------------|
| "Last opened" value beside the saved places | Continue must work before any phrase is answered | Saving a place on open would store a row with no first tries, which `usablePlace` and sync (spec 019) treat as invalid |
| PNG icons in `assets/nav` | The app has no icon font or SVG; a gear cannot be drawn well from Views | `@expo/vector-icons` or `react-native-svg` would need a new native build instead of an OTA update |

## Source Code

```text
src/lib/lastOpened.ts                      # NEW last-opened store helpers + continueTarget
src/lib/melodyProgress.ts                  # + latestPlace
src/lib/streak.ts                          # + weekPracticeDays
src/lib/heroScale.ts                       # - isCompact, COMPACT_BELOW
src/features/progress/useContinueTarget.ts # NEW hook: places + last opened, re-read on focus
src/components/home/HomeNavBar.tsx         # NEW bottom bar
src/components/home/StringsHero.tsx        # NEW the moving, sounding strings
src/lib/openStrings.ts                     # NEW string at a touch, its note, sine keyframes
src/lib/neckNotes.ts                       # NEW notes → neck positions, frets to scale, a pinned string's arc
src/services/melody/neckNotes.ts           # NEW the last answered phrase of a tune as neck positions
src/services/audio/playback.ts             # + pluck (rings alongside, cuts nothing)
assets/nav/*.svg, *.png                    # NEW icons (Tabler outline, MIT)
scripts/build-nav-icons.sh                 # NEW renders the PNGs (rsvg-convert)
app/index.tsx                              # Home rebuilt
app/practice.tsx                           # records / clears the last opened melody
tests/unit/lib/lastOpened.test.ts, openStrings.test.ts, neckNotes.test.ts, tests/unit/melody/neckNotes.test.ts, streak.test.ts, tests/contract/playback.test.ts, melodyProgress.test.ts, heroScale.test.ts
```

## The neck

A stretch of neck drawn from Views: the nut, fret wires at the real 12-tone spacing (they crowd up the neck), inlays
and numbers. Each string is a row of short segments pinned at the nut and the far edge; one looping clock
(`Animated.Value`, native driver) drives a per-string swing (cos, a different phase per string) multiplied by the
string's own amplitude, which a pluck raises and lets fall; a segment's lift and tilt are the arc and slope of a
string pinned at both ends there. About 20 segments a string. Touches go to one responder view (children ignore
them) so the touch height maps straight to a string. The lit notes are the last answered phrase of the tune
(`answeredPhraseNotes`), placed by `neckPositions`; phrases not yet answered are never drawn.

## Risks

- The strings are about 400 native animation nodes; a very modest phone may stutter (T017).

- Layout fit is checked by eye on the emulator; no unit test sees layout.
- "Last opened" is not synced: on a second device only saved places continue.
- Hiding the challenges leaves the Daily Challenges screen reachable only by a deep link until the flag is turned on.
