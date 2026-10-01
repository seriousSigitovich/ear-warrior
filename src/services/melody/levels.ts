// Difficulty ladder (FR-010, research R11). Difficulty is what makes a phrase hard to reproduce by
// ear, which is several things at once: vocabulary (pentatonic → major → minor), interval size,
// length, predictability (a repeated motif is easier to hold than a free phrase), and span.
//
// The ladder is a sawtooth through those dimensions: each new vocabulary is introduced with a
// *shorter*, stepwise phrase, then length / leaps / structure grow back before the next one. Within
// a stretch only one or two knobs move per rank, so a stall still points at what got harder.
import { DifficultyLevel, MotifMode, ScaleFamily } from '../../models';

/** Lowest rank on the ladder. */
export const MIN_RANK = 1;
/** Highest rank on the ladder. */
export const MAX_RANK = 9;

/** E3–G5: the register every melody lives in; the tonic sits near its middle (G3–F#4). */
export const RANGE_LOW_MIDI = 52;
export const RANGE_HIGH_MIDI = 79;
/**
 * Rhythm is played but not graded, so tempo stays constant rather than being a difficulty knob.
 * 90 BPM keeps a 10-note phrase short enough to hear as one gesture.
 */
export const TEMPO_BPM = 90;

interface Step {
  noteCount: number;
  scales: ScaleFamily[];
  maxLeap: number;
  maxSpan: number;
  motif: MotifMode;
}

// maxLeap in semitones: 2 = steps (major), 3 = pentatonic steps / minor 3rd, 4–5 = thirds / a
// pentatonic skip, 7 = up to a fifth, 12 = up to an octave.
const STEPS: Step[] = [
  /* 1 */ { noteCount: 3, scales: ['major_pentatonic'], maxLeap: 3, maxSpan: 5, motif: 'none' },
  /* 2 */ { noteCount: 4, scales: ['major_pentatonic'], maxLeap: 5, maxSpan: 7, motif: 'none' },
  /* 3 */ { noteCount: 6, scales: ['major_pentatonic'], maxLeap: 5, maxSpan: 7, motif: 'repeat' },
  /* 4 */ { noteCount: 4, scales: ['major'], maxLeap: 2, maxSpan: 7, motif: 'none' },
  /* 5 */ { noteCount: 6, scales: ['major'], maxLeap: 4, maxSpan: 9, motif: 'sequence' },
  /* 6 */ { noteCount: 8, scales: ['major'], maxLeap: 7, maxSpan: 12, motif: 'sequence' },
  /* 7 */ { noteCount: 6, scales: ['natural_minor'], maxLeap: 4, maxSpan: 9, motif: 'repeat' },
  /* 8 */ { noteCount: 8, scales: ['natural_minor'], maxLeap: 7, maxSpan: 12, motif: 'variation' },
  /* 9 */ {
    noteCount: 10,
    scales: ['major', 'natural_minor'],
    maxLeap: 12,
    maxSpan: 14,
    motif: 'none',
  },
];

const LADDER: DifficultyLevel[] = STEPS.map((step, i) => ({
  id: `L${MIN_RANK + i}`,
  rank: MIN_RANK + i,
  ...step,
  rangeLowMidi: RANGE_LOW_MIDI,
  rangeHighMidi: RANGE_HIGH_MIDI,
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

/** Human label for a level's vocabulary, e.g. "major pentatonic" or "major / natural minor". */
export function describeScales(level: DifficultyLevel): string {
  return level.scales.map((s) => s.replace(/_/g, ' ')).join(' / ');
}

const INTERVAL_NAMES: Record<number, string> = {
  1: 'semitone',
  2: 'whole step',
  3: 'minor third',
  4: 'major third',
  5: 'fourth',
  6: 'tritone',
  7: 'fifth',
  8: 'minor sixth',
  9: 'major sixth',
  10: 'minor seventh',
  11: 'major seventh',
  12: 'octave',
};

/** Human label for a level's largest interval, e.g. 5 → "fourth". */
export function describeLeap(semitones: number): string {
  return INTERVAL_NAMES[semitones] ?? `${semitones} semitones`;
}

const MOTIF_LABELS: Record<MotifMode, string> = {
  repeat: 'repeated motif',
  sequence: 'motif moved up/down',
  variation: 'varied motif',
  none: 'free phrase',
};

/** Human label for how a level's phrases reuse their opening motif. */
export function describeMotif(motif: MotifMode): string {
  return MOTIF_LABELS[motif];
}
