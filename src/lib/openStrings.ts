// Home's open strings (spec 023): which string a touch is on, the note it sounds, and the sine the strings are
// drawn with. Pure.
import { OPEN_STRING_MIDI, STRING_COUNT } from './fretboard';

export const STRING_ROWS = STRING_COUNT;

/** The note of row `row` counted from the top: row 0 is the thin high e, the last row the low E. */
export function openStringMidi(row: number): number {
  return OPEN_STRING_MIDI[STRING_COUNT - 1 - row];
}

/** The row (0 = top) a touch `y` from the area's top falls in, for an area `height` tall; clamped to the area. */
export function stringAtY(y: number, height: number): number {
  if (height <= 0) return 0;
  const row = Math.floor((y / height) * STRING_ROWS);
  return Math.min(STRING_ROWS - 1, Math.max(0, row));
}

/**
 * One cycle of a sine sampled `steps` times (steps + 1 values, the last equal to the first), starting `phase` of
 * a cycle in. Driven by one looping clock, each segment of a string takes its own phase from this, so the string
 * reads as a travelling wave.
 */
export function waveKeyframes(phase: number, steps: number): number[] {
  return Array.from({ length: steps + 1 }, (_, j) => Math.sin(2 * Math.PI * (j / steps + phase)));
}
