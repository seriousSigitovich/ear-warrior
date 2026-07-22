# Contract: Grading Engine

**Module**: `src/services/grading/` (pure, no IO) with helpers in `src/lib` (pitch↔note, segmentation)
**Consumers**: `features/practice` (grading state)

Compares a captured attempt against the target melody and produces per-note results and an overall
verdict (FR-005, FR-006, FR-016). This is the correctness core of the product.

## Interface

```ts
// Stage 1 (src/lib): pitch stream → discrete notes (R3)
function segmentFrames(frames: PitchFrame[], cfg: SegmentConfig): DetectedNote[];

// Stage 2 (src/services/grading): best-fit align (edit-distance/LCS) + grade (FR-005, R4)
function gradeAttempt(target: Melody, detected: DetectedNote[], cfg: GradingConfig): AttemptGrade;

interface GradingConfig {
  centsTolerance: number;   // fixed 50 (FR-016); a pitch closer to an adjacent semitone never matches
  octaveSensitive: boolean; // default true (spec assumption)
}

interface AttemptGrade {
  noteResults: NoteResult[]; // status: matched | wrong | missed | extra (+ octaveMismatch flag)
  verdict: 'correct' | 'incorrect';
  confidence: number;        // derived from detected clarity
  lowConfidence: boolean;
  timedOut: boolean;
}
```

## Behavioral contract

- Alignment uses **best-fit sequence alignment** (edit-distance / longest-common-subsequence) between the
  played and target sequences (FR-005); a played note counts as `matched` iff it aligns to a target note
  that maps to the same MIDI note within `centsTolerance`.
- A note one semitone (or more) from the target is `wrong`, never `matched` (FR-016 — tolerance is a
  fixed ±50 cents).
- The alignment classifies unaligned notes locally: a target with no aligned played note is `missed`; a
  played note with no aligned target is `extra`. A single inserted or omitted note MUST NOT cascade the
  surrounding correctly-aligned notes to `wrong` (FR-005).
- Correct pitch class in the wrong octave sets `octaveMismatch=true` and, when `octaveSensitive`,
  status `wrong` (edge case + assumption).
- `verdict === 'correct'` **iff** all target positions are `matched` and there are no `extra` notes.
- Empty/insufficient input → `timedOut=true`; unreliable capture → `lowConfidence=true`. Neither is
  graded as a normal `incorrect`; the loop offers retry (FR-015, FR-017).
- Fully deterministic and side-effect-free.

## Test intent (required — test-first, highest-value)

Table-driven unit tests are written **before** the implementation and cover: exact match, one wrong note,
missing note, extra note, **a mid-phrase insertion/omission that must not cascade** (FR-005), octave
mismatch, the ±50-cent boundary (matched just inside, wrong just outside), timeout, and low-confidence.
This is the highest-value suite in the project and the reason grading is kept pure.
