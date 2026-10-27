// Difficulty ladder (FR-010): nine ranks, each with the number of notes a melody at that rank has
// and the tempo it is played at. The melodies themselves come from the curated library
// (`curated.ts`), which assigns every tune to a rank.
import { DifficultyLevel } from '../../models';

/** Lowest rank on the ladder. */
export const MIN_RANK = 1;
/** Highest rank on the ladder. */
export const MAX_RANK = 9;

/**
 * Rhythm is played but not graded, so tempo stays constant rather than being a difficulty knob.
 * 90 BPM keeps a 10-note phrase short enough to hear as one gesture.
 */
export const TEMPO_BPM = 90;

/** Notes per melody at ranks 1–9. */
const NOTE_COUNTS = [3, 4, 6, 4, 6, 8, 6, 8, 10];

const LADDER: DifficultyLevel[] = NOTE_COUNTS.map((noteCount, i) => ({
  id: `L${MIN_RANK + i}`,
  rank: MIN_RANK + i,
  noteCount,
  tempoBpm: TEMPO_BPM,
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
