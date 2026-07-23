// Difficulty level configuration (FR-010). The full 2→8-note ladder (US2) extends this;
// the correctness-core slice seeds the default L1 level only.
import { DifficultyLevel } from '../../models';

/** Easiest level: 2 notes, small diatonic set, slow tempo. */
export const L1: DifficultyLevel = {
  id: 'L1',
  rank: 1,
  noteCount: 2,
  scale: 'C_major_pentatonic',
  rangeLowMidi: 60, // C4
  rangeHighMidi: 72, // C5
  tempoBpm: 60,
};

const LEVELS: Record<string, DifficultyLevel> = { [L1.id]: L1 };

/** Look up a seeded difficulty level by id. */
export function getLevel(id: string): DifficultyLevel {
  const level = LEVELS[id];
  if (!level) {
    throw new Error(`Unknown difficulty level: "${id}"`);
  }
  return level;
}

/** All seeded levels ordered by rank. */
export function allLevels(): DifficultyLevel[] {
  return Object.values(LEVELS).sort((a, b) => a.rank - b.rank);
}
