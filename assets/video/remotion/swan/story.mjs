// #63 "97% of guitarists can't play this by ear" — #62's cut (hook · the melody once under the hook's words · your turn; no countdown,
// no answer; the notes land on their real frets, unnumbered) with a new tune and ONE changed idea: the ending no longer asks for the notes
// in a comment, it sends the viewer to check the answer at the link (earwarrior.app/?tune=swan plays this same phrase on its fretboard
// demo and grades it). The open loop closes only in the product. ONE timeline: king/audio.mjs lays the sound from it and
// src/swan/SwanMinimal.tsx draws every frame from it.
export const FPS = 120;
export const DURATION = 7.0;

/** Standard tuning, low → high: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * Tchaikovsky, Swan Lake, the swan theme (public domain), from memory, moved from B minor to E minor: the long fifth; the run up
 * E F♯ G A to it; then it twice more over G. Ends on the open fifth, unresolved — the answer is not in the video.
 * At guitar pitch: frets 0–4 on the A, D and G strings.
 *   B2 A2 | E3 D2 · F#3 D4 · G3 G0 · A3 G2 | B3 G4 · G3 G0 · B3 G4 · G3 G0 · B3 G4
 * Must stay equal to TUNES.swan in landing/index.html.
 */
export const MELODY = [
  { string: 1, fret: 2, beats: 1.5 },
  { string: 2, fret: 2, beats: 0.5 },
  { string: 2, fret: 4, beats: 0.5 },
  { string: 3, fret: 0, beats: 0.5 },
  { string: 3, fret: 2, beats: 0.5 },
  { string: 3, fret: 4, beats: 1.5 },
  { string: 3, fret: 0, beats: 0.5 },
  { string: 3, fret: 4, beats: 1.5 },
  { string: 3, fret: 0, beats: 0.5 },
  { string: 3, fret: 4, beats: 2 },
].map((n) => ({ ...n, midi: midiAt(n.string, n.fret), name: noteName(midiAt(n.string, n.fret)) }));

export const BPM = 140;
export const BEAT = 60 / BPM;
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const STEP = BEAT;                                  // how long a note counts as "just played"
export const NOTE_RING = BEAT + 0.12;

export const T = {
  hook: 0,
  listen: 0.65,         // the pips come in; the hook's words stay up over the melody
  listenAt: 1.0,        // its first note
  hold: 4.6,            // the last note rings; the camera cranes over the board
  cta: 4.8,             // your turn
  sub: 5.1,
  comment: 5.35,        // check it at the link
  sweep: 5.75,          // a closing hairline runs down the strings
};

export const HEARD = MELODY.map((n, i) => ({ ...n, t: T.listenAt + OFFSETS[i], order: i }));

/** The hook's hit on frame 0: the open A string (A2) — as #62, where the hook camera frames it; not one of the melody's spots. */
export const HOOK_NOTE = { string: 1, fret: 0, midi: midiAt(1, 0) };
/** The soft closing chord: E minor. */
export const CHORD = [64, 67, 71];
