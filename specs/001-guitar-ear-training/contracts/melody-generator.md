# Contract: Melody Generator

**Module**: `src/services/melody/` (pure, no IO)
**Consumers**: `features/practice`, `features/difficulty`

Produces a monophonic target `Melody` for a given `DifficultyLevel` (FR-001, R11).

## Interface

```ts
function generateMelody(level: DifficultyLevel, seed?: number): Melody;
```

## Behavioral contract

- Output `notes.length === level.noteCount`.
- Every note's `midi` is within `[level.rangeLowMidi, level.rangeHighMidi]` **and** a member of
  `level.scale`, and within guitar range (~40–88).
- Deterministic given the same `(level, seed)` — enables reproducible replay and future tests.
- Monophonic only (no simultaneous notes); durations derived from `level.tempoBpm` (constant 60 BPM).
- Never emits two identical pitches back-to-back (FR-001), so notes stay separable by pitch change.
- Any in-range MIDI note is playable — tones are synthesized at runtime (Karplus–Strong), so the generator
  is **not** constrained to a pre-rendered asset set.
- With the fixed C major C4–C5 pool every level draws from the same 8 pitches; only `noteCount` differs
  (`rank + 1`, 2→8).

## Error modes

| Condition | Contract |
|-----------|----------|
| `noteCount` outside 2–8 | Throw (invalid level config) |
| Empty scale∩range | Throw (misconfigured level) |

## Test intent (required — test-first)

Pure function — unit tests assert output length equals `noteCount`, every note's range/scale membership,
monophony, deterministic output for a fixed `(level, seed)`, and that invalid levels (bad `noteCount`,
empty scale∩range) throw.
