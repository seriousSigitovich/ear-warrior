# Contract: Grading Engine

**Module**: `src/services/grading/` (pure, no IO) with helpers in `src/lib` (pitch↔note)
**Consumers**: `features/practice` (grading state)

Compares a tapped answer against the target melody and produces per-note results and an overall
verdict (FR-005, FR-006, FR-016). This is the correctness core of the product.

## Interface

```ts
// src/services/grading: best-fit align (edit-distance/LCS) + grade (FR-005, FR-016).
// `detected` comes from `tapsToDetected` (src/lib/fretboard.ts).
function gradeAttempt(target: Melody, detected: DetectedNote[], cfg: GradingConfig): AttemptGrade;

interface GradingConfig {
  centsTolerance: number;   // legacy (microphone era); matching is by exact MIDI number (FR-016)
  octaveSensitive: boolean; // default true (spec assumption)
  lowConfidenceThreshold: number; // legacy; a tap has clarity 1, so never trips
}

interface AttemptGrade {
  noteResults: NoteResult[]; // status: matched | wrong | missed | extra (+ octaveMismatch flag)
  verdict: 'correct' | 'incorrect';
  confidence: number;        // minimum per-note clarity — always 1 for taps; persisted for older rows
  lowConfidence: boolean;    // always false for taps
  timedOut: boolean;         // true only for an empty answer, which the loop never submits
}
```

## Behavioral contract

- Alignment uses **best-fit sequence alignment** (edit-distance / longest-common-subsequence) between the
  played and target sequences (FR-005); a played note counts as `matched` iff it aligns to a target note
  that maps to the same MIDI note.
- A note one semitone (or more) from the target is `wrong`, never `matched` (FR-016).
- The alignment classifies unaligned notes locally: a target with no aligned played note is `missed`; a
  played note with no aligned target is `extra`. A single inserted or omitted note MUST NOT cascade the
  surrounding correctly-aligned notes to `wrong` (FR-005).
- Correct pitch class in the wrong octave sets `octaveMismatch=true` and, when `octaveSensitive`,
  status `wrong` (edge case + assumption).
- `verdict === 'correct'` **iff** all target positions are `matched` and there are no `extra` notes.
- An empty answer grades as `timedOut=true`; the practice loop never submits one (Check needs ≥ 1 note).
- Fully deterministic and side-effect-free.

## Test intent (required — test-first, highest-value)

Table-driven unit tests are written **before** the implementation and cover: exact match, one wrong note,
missing note, extra note, **a mid-phrase insertion/omission that must not cascade** (FR-005), octave
mismatch, an adjacent-semitone note (wrong) and an empty answer.
This is the highest-value suite in the project and the reason grading is kept pure.
