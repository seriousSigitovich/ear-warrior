// Difficulty ladder (FR-010): nine ranks, each with the span of note counts a melody at that rank has
// and the tempo it is played at. The melodies themselves come from the library (`curated.ts`), which
// puts every tune on the rank whose span holds its note count.
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

/** Fewest and most notes a melody at ranks 1–9 has; the spans tile 3–16 notes with no gap. */
const NOTE_SPANS: readonly (readonly [number, number])[] = [
  [3, 3],
  [4, 4],
  [5, 6],
  [7, 7],
  [8, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
];

/** `noteCount` is the top of the rank's span: the most notes a melody at that rank can have. */
const LADDER: DifficultyLevel[] = NOTE_SPANS.map(([, max], i) => ({
  id: `L${MIN_RANK + i}`,
  rank: MIN_RANK + i,
  noteCount: max,
  tempoBpm: TEMPO_BPM,
}));

/** The rank whose span holds `noteCount`, or undefined when no rank does. */
export function rankOfNoteCount(noteCount: number): number | undefined {
  const i = NOTE_SPANS.findIndex(([min, max]) => noteCount >= min && noteCount <= max);
  return i < 0 ? undefined : MIN_RANK + i;
}

/** Notes per melody at `rank` for display: "4" or "5–6". */
export function notesLabel(rank: number): string {
  const [min, max] = NOTE_SPANS[getLevelByRank(rank).rank - MIN_RANK];
  return min === max ? `${min}` : `${min}–${max}`;
}

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
