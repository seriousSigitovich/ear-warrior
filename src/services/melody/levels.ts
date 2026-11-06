// Difficulty ladder (FR-010): nine ranks. A rank is a set of whole melodies, easiest to hardest across
// the ladder (docs/melody-library-100.md); each tune in the library (`library.abc`) names its own level.
// There is no cap on a melody's notes, and each tune carries its own tempo.
import { DifficultyLevel } from '../../models';

/** Lowest rank on the ladder. */
export const MIN_RANK = 1;
/** Highest rank on the ladder. */
export const MAX_RANK = 9;

const LADDER: DifficultyLevel[] = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => ({
  id: `L${MIN_RANK + i}`,
  rank: MIN_RANK + i,
}));

const BY_ID: Record<string, DifficultyLevel> = Object.fromEntries(LADDER.map((l) => [l.id, l]));

/** Easiest level. Kept as a named export for the introductory/default case. */
export const L1: DifficultyLevel = LADDER[0];

/** Look up a difficulty level by id. */
export function getLevel(id: string): DifficultyLevel {
  const level = BY_ID[id];
  if (!level) {
    throw new Error(`Unknown difficulty level: "${id}"`);
  }
  return level;
}

/** Look up a difficulty level by rank — the lookup the adaptation reducer drives. */
export function getLevelByRank(rank: number): DifficultyLevel {
  const level = Number.isInteger(rank) ? LADDER[rank - MIN_RANK] : undefined;
  if (!level) {
    throw new Error(`Rank ${rank} is outside the ladder ${MIN_RANK}–${MAX_RANK}.`);
  }
  return level;
}

/** All levels ordered by rank. */
export function allLevels(): DifficultyLevel[] {
  return [...LADDER];
}
