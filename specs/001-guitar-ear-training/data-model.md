# Phase 1 Data Model: Guitar Ear Training

**Feature**: 001-guitar-ear-training | **Date**: 2026-07-22

Derived from the spec's Key Entities and Functional Requirements. Local SQLite (`expo-sqlite`) is the
offline cache and the practice loop's authoritative store; the Node/Postgres backend holds the durable
copies — the `attempt_log` table is a downstream anonymized projection (see
`contracts/attempt-log.md`), and `sync_documents` is a lossless mirror of the on-device RowStore synced
via `/api/sync`. Types shown are conceptual; `src/models/` holds the TypeScript definitions.

---

## Entity overview

```text
DifficultyLevel ──< Melody ──< Attempt >── Session
      ▲                           │
      │                     (per-note results)
DifficultySettings          ProgressProfile = aggregate(Attempt, Session)
 (singleton: mode,
  adaptiveRank, fixedRank,
  streak)
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

Named configuration controlling generation (FR-010). Exactly **7 static levels, rank 1–7**, differing in
**melody length only** — every other field holds the same constant at every rank.

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `"L1"`…`"L7"`, derived from `rank` |
| `rank` | int 1–7 | ordering for adaptation (US2) |
| `noteCount` | int | **`rank + 1`** → 2 notes at rank 1 … 8 at rank 7 (SC-005) |
| `scale` | string | constant `"C_major"` at every rank |
| `rangeLowMidi` / `rangeHighMidi` | int | constant `60` / `72` (C4–C5) at every rank |
| `tempoBpm` | int | constant `60` at every rank |

**Validation**: `2 ≤ noteCount ≤ 8` and `noteCount === rank + 1`; `rank` unique and contiguous 1–7;
`scale`/range/tempo identical across all levels. Seeded as static config; not user-editable this phase
(manual override selects an existing level — FR-011b).

**Invariant worth asserting in tests**: the fixed pool yields 8 distinct pitches (C D E F G A B C), which
must remain ≥ 2 for the no-consecutive-repeats rule (FR-001) and is comfortably above the rank-7 need.

## DifficultySettings

The learner's persisted difficulty state (FR-011, FR-011a, FR-011b). Single row per install — this is the
authoritative state adaptation reads and writes, deliberately **not** derived from Session.

| Field | Type | Notes |
|-------|------|-------|
| `mode` | enum `adaptive` \| `fixed` | FR-011; persisted across restarts |
| `adaptiveRank` | int 1–7 | rank adaptive mode last held; **independent** of `fixedRank` |
| `fixedRank` | int 1–7 | manual selection; any rank, no unlock gating (FR-011b) |
| `streakKind` | enum `correct` \| `incorrect` \| `none` | which streak is currently running |
| `streakCount` | int ≥ 0 | consecutive qualifying attempts of `streakKind` |

**Validation**: both ranks clamp to 1–7. `streakCount` resets to 0 (and `streakKind` to `none`) on any
rank change. Writing `fixedRank` MUST NOT modify `adaptiveRank` — switching adaptive → fixed → adaptive
resumes at the stored `adaptiveRank` (FR-011b).

**Effective rank**: `mode === 'fixed' ? fixedRank : adaptiveRank`. This is what the generator receives.

**Defaults on first launch** (no history): `mode: 'adaptive'`, `adaptiveRank: 1`, `fixedRank: 1`,
`streakKind: 'none'`, `streakCount: 0`. Rank 1 (2 notes) is also the level US1 runs at before US2 ships, so
the US1-only build and a brand-new learner see the same starting difficulty.

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
| `confidence` | number 0–1 | **minimum** per-note clarity (each note = median frame clarity over its window); low → offer retry (FR-017) |
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

**Streak eligibility (FR-011a)**: an attempt feeds difficulty adaptation only when it is graded
(`!timedOut && !lowConfidence`) **and** is the first graded attempt for its `melodyId`. This is *derived*,
not a stored column — no earlier graded `Attempt` exists with the same `melodyId`. The practice loop knows
this directly (it tracks whether the learner pressed retry), and the storage layer can recompute it, so the
two agree without denormalization. Ineligible attempts are still persisted (FR-012) and still count toward
progress statistics (FR-013).

## Session

A continuous practice run (FR-018).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (uuid) | |
| `startedAt` / `endedAt` | ISO timestamp | `endedAt` null while active |
| `difficultyMode` | enum `adaptive` \| `fixed` | mode in effect when the session ran (historical record) |
| `currentDifficultyId` | string → DifficultyLevel.id | effective rank at session end (historical record) |
| `attemptCount` | int | denormalized summary |
| `accuracyPct` | number 0–100 | denormalized summary |

**State transitions**: `active → paused → active → ended`. Completed attempts persist across pause and
app interruption (interrupted-session edge case). `ended` is terminal.

**Note on authority**: `difficultyMode` / `currentDifficultyId` are a **historical snapshot** of the
session, not live state. `DifficultySettings` is the single authoritative source that adaptation reads and
writes, so difficulty survives independently of any session lifecycle (FR-011b).

## ProgressProfile (derived — not a base table)

Aggregated view over Sessions/Attempts for the single local learner (FR-013, US3). Computed by queries,
not stored as authoritative state.

| Field | Type | Source |
|-------|------|--------|
| `accuracyTrend` | (date, accuracyPct)[] | grouped by session/day |
| `practiceVolume` | { totalAttempts, totalSessions, totalMinutes } | sums |
| `difficultyReached` | DifficultyLevel.rank | **highest rank the learner has ever held** (max effective rank across attempt history) — a single unambiguous definition, not a second success threshold |
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
- `Attempt.melodyId → Melody.id`, `Attempt.sessionId → Session.id`. Melodies are stored in their own
  `melodies` table, upserted by id alongside each attempt, so a retry re-saves the same row and a stored
  `melodyId` always resolves. `Session` mutations (tally, `endedAt`) are written **only** by `useSession`;
  attempt persistence never touches the Session row.
- `Session.currentDifficultyId → DifficultyLevel.id`
- `DifficultySettings.adaptiveRank` / `.fixedRank → DifficultyLevel.rank` (singleton row, no session FK)
- Deleting a Session cascades its Attempts (local only). Backend `attempt_log` rows are independent and immutable.
- **Level-id stability**: level ids are derived from `rank` (`"L" + rank`) and the ladder is fixed at 7
  ranks, so stored `difficultyId` values stay resolvable. If a future phase renumbers or removes ranks, the
  migration MUST preserve historical `Melody.difficultyId` values — either by keeping retired ids
  resolvable or by remapping stored rows — so past attempts remain readable.
