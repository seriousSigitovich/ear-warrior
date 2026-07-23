// Difficulty adaptation (contracts/difficulty-adaptation.md; FR-011, FR-011a, FR-011b).
// A pure reducer: no IO, no clock, no randomness — every transition is table-testable. Persistence
// lives in services/storage; this module only computes the next settings value.
import { AttemptOutcome, DifficultySettings, DifficultyMode } from '../../models';
import { MAX_RANK, MIN_RANK } from '../../services/melody/levels';

export { MAX_RANK, MIN_RANK };

/** Consecutive correct attempts that raise the rank. */
export const RAISE_STREAK = 3;
/**
 * Consecutive incorrect attempts that lower the rank. Deliberately lower than RAISE_STREAK: drop a
 * learner out of a too-hard rank quickly, but require real evidence before promoting.
 */
export const LOWER_STREAK = 2;

/** State for a learner with no history (data-model.md). */
export const DEFAULT_DIFFICULTY_SETTINGS: DifficultySettings = {
  mode: 'adaptive',
  adaptiveRank: MIN_RANK,
  fixedRank: MIN_RANK,
  streakKind: 'none',
  streakCount: 0,
};

function assertRank(rank: number): void {
  if (!Number.isInteger(rank) || rank < MIN_RANK || rank > MAX_RANK) {
    throw new Error(`Rank ${rank} is outside the ladder ${MIN_RANK}–${MAX_RANK}.`);
  }
}

function clampRank(rank: number): number {
  return Math.min(MAX_RANK, Math.max(MIN_RANK, rank));
}

/** The rank the generator should use right now. */
export function effectiveRank(settings: DifficultySettings): number {
  return settings.mode === 'fixed' ? settings.fixedRank : settings.adaptiveRank;
}

/**
 * Fold one finished attempt into the difficulty state.
 *
 * Returns the input unchanged when the attempt is ineligible (FR-011a) — a retry, an ungraded
 * capture, or any attempt in fixed mode. "Unchanged" means the streak is neither extended nor
 * reset: an ineligible attempt is invisible to adaptation, so room noise cannot demote a learner
 * and an unlimited retry cannot be ground into a promotion.
 */
export function applyAttempt(
  settings: DifficultySettings,
  outcome: AttemptOutcome,
): DifficultySettings {
  if (!Number.isInteger(settings.streakCount) || settings.streakCount < 0) {
    throw new Error(`Corrupt difficulty state: streakCount ${settings.streakCount}.`);
  }

  const eligible =
    settings.mode === 'adaptive' && outcome.graded && outcome.isFirstAttemptOnMelody;
  if (!eligible) {
    return settings;
  }

  // Extend the running streak, or start a fresh one when the verdict flips.
  const kind = outcome.verdict;
  const count = settings.streakKind === kind ? settings.streakCount + 1 : 1;

  const threshold = kind === 'correct' ? RAISE_STREAK : LOWER_STREAK;
  if (count < threshold) {
    return { ...settings, streakKind: kind, streakCount: count };
  }

  // Threshold reached: move one rank and reset. The reset also applies when the move is clamped at a
  // boundary, so no hidden backlog fires the moment the learner leaves rank 1 or rank 7.
  const step = kind === 'correct' ? 1 : -1;
  return {
    ...settings,
    adaptiveRank: clampRank(settings.adaptiveRank + step),
    streakKind: 'none',
    streakCount: 0,
  };
}

/** Manual level selection. Never disturbs the adaptive rank or the streak (FR-011b). */
export function setFixedRank(settings: DifficultySettings, rank: number): DifficultySettings {
  assertRank(rank);
  return { ...settings, fixedRank: rank };
}

/** Switch mode. Adaptive → fixed → adaptive resumes at the stored adaptive rank (FR-011b). */
export function setMode(settings: DifficultySettings, mode: DifficultyMode): DifficultySettings {
  return { ...settings, mode };
}
