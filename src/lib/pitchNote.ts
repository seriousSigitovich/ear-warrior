// Pure pitch ↔ note math (FR-016). Reference: concert pitch A4 = 440 Hz, equal temperament.
// No IO, no React Native — directly unit-testable.

/** Concert-pitch reference (A4). */
export const A4_HZ = 440;
/** A4 is MIDI note 69. */
export const A4_MIDI = 69;
/** Lowest standard-guitar note E2. */
export const GUITAR_MIN_MIDI = 40;
/** Highest note the generator/detector guard against, E6. */
export const GUITAR_MAX_MIDI = 88;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Ideal equal-temperament frequency (Hz) for a MIDI note number. */
export function hzFromMidi(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Fractional MIDI value for a frequency (not rounded). */
function fractionalMidi(hz: number): number {
  return 12 * Math.log2(hz / A4_HZ) + A4_MIDI;
}

/** Nearest MIDI note number for a frequency. */
export function midiFromHz(hz: number): number {
  return Math.round(fractionalMidi(hz));
}

/** Signed deviation (cents) of a frequency from its nearest note, in [-50, 50]. */
export function centsFromHz(hz: number): number {
  const frac = fractionalMidi(hz);
  return (frac - Math.round(frac)) * 100;
}

/** Nearest note + cents deviation for a detected frequency. */
export function nearestNote(hz: number): { midi: number; centsOffset: number } {
  return { midi: midiFromHz(hz), centsOffset: centsFromHz(hz) };
}

/** Note name for a MIDI number, e.g. 69 → "A4". */
export function noteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** True when a MIDI note falls within the standard guitar range E2–E6. */
export function isInGuitarRange(midi: number): boolean {
  return midi >= GUITAR_MIN_MIDI && midi <= GUITAR_MAX_MIDI;
}

/** Pitch class (0–11) of a MIDI note. */
export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}
