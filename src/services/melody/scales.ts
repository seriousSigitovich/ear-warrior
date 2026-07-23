// Scale definitions as pitch-class sets, keyed by "<Root>_<name>" (pure, no IO).
import { pitchClass } from '../../lib/pitchNote';

const ROOT_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** Interval sets (semitones from the root) for supported scale families. */
const SCALE_INTERVALS: Record<string, number[]> = {
  major_pentatonic: [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
};

/**
 * Resolve a scale name like "C_major_pentatonic" to its set of pitch classes (0–11).
 * Throws on an unknown root or scale family.
 */
export function scalePitchClasses(scale: string): number[] {
  const idx = scale.indexOf('_');
  if (idx <= 0) {
    throw new Error(`Invalid scale name: "${scale}"`);
  }
  const root = scale.slice(0, idx);
  const family = scale.slice(idx + 1);
  const rootPc = ROOT_PC[root];
  const intervals = SCALE_INTERVALS[family];
  if (rootPc === undefined) {
    throw new Error(`Unknown scale root: "${root}"`);
  }
  if (!intervals) {
    throw new Error(`Unknown scale family: "${family}"`);
  }
  return intervals.map((i) => pitchClass(rootPc + i));
}
