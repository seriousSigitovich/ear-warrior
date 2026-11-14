# Implementation Plan: A Player on the Answer Screen

**Branch**: `021-pause-resume-playback` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

A row of note circles at the bottom of the answer screen is the player and the editor; the settings icon in the
navigation bar holds the rest. Playback position is one number, **media milliseconds into the melody passed to
`playMelody`** (tempo-1× time, the unit `MediaClock` and a clip's `fromMs` already use). The audio service reports it
(`position()`), stops at it (`pause()`) and starts from it (`playMelody(..., offsetMs)`). The practice loop keeps one
`paused` place, a `cursor` (the placed note chosen for replacement) and the actions `pause`, `resume`, `seek(noteIndex)`;
the row polls `position()` ten times a second while sounding. Everything pure is unit-tested; the service is
contract-tested with the fake native player. UI is plain React Native (`PanResponder`), so it ships over the air.

The design was settled with the owner on 2026-11-14 over several mock-up rounds (left rail, mini-bar, bottom buttons and
a Draft pill were each shown and dropped).

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. Code quality | Reuses `MediaClock`, `scheduleMelody`, the loop's `sound`/`endReplay`; replaces components instead of adding beside them (`FretboardControls`, `DraftSwitch` removed); no new dependency | ✅ |
| II. Test-first | Pure logic (`noteRow`, `replaceTap`) and the audio service (contract tests, fake native player) were written test-first; the hook and `.tsx` components cannot run under the project's pure-logic runner, so their logic lives in pure modules and the screens were checked on the emulator | ✅ (hook/UI by emulator, as in specs 014 and 017) |
| III. UX consistency | Nocturne tokens only; every control has an accessibility role and label; the row is one `adjustable` control with increment/decrement; Draft state stays visible (icon lit, title) | ✅ |
| IV. Performance | Targets below | ✅ |

## Performance targets

- A tap on a circle makes the phrase sound from that note within 150 ms (SC-004): one `stopAll` fade (50 ms) plus a
  `seekTo` and `play`; no work on the JS thread beyond one state update.
- The row's position poll is 10 Hz and runs only while a melody sounds; it stops with the sound.
- No new network, storage or analytics; memory is a few numbers.

## Complexity Tracking

| Addition | Why | Simpler alternative rejected because |
|----------|-----|--------------------------------------|
| `NoteRow` with its own `PanResponder` | Navigation, selection and scrub on one control | A native slider package would need a new AAB instead of an OTA update; the project already ships one `PanResponder` slider (speed) |
| `cursor` in the practice loop | Fix any note without ⌫ and re-typing the rest | Undo-only forces re-entering every note after a mistake in the middle |

## Source Code

```text
src/lib/noteRow.ts                                # NEW note starts, circle state, nearest circle, end rule
src/lib/fretboard.ts                              # + replaceTap
src/services/audio/playback.ts                    # + position(), pause(), offsetMs
src/features/practice/usePracticeLoop.ts          # + paused, pause, resume, seek, position, timeline, cursor
src/components/practice/NoteRow.tsx               # NEW the row: circles, ▶/⏸, backspace key
src/components/practice/SettingsPanel.tsx         # NEW panel and navigation-bar icon
src/components/practice/FretboardAnswer.tsx       # `player` layout (the coached first melody keeps the old one)
src/components/practice/PhraseProgress.tsx        # compact + label override (navigation bar)
src/components/fretboard/Fretboard.tsx            # + selected ring
src/components/controls/TransportControls.tsx     # Replay / Pause / Resume
src/lib/speed.ts                                  # + SPEED_PRESETS
app/practice.tsx                                  # wiring, header, panel
removed: src/components/controls/FretboardControls.tsx, src/components/practice/DraftSwitch.tsx
tests/unit/lib/noteRow.test.ts, tests/unit/lib/fretboard.test.ts, tests/contract/playback.test.ts
```

## Risks

- A mid-note resume may clip the attack of a note (accepted, spec edge case).
- Fit on very short phones is by eye: checked at 360×640 dp on the emulator; no unit test can see layout.
- Check floats over the board's bottom edge and hides the last fret rows while it shows.
