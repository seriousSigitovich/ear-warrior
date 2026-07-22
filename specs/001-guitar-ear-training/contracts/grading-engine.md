# Contract: Grading Engine

**Module**: `src/services/grading/` (pure, no IO) with helpers in `src/lib` (pitch↔note, segmentation)
**Consumers**: `features/practice` (grading state)

Compares a captured attempt against the target melody and produces per-note results and an overall
verdict (FR-005, FR-006, FR-016). This is the correctness core of the product.

## Interface

```ts
// Stage 1 (src/lib): pitch stream → discrete notes (R3)
function segmentFrames(frames: PitchFrame[], cfg: SegmentConfig): DetectedNote[];

// Stage 2 (src/services/grading): align + grade (R4)
function gradeAttempt(target: Melody, detected: DetectedNote[], cfg: GradingConfig): AttemptGrade;

interface GradingConfig {
  centsTolerance: number;   // default ~40–50 (R4); a full semitone away never matches
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

- Alignment is positional over the ordered sequences; a played note counts as `matched` iff it maps to
  the same MIDI note as the target at that position within `centsTolerance`.
- A note one semitone (or more) from the target is `wrong`, never `matched` (FR-016).
- Fewer detected than target → trailing targets are `missed`; more detected → surplus are `extra`
  (wrong-count edge case).
- Correct pitch class in the wrong octave sets `octaveMismatch=true` and, when `octaveSensitive`,
  status `wrong` (edge case + assumption).
- `verdict === 'correct'` **iff** all target positions are `matched` and there are no `extra` notes.
- Empty/insufficient input → `timedOut=true`; unreliable capture → `lowConfidence=true`. Neither is
  graded as a normal `incorrect`; the loop offers retry (FR-015, FR-017).
- Fully deterministic and side-effect-free.

## Test intent (required — test-first, highest-value)

Table-driven unit tests are written **before** the implementation and cover: exact match, one wrong note,
missing note, extra note, octave mismatch, the ±`centsTolerance` boundary (matched just inside, wrong
just outside), timeout, and low-confidence. This is the highest-value suite in the project and the reason
grading is kept pure.
