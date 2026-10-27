# Contract: Fretboard Input (tap-to-answer)

**Module**: `src/lib/fretboard.ts` (pure) · `src/features/practice/usePracticeLoop.ts` (loop wiring) ·
`src/components/fretboard/`, `src/components/practice/FretboardAnswer.tsx`,
`src/components/controls/FretboardControls.tsx` (UI)
**Spec**: FR-020 · **Research**: R14 · **Scope**: pure, deterministic, no IO — the one microphone-free
answer path of the app (the microphone input was removed on 2026-10-27). It produces `DetectedNote[]`,
the shape `contracts/grading-engine.md` consumes.

## Input mode

Fretboard is the only input. `PracticeLoopDeps` has no `inputMode`; every attempt is recorded with
`inputMode: 'fretboard'`. (`EXPO_PUBLIC_INPUT_MODE` and the `mic` mode were deleted on 2026-10-27.)

## Geometry

| Constant | Value | Notes |
|----------|-------|-------|
| `OPEN_STRING_MIDI` | `[40, 45, 50, 55, 59, 64]` | E2 A2 D3 G3 B3 E4, string 0 = lowest. Also `STANDARD_TUNING_MIDI` |
| `STRING_COUNT` | 6 | |
| `FRET_COUNT` / `MAX_FRET` | 13 / 12 | open + frets 1–12 (was 16 / 15 until 2026-10-11; fewer rows give taller cells) |
| Reach | MIDI 40–76 (E2–E5) | the register every MVP melody must fit (FR-021). |

`fretMidi({string, fret}) = OPEN_STRING_MIDI[string] + fret`; throws on an invalid position.
`positionsForMidi(midi)` lists every position that sounds a pitch (low string first; empty off the board).

## Taps → graded notes

```ts
interface FretTap { string: number; fret: number; midi: number; atMs: number }

makeTap(position, atMs): FretTap                      // midi from fretMidi
addTap(taps, tap, capacity): FretTap[]                // no-op (same array) once taps.length >= capacity
undoTap(taps): FretTap[]                              // drops the last tap
tapsToDetected(taps): DetectedNote[]                  // → gradeAttempt(melody, detected, cfg)
tapStatuses(noteResults): NoteStatus[]                // grade results aligned back onto the taps
```

- `tapsToDetected`: `midi` from the tap, `frequencyHz = hzFromMidi(midi)`, **`centsOffset = 0`,
  `clarity = 1`**, `startMs` relative to the first tap, `endMs` = next tap's start (or +500 ms for the last).
  `[]` for no taps.
- Grading is **by MIDI, not by position**: two positions sounding one pitch are the same answer.
- `tapStatuses` drops `missed` results (they consume no played note), leaving one status per tap, in order.

## Loop behaviour

- `tapFret(position)` — only in `awaitingInput` with a melody. **Always sounds** the note
  (`playback.playReferenceTone(midi)`, errors swallowed), then adds it via `addTap` — so a full answer can
  still be auditioned before undoing.
- `undoFret()`, `clearFrets()` — edit the answer.
- `submitAnswer()` — no-op unless `awaitingInput`, a melody exists and the answer has ≥ 1 note; otherwise
  `finishAttempt(melody, tapsToDetected(taps))` — grade → persist → adapt.
- `retry()` — clears grade/rank-change and the answer, returns to `awaitingInput`. `next()` also clears the answer.
- No capture, no mic permission, no tuning check; never `timedOut`/`lowConfidence`.
- Every graded attempt carries `inputMode: 'fretboard'` (→ `Attempt.inputMode`, telemetry `input_mode`).

## Audio

The 37 pitches of the neck (MIDI 40–76) are pre-rendered through `AudioPlayback.preload` once the screen
has settled (`InteractionManager.runAfterInteractions`), so a tap sounds immediately. Failure to preload is
non-fatal. Output is the same runtime-synthesized tone as melody playback (R6) — no bundled samples.

## UI contract (summary)

- `FretboardAnswer`: the "Your turn" view while `awaitingInput` — a caption ("N of M placed"), one slot per
  melody note (filled with the note name as it is placed, the next slot highlighted) and the neck to tap.
- `FretboardControls`: Replay · Undo · Clear · Check. Undo, Clear **and Check** are disabled while the
  answer is empty. Each control has an `accessibilityLabel` (SC-009); each fret cell is
  `accessibilityRole="button"` with a label.
- After grading, the result view shows the same `Fretboard` with each tap coloured by its
  `matched` / `wrong` / `extra` status.

## Test intent (required)

Pure logic is unit-tested in `tests/unit/lib/fretboard.test.ts`: `fretMidi` for every string/fret and its
range limits, `positionsForMidi`, `addTap` capacity, `undoTap`, `tapsToDetected` shape and timing, and
`tapStatuses` alignment (including `missed` and `extra`). The loop wiring, the screens and the on-device
feel (tap latency, hit-target size at phone width, VoiceOver) are validated manually via `quickstart.md`
— the jest setup (ts-jest, node env) cannot execute hooks or `.tsx`.
