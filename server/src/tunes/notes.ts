// The answer of a tune is written as "pitch:beats" tokens ("E4:1 D4:2"). The server needs the pitches (to grade)
// and the phrase split (to cut the answer into phrases); rhythm is never graded.

const PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** The fretboard's range (E2–E5): every tune's notes must be answerable on it. */
export const MIN_MIDI = 40;
export const MAX_MIDI = 76;

export interface ParsedNote {
  midi: number;
  beats: number;
}

/** Parses the tokens; null when any token is malformed. */
export function parseNotes(notes: string): ParsedNote[] | null {
  const tokens = notes.trim().split(/\s+/).filter(Boolean);
  const out: ParsedNote[] = [];
  for (const token of tokens) {
    const [name, beatsText] = token.split(':');
    const m = /^([A-G][#b]?)(-?\d)$/.exec(name ?? '');
    const beats = Number(beatsText);
    if (!m || !(beats > 0)) return null;
    out.push({ midi: PITCH_CLASS[m[1]] + 12 * (Number(m[2]) + 1), beats });
  }
  return out;
}

/** The answer's midi notes cut into phrases of the given lengths; null when the lengths do not add up to the notes. */
export function phraseMidis(notes: string, phrases: readonly number[]): number[][] | null {
  const parsed = parseNotes(notes);
  if (!parsed || phrases.reduce((a, b) => a + b, 0) !== parsed.length) return null;
  const out: number[][] = [];
  let at = 0;
  for (const len of phrases) {
    out.push(parsed.slice(at, at + len).map((n) => n.midi));
    at += len;
  }
  return out;
}
