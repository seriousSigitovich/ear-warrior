# Contract: Difficulty Adaptation

**Module**: `src/features/difficulty/` (pure reducer, no IO)
**Consumers**: `features/practice` (per attempt), `app/settings.tsx` (mode + fixed selection)
**Persistence**: `services/storage` owns reading/writing `DifficultySettings`; this module never touches IO.

Decides the effective difficulty rank and how it moves in response to attempts
(FR-010, FR-011, FR-011a, FR-011b; R13).

## Interface

```ts
type DifficultyMode = 'adaptive' | 'fixed';
type StreakKind = 'correct' | 'incorrect' | 'none';

interface DifficultySettings {
  mode: DifficultyMode;
  adaptiveRank: number;   // 1–7
  fixedRank: number;      // 1–7
  streakKind: StreakKind;
  streakCount: number;    // ≥ 0
}

/** Outcome of one finished attempt, as the practice loop observes it. */
interface AttemptOutcome {
  verdict: 'correct' | 'incorrect';
  graded: boolean;              // false when timedOut or lowConfidence
  isFirstAttemptOnMelody: boolean;  // false for a retry
}

/** The rank the generator should use right now. */
function effectiveRank(s: DifficultySettings): number;

/** Pure transition: returns the next settings. Never mutates its input. */
function applyAttempt(s: DifficultySettings, outcome: AttemptOutcome): DifficultySettings;

/** Manual selection (FR-011b) — must not disturb adaptiveRank. */
function setFixedRank(s: DifficultySettings, rank: number): DifficultySettings;
function setMode(s: DifficultySettings, mode: DifficultyMode): DifficultySettings;
```

## Behavioral contract

**Effective rank**

- `effectiveRank(s) === s.mode === 'fixed' ? s.fixedRank : s.adaptiveRank`.

**Eligibility (FR-011a)** — `applyAttempt` returns the settings **unchanged** when:

- `outcome.graded === false` (low-confidence capture or no-input timeout), **or**
- `outcome.isFirstAttemptOnMelody === false` (a retry), **or**
- `s.mode === 'fixed'` (manual mode never auto-adjusts).

Unchanged means the streak counter is *not* reset and *not* incremented — an ineligible attempt is
invisible to adaptation.

**Streak accumulation** (eligible attempts, adaptive mode only)

- A `correct` verdict extends a `correct` streak, or starts one at 1 if the running streak was
  `incorrect`/`none`.
- An `incorrect` verdict extends an `incorrect` streak, or starts one at 1 likewise.

**Rank movement**

- `correct` streak reaching **3** → `adaptiveRank + 1`, then `streakKind = 'none'`, `streakCount = 0`.
- `incorrect` streak reaching **2** → `adaptiveRank − 1`, then `streakKind = 'none'`, `streakCount = 0`.
- Steps are always exactly ±1 rank.
- **Clamping**: at rank 7 a completed correct streak leaves the rank at 7; at rank 1 a completed incorrect
  streak leaves it at 1. The counter still resets, so the learner does not accumulate a hidden backlog that
  fires the instant the boundary is left.

**Mode and manual selection**

- `setFixedRank` writes only `fixedRank`; `adaptiveRank`, `streakKind`, and `streakCount` are untouched.
- `setMode` writes only `mode`. Switching adaptive → fixed → adaptive therefore resumes at the stored
  `adaptiveRank` (FR-011b).
- `setFixedRank` accepts any rank 1–7 — there is no unlock gating.

**Purity**

- No IO, no clock, no randomness. Same input → same output, so the whole rule is table-testable.

## Error modes

| Condition | Contract |
|-----------|----------|
| `rank` outside 1–7 passed to `setFixedRank` | Throw (caller bug — UI must only offer 1–7) |
| `streakCount` negative in input state | Throw (corrupt persisted state) |
| Rank would move outside 1–7 | Clamp, do not throw (normal boundary case) |

## Test intent (required — test-first)

Pure reducer — unit tests MUST cover:

- `effectiveRank` returns `fixedRank` in fixed mode and `adaptiveRank` in adaptive mode.
- 3 consecutive eligible correct attempts raise the rank by exactly 1; 2 fewer do not.
- 2 consecutive eligible incorrect attempts lower the rank by exactly 1; 1 does not.
- A correct attempt mid-`incorrect`-streak restarts the counter at 1 rather than accumulating.
- The counter resets after every rank change — a 4th consecutive correct attempt does not immediately
  trigger a second promotion.
- Each ineligible outcome (`graded: false`; `isFirstAttemptOnMelody: false`) leaves settings **byte-identical**,
  including the streak counter.
- Fixed mode never adjusts `adaptiveRank`, whatever the outcome sequence.
- Clamping: 3 more correct attempts at rank 7 leave rank 7; 2 more incorrect at rank 1 leave rank 1.
- `setFixedRank` preserves `adaptiveRank`; the adaptive → fixed → adaptive round-trip restores the
  original effective rank.
- Invalid rank input throws; boundary movement clamps instead of throwing.
