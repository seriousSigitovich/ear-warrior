// Classifies a melody from its notes alone (pure, no IO): which base it is built on, its length, range
// and widest leap. The base comes from the pitch-class set, so a label can never disagree with the
// notes. Used to build and audit the melody library.
import { pitchClass } from '../../lib/pitchNote';
import { ROOT_PC, scalePitchClasses } from './scales';

/**
 * `pentatonic`: every note fits one 5-note scale. `diatonic`: every note fits one major / natural
 * minor / harmonic minor scale (so any mode of the major scale, Dorian included). `chromatic`:
 * the notes need more than one key.
 */
export type Base = 'pentatonic' | 'diatonic' | 'chromatic';

export interface ParsedNote {
  midi: number;
  beats: number;
}

/** Parses "pitch:beats" tokens, e.g. "E4:1 D4:2". @throws on a malformed token. */
export function parseMelody(notes: string): ParsedNote[] {
  return notes
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [name, beatsText] = token.split(':');
      const match = name.match(/^([A-G][#b]?)(-?\d)$/);
      const beats = Number(beatsText);
      if (!match || ROOT_PC[match[1]] === undefined || !(beats > 0)) {
        throw new Error(`Bad note token "${token}".`);
      }
      return { midi: ROOT_PC[match[1]] + 12 * (Number(match[2]) + 1), beats };
    });
}

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Tried in order, narrowest first: a tune that fits a pentatonic also fits a diatonic scale. */
const TIERS: { base: Exclude<Base, 'chromatic'>; families: string[] }[] = [
  { base: 'pentatonic', families: ['major_pentatonic', 'minor_pentatonic'] },
  { base: 'diatonic', families: ['major', 'natural_minor', 'harmonic_minor'] },
];

export interface Classification {
  noteCount: number;
  base: Base;
  /** Every `<Root>_<family>` of the base's tier that holds all the notes; empty for chromatic. */
  scales: string[];
  /** Largest jump between neighbouring notes, in semitones. */
  maxLeap: number;
  /** Highest minus lowest note, in semitones. */
  range: number;
}

/** @throws on an empty melody. */
export function classify(midis: readonly number[]): Classification {
  if (midis.length === 0) throw new Error('Cannot classify an empty melody.');
  const used = Array.from(new Set(midis.map(pitchClass)));
  let maxLeap = 0;
  for (let i = 1; i < midis.length; i++) {
    maxLeap = Math.max(maxLeap, Math.abs(midis[i] - midis[i - 1]));
  }
  const shape = {
    noteCount: midis.length,
    maxLeap,
    range: Math.max(...midis) - Math.min(...midis),
  };
  for (const tier of TIERS) {
    const scales = tier.families
      .flatMap((family) => ROOTS.map((root) => `${root}_${family}`))
      .filter((name) => {
        const held = scalePitchClasses(name);
        return used.every((pc) => held.includes(pc));
      });
    if (scales.length > 0) return { ...shape, base: tier.base, scales };
  }
  return { ...shape, base: 'chromatic', scales: [] };
}

/** Lowest and highest note of the 12-fret neck (E2–E5). */
export const NECK_LOW_MIDI = 40;
export const NECK_HIGH_MIDI = 76;

/** Moves a melody by whole octaves, as little as possible, onto the neck; undefined when it does not fit. */
export function fitToNeck(midis: readonly number[]): number[] | undefined {
  const low = Math.min(...midis);
  const high = Math.max(...midis);
  for (const octaves of [0, -1, 1, -2, 2, -3, 3]) {
    const shift = 12 * octaves;
    if (low + shift >= NECK_LOW_MIDI && high + shift <= NECK_HIGH_MIDI) return midis.map((m) => m + shift);
  }
  return undefined;
}
