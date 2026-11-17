// Every number of the reward system (spec 024, FR-019) lives here and nowhere else: the pass mark, what a phrase
// pays, how much harder levels multiply it, what retries and hints cost, the daily cap and the rank thresholds.
// Change a number and the next check pays by it; the tests in config.test.ts keep the set of numbers coherent.

/** A phrase counts as passed from this share of its notes landed (percent). */
export const PASS_ACCURACY = 80;

/** Per phrase: base, plus the extra at 90 % and the extra at 100 %. */
export const PHRASE_XP = { base: 10, accuracy90: 5, accuracy100: 5 } as const;

/** XP multiplier of each difficulty level, index 0 = level 1. Grows faster than linearly: hard melodies pay for hard. */
export const LEVEL_MULT: readonly number[] = [1, 1.5, 2, 3, 4, 6, 8, 11, 15];

/** Share of the payout kept by the 1st, 2nd and 3rd-or-later passing attempt of a phrase. */
export const ATTEMPT_FACTOR: readonly number[] = [1, 0.5, 0];

/** The first-note hint halves the payout; showing the answer pays nothing. */
export const HINT_FACTOR = 0.5;
export const ANSWER_FACTOR = 0;

/** Base XP (before the level multiplier) paid in full per local day; what exceeds it is paid at the overflow factor. */
export const DAILY_CAP_BASE = 300;
export const CAP_OVERFLOW_FACTOR = 0.5;

export interface RankDef {
  id: string;
  name: string;
  /** Total XP at which the rank is reached — the only condition. */
  xp: number;
}

export const RANKS: readonly RankDef[] = [
  { id: 'beginner', name: 'Beginner', xp: 0 },
  { id: 'apprentice', name: 'Apprentice', xp: 100 },
  { id: 'listener', name: 'Listener', xp: 450 },
  { id: 'musician', name: 'Musician', xp: 2000 },
  { id: 'virtuoso', name: 'Virtuoso', xp: 5000 },
  { id: 'maestro', name: 'Maestro', xp: 12000 },
  { id: 'mozart', name: 'Mozart', xp: 32000 },
];

/**
 * Tunes up to this level ship inside the app WITH their answer, so a new learner can play at once, offline. The server
 * still re-grades every check for XP; what this gives up is only that these answers can be read from the app. The test
 * in config.test.ts keeps it harmless: all the XP those levels can ever pay stays below the rank where it would matter.
 */
export const LOCAL_ANSWER_MAX_LEVEL = 2;

/** Highest difficulty level (levels run 1..MAX_LEVEL). */
export const MAX_LEVEL = LEVEL_MULT.length;

/** The most XP one phrase of `level` can pay: base + both bonuses, first attempt, no hint, under the cap. */
export const maxPhraseXp = (level: number): number =>
  (PHRASE_XP.base + PHRASE_XP.accuracy90 + PHRASE_XP.accuracy100) * LEVEL_MULT[level - 1];
