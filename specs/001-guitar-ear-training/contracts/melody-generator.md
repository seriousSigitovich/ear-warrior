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
- Monophonic only (no simultaneous notes); durations derived from `level.tempoBpm`.
- MUST NOT emit a note lacking a bundled playback sample (generator and asset set share the note pool).

## Error modes

| Condition | Contract |
|-----------|----------|
| `noteCount` outside 2–8 | Throw (invalid level config) |
| Empty scale∩range | Throw (misconfigured level) |

## Test intent (required — test-first)

Pure function — unit tests assert output length equals `noteCount`, every note's range/scale membership,
monophony, deterministic output for a fixed `(level, seed)`, and that invalid levels (bad `noteCount`,
empty scale∩range) throw.
