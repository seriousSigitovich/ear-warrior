# Phase 1 Data Model: Guitar Ear Training

**Feature**: 001-guitar-ear-training | **Date**: 2026-07-22

Derived from the spec's Key Entities and Functional Requirements. Local SQLite (`expo-sqlite`) is the
source of truth; the Supabase `attempt_log` is a downstream anonymized projection (see
`contracts/supabase-attempt-log.md`). Types shown are conceptual; `src/models/` holds the TypeScript
definitions.

---

## Entity overview

```text
DifficultyLevel ──< Melody ──< Attempt >── Session
                                  │
                              (per-note results)
Session ──< Attempt        ProgressProfile = aggregate(Attempt, Session)
```

---

## Note (value object)

A single pitch. Used both inside a target `Melody` and inside an `Attempt`'s detected sequence.

| Field | Type | Notes |
|-------|------|-------|
| `index` | int ≥ 0 | position in the sequence |
| `midi` | int | MIDI note number; guitar range ≈ 40 (E2) – 88 (E6) |
| `noteName` | string | e.g. `"E4"` (derived from `midi`) |
| `frequencyHz` | number | target = ideal equal-temperament freq; detected = measured median |
| `centsOffset` | number \| null | detected only: deviation from nearest note (null for targets) |
| `durationBeats` | number | target only: relative duration; detected notes omit or estimate |

**Validation**: `midi` within configured guitar range; targets have integer cents (0). Value object —
not a standalone table; serialized within Melody/Attempt rows.

## DifficultyLevel

Named configuration controlling generation (FR-010).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | e.g. `"L1"` |
| `rank` | int | ordering for adaptation (US2) |
| `noteCount` | int | 2 at easiest … up to 8 (SC-005) |
| `scale` | string | e.g. `"C_major_pentatonic"` |
| `rangeLowMidi` / `rangeHighMidi` | int | within guitar range |
| `tempoBpm` | int | playback tempo |

**Validation**: `2 ≤ noteCount ≤ 8`; range within guitar bounds; `rank` unique. Seeded as static
config; not user-editable this phase (manual override selects an existing level — FR-011).

## Melody (Phrase)

An ordered target sequence the learner must reproduce (FR-001).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | |
| `notes` | Note[] | ordered target notes (monophonic) |
| `difficultyId` | string → DifficultyLevel.id | |
| `scale` | string | pool it was drawn from |
| `createdAt` | ISO timestamp | |

**Validation**: `notes.length === difficulty.noteCount`; every note within range and scale. Generated
by `services/melody` (pure); see `contracts/melody-generator.md`.

## Attempt

One captured reproduction of a melody and its grading (FR-005, FR-006, FR-012).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | |
| `sessionId` | string → Session.id | |
| `melodyId` | string → Melody.id | |
| `detectedNotes` | Note[] | segmented from the pitch stream (R3) |
| `noteResults` | NoteResult[] | per-position grading (below) |
| `verdict` | enum `correct` \| `incorrect` | overall (FR-005) |
| `confidence` | number 0–1 | min/mean detection clarity; low → offer retry (FR-017) |
| `lowConfidence` | boolean | true when capture unreliable (FR-017) |
| `timedOut` | boolean | no/insufficient input (FR-015) |
| `createdAt` | ISO timestamp | |

**NoteResult** (value object, aligned to target positions):

| Field | Type | Notes |
|-------|------|-------|
| `targetIndex` | int \| null | null for an `extra` played note |
| `status` | enum `matched` \| `wrong` \| `missed` \| `extra` | FR-005 |
| `expectedMidi` | int \| null | |
| `detectedMidi` | int \| null | |
| `octaveMismatch` | boolean | correct pitch class, wrong octave (edge case) |

**Validation**: `verdict === correct` iff every target position is `matched` and there are no `extra`
notes. A `timedOut` or `lowConfidence` attempt is not graded as `incorrect`; it prompts retry.

## Session

A continuous practice run (FR-018).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | |
| `startedAt` / `endedAt` | ISO timestamp | `endedAt` null while active |
| `difficultyMode` | enum `adaptive` \| `fixed` | US2 |
| `currentDifficultyId` | string → DifficultyLevel.id | evolves in adaptive mode |
| `attemptCount` | int | denormalized summary |
| `accuracyPct` | number 0–100 | denormalized summary |

**State transitions**: `active → paused → active → ended`. Completed attempts persist across pause and
app interruption (interrupted-session edge case). `ended` is terminal.

## ProgressProfile (derived — not a base table)

Aggregated view over Sessions/Attempts for the single local learner (FR-013, US3). Computed by queries,
not stored as authoritative state.

| Field | Type | Source |
|-------|------|--------|
| `accuracyTrend` | (date, accuracyPct)[] | grouped by session/day |
| `practiceVolume` | { totalAttempts, totalSessions, totalMinutes } | sums |
| `difficultyReached` | DifficultyLevel.rank | max rank with sustained success |
| `weakAreas` | { descriptor, missRate }[] | miss rate grouped by melody characteristic (e.g. interval size, length) |

## Practice-loop state (transient, not persisted)

Drives US1 (`features/practice`), aligned to acceptance scenarios:

```text
idle → playingMelody → awaitingInput → capturing → grading → feedback
feedback ─(replay)→ playingMelody
feedback ─(retry)→ awaitingInput
feedback ─(next)→ playingMelody (new melody)
awaitingInput ─(timeout)→ feedback(timedOut)
capturing ─(lowConfidence)→ feedback(offer retry)
```

## Relationships & integrity

- `Melody.difficultyId → DifficultyLevel.id`
- `Attempt.melodyId → Melody.id`, `Attempt.sessionId → Session.id`
- `Session.currentDifficultyId → DifficultyLevel.id`
- Deleting a Session cascades its Attempts (local only). Supabase logs are independent and immutable.
