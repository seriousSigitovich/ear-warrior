// "97% of guitarists can't play this by ear" — the neon highway of #56 («Ну, погоди!»), 10.5 s, cut down to hook · the melody once · your
// turn: no countdown, no separate answer; the notes land on their frets, unnumbered. ONE timeline: king/audio.mjs lays the sound from it
// and src/king/KingNeon.tsx draws every frame from it.
export const FPS = 60;
export const DURATION = 10.5;

/** Standard tuning, low → high: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * Grieg, «In the Hall of the Mountain King» (Peer Gynt, 1875 — public domain), the theme's first two bars in B minor, from memory:
 * B C♯ D E F♯ D F♯ | E♯ C♯ E♯ · E C E (eighths, each bar's third and sixth notes a quarter). At guitar
 * pitch: frets 0–4 on the A and D strings, no shifts.
 *   B2 A2 · C#3 A4 · D3 D0 · E3 D2 · F#3 D4 · D3 D0 · F#3 D4 | F3 D3 · C#3 A4 · F3 D3 · E3 D2 · C3 A3 · E3 D2
 */
export const MELODY = [
  { string: 1, fret: 2, beats: 0.5 },
  { string: 1, fret: 4, beats: 0.5 },
  { string: 2, fret: 0, beats: 0.5 },
  { string: 2, fret: 2, beats: 0.5 },
  { string: 2, fret: 4, beats: 0.5 },
  { string: 2, fret: 0, beats: 0.5 },
  { string: 2, fret: 4, beats: 1 },
  { string: 2, fret: 3, beats: 0.5 },
  { string: 1, fret: 4, beats: 0.5 },
  { string: 2, fret: 3, beats: 1 },
  { string: 2, fret: 2, beats: 0.5 },
  { string: 1, fret: 3, beats: 0.5 },
  { string: 2, fret: 2, beats: 1 },
].map((n) => ({ ...n, midi: midiAt(n.string, n.fret), name: noteName(midiAt(n.string, n.fret)) }));

export const BPM = 120;
export const BEAT = 60 / BPM;
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const STEP = BEAT;                                  // how long a note counts as "just played"
export const NOTE_RING = BEAT + 0.12;

export const T = {
  hook: 0,
  listen: 2.4,          // scene 2: hear the melody, once
  listenAt: 2.75,       // its first note
  hold: 6.6,            // the last note rings; the camera holds, then cranes over the board
  cta: 7.05,            // scene 3: your turn
  sub: 7.55,
  comment: 8.05,
  sweep: 8.9,           // a light pulse runs down the strings
};

export const HEARD = MELODY.map((n, i) => ({ ...n, t: T.listenAt + OFFSETS[i], order: i }));

/** The hook's hit on frame 0: F♯2 on the low E string — the key's fifth, not one of the melody's spots. */
export const HOOK_NOTE = { string: 0, fret: 2, midi: midiAt(0, 2) };
