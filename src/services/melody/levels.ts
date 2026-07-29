// Difficulty level configuration (FR-010, SC-005). The ladder is exactly 7 ranks that differ in
// melody length ONLY: `noteCount = rank + 1`, so 2 notes at rank 1 up to 8 at rank 7. Every rank
// shares one fixed pitch pool and tempo — see research R11 for why range/scale/tempo do not vary.
import { DifficultyLevel } from '../../models';

/** Lowest rank on the ladder. */
export const MIN_RANK = 1;
/** Highest rank on the ladder. */
export const MAX_RANK = 7;

// ---- The fixed pool, shared by every rank ----

/**
 * C major diatonic. Confined to one octave below, it contains no duplicate note names, so
 * octave-sensitive matching cannot produce an octave-mismatch failure from a generated target.
 */
export const FIXED_SCALE = 'C_major';
/** C4. */
export const FIXED_RANGE_LOW_MIDI = 60;
/** C5 — one octave up, yielding 8 distinct pitches (C D E F G A B C). */
export const FIXED_RANGE_HIGH_MIDI = 72;
/**
 * Rhythm is not graded, so tempo is a constant rather than a difficulty dimension. Set to 90 BPM
 * (Phase 0 musicality): at 60 BPM an 8-note melody runs 8 s and the ear stops hearing it as one
 * phrase; ~90 keeps the longest ladder melody short enough to perceive as a whole.
 */
export const FIXED_TEMPO_BPM = 90;

function levelForRank(rank: number): DifficultyLevel {
  return {
    id: `L${rank}`,
    rank,
    noteCount: rank + 1,
    scale: FIXED_SCALE,
    rangeLowMidi: FIXED_RANGE_LOW_MIDI,
    rangeHighMidi: FIXED_RANGE_HIGH_MIDI,
    tempoBpm: FIXED_TEMPO_BPM,
  };
}

const LADDER: DifficultyLevel[] = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) =>
  levelForRank(MIN_RANK + i),
);

const BY_ID: Record<string, DifficultyLevel> = Object.fromEntries(LADDER.map((l) => [l.id, l]));

/** Easiest level: 2 notes. Kept as a named export for the introductory/default case. */
export const L1: DifficultyLevel = LADDER[0];

/** Look up a difficulty level by id. */
export function getLevel(id: string): DifficultyLevel {
  const level = BY_ID[id];
  if (!level) {
    throw new Error(`Unknown difficulty level: "${id}"`);
  }
  return level;
}

/** Look up a difficulty level by rank (1–7) — the lookup the adaptation reducer drives. */
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
