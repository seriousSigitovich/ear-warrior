// Home's neck (spec 023): where the notes of a phrase sit on it, how it is drawn to scale, and the shape of a string
// pinned at both ends. Pure.
import { FRET_COUNT, FretPosition, STRING_COUNT, positionsForMidi } from './fretboard';

/**
 * A position on the neck for each note, in order. A melody can be played in many places; this picks one that
 * keeps to the string nearest the last note, so a phrase reads as a line along the neck. A note off the board has
 * no position and is left out. Decoration only: the answer is never taken from here.
 */
export function neckPositions(midis: readonly number[]): FretPosition[] {
  const out: FretPosition[] = [];
  let prev = (STRING_COUNT - 1) / 2;
  for (const midi of midis) {
    const options = positionsForMidi(midi);
    if (options.length === 0) continue;
    const best = options.reduce((a, b) => {
      const da = Math.abs(a.string - prev);
      const db = Math.abs(b.string - prev);
      return db < da || (db === da && b.fret < a.fret) ? b : a;
    });
    out.push(best);
    prev = best.string;
  }
  return out;
}

/** Frets are drawn to scale: this many fret widths of the first fret's width fit before the neck's end. */
const VISIBLE_FRETS = FRET_COUNT - 0.5;

/** The x of the nut (0) and of each fret wire 1…12, for a neck `length` long: they crowd up the neck. */
export function fretEdges(length: number): number[] {
  const scale = 1 - 2 ** (-VISIBLE_FRETS / 12);
  return Array.from({ length: FRET_COUNT }, (_, n) => (length * (1 - 2 ** (-n / 12))) / scale);
}

/** Where a finger on `fret` is: in the space before its wire (the nut itself for an open string). */
export function fretCentre(fret: number, edges: readonly number[]): number {
  return fret <= 0 ? 0 : (edges[fret - 1] + edges[fret]) / 2;
}

/**
 * A string pinned at both ends swings in one arc: how far (`lift`, 0 at the ends, 1 in the middle) and how steeply
 * (`slope`, per unit of swing, in radians for a swing of one unit per unit of length) at `x` along `length`.
 */
export function standingWave(x: number, length: number): { lift: number; slope: number } {
  const a = (Math.PI * x) / length;
  return { lift: Math.sin(a), slope: (Math.PI / length) * Math.cos(a) };
}
