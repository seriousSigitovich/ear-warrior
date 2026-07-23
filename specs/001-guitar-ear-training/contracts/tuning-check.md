# Contract: Tuning Check

**Module**: `src/lib/tuning.ts` (pure rule) + `src/features/practice/tuning.ts` (warning/reference-tone wiring)
**Consumers**: `features/practice` (capturing → grading transition)

Detects when the guitar is **consistently out of tune** and surfaces an **advisory** warning with a
reference tone before grading (FR-014). The detection rule is pure and separable from the reference-tone
playback (which reuses `contracts/audio-playback.md`).

## Interface

```ts
interface TuningConfig {
  centsThreshold: number;   // default ~35; calibratable — magnitude of a systematic offset
  minNotes: number;         // default 3; calibratable — min notes required to judge
}

interface TuningWarning {
  outOfTune: boolean;       // true when a systematic offset is detected
  medianCents: number;      // median signed cents offset across the detected notes
  direction: 'sharp' | 'flat' | 'none';
}

// Pure: judge an attempt's detected notes for a systematic detune.
function detectConsistentDetune(detected: DetectedNote[], cfg: TuningConfig): TuningWarning;
```

## Behavioral contract

- `outOfTune` is true **iff** at least `minNotes` notes are present AND the **median signed cents
  offset** across the detected notes exceeds `centsThreshold` in magnitude AND the offsets are **mostly
  the same direction** (sharp or flat) — a systematic offset, not a single sharp/flat note or scattered
  intonation.
- A single out-of-tune note, or offsets that cancel across directions, MUST NOT trigger the warning.
- Fewer than `minNotes` detected notes → `outOfTune=false` (insufficient evidence).
- The warning is **advisory**: the app shows it and offers the reference tone before grading, but the
  learner MAY dismiss it and proceed — grading is **NOT** blocked pending a retune (FR-014 clarification,
  Session 2026-07-23).
- `detectConsistentDetune` is fully deterministic and side-effect-free; thresholds are calibratable
  config (empirically tuned on-device per research R5), not hard-coded literals.

## Test intent (required — test-first)

Table-driven unit tests are written **before** the implementation (T021A) and cover: a systematic sharp
offset above threshold (warns), a systematic flat offset (warns), a single sharp note among in-tune notes
(no warn), scattered offsets that cancel (no warn), just under threshold (no warn), and fewer than
`minNotes` notes (no warn). The reference-tone playback and advisory dismissal are exercised through the
practice-loop wiring against the mocked native player (`expo-audio`) playback boundary.
