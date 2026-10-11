# Contract: Melody Generator

**Module**: `src/services/melody/` (pure, no IO)
**Consumers**: `features/practice`, `features/difficulty`

Produces a monophonic target `Melody` for a given `DifficultyLevel` (FR-001, R11).

## Interface

```ts
function generateMelody(level: DifficultyLevel, seed?: number): Melody;
```

> **Status (2026-10-11, FR-021)**: this generator is **off in the current version** — the MVP plays a curated
> set (`src/services/melody/curated.ts`) selected by `EXPO_PUBLIC_MELODY_SOURCE`. The contract below is
> unchanged and still tested; it applies again when the flag is set to `generator`. Note its register E3–G5
> is wider than the 12-fret answer neck (E2–E5), so generated F5–G5 cannot be answered on the fretboard.

## Behavioral contract

- Output `notes.length === level.noteCount`.
- Every note's `midi` is within `[level.rangeLowMidi, level.rangeHighMidi]` **and** a member of
  `level.scale`, and within guitar range (~40–88).
- Deterministic given the same `(level, seed)` — enables reproducible replay and future tests.
- Monophonic only (no simultaneous notes); durations derived from `level.tempoBpm` (constant 90 BPM).
- Never emits two identical pitches back-to-back (FR-001), so notes stay separable by pitch change.
- Any in-range MIDI note is playable — tones are synthesized at runtime (Karplus–Strong), so the generator
  is **not** constrained to a pre-rendered asset set.
- Each melody draws from its level's scale families in the register E3–G5 (research R11); the level
  fixes `noteCount`, `maxLeap`, `maxSpan` and `motif`, and the seed fixes the key.

## Error modes

| Condition | Contract |
|-----------|----------|
| `noteCount` outside 2–8 | Throw (invalid level config) |
| Empty scale∩range | Throw (misconfigured level) |

## Test intent (required — test-first)

Pure function — unit tests assert output length equals `noteCount`, every note's range/scale membership,
monophony, deterministic output for a fixed `(level, seed)`, and that invalid levels (bad `noteCount`,
empty scale∩range) throw.
