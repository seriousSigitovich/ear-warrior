// "Can you play this by ear?" — the neon cut, 20 s. The same five scenes as ten/story.mjs (hook · listen · 7 → 0 · answer · comment), but the
// melody is the opening of the «Ну, погоди!» theme (Tamás Deák, "Vízisí"), with its own rhythm. ONE timeline: ten/audio.mjs lays the sound
// from it and src/neon/TenNeon.tsx draws every frame from it. Same export names as ten/story.mjs, so the audio code serves both.
export const FPS = 60;
export const DURATION = 20;

/** Standard tuning, low → high: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * Bars 1–2 of the theme as tabbed by Michael "ProgMuz" Sobin (gprotab.net, ♩ = 160, F major): F C D A | C G A G F C, here an octave
 * lower so it all sits in first position (frets 0–3, no shifts). `beats` is the written length (1 = a quarter).
 *   F4 e1 · C4 B1 · D4 B3 · A3 G2 | C4 B1 · G3 G0 · A3 G2 · G3 G0 · F3 D3 · C3 A3
 */
export const MELODY = [
  { string: 5, fret: 1, beats: 1 },
  { string: 4, fret: 1, beats: 1 },
  { string: 4, fret: 3, beats: 1 },
  { string: 3, fret: 2, beats: 1 },
  { string: 4, fret: 1, beats: 1 },
  { string: 3, fret: 0, beats: 0.5 },
  { string: 3, fret: 2, beats: 1 },
  { string: 3, fret: 0, beats: 0.5 },
  { string: 2, fret: 3, beats: 0.5 },
  { string: 1, fret: 3, beats: 0.5 },
].map((n) => ({ ...n, midi: midiAt(n.string, n.fret), name: noteName(midiAt(n.string, n.fret)) }));

export const BPM = 160;
export const BEAT = 60 / BPM;
/** Seconds from the first note to each note — identical in the first playback and in the reveal. */
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const STEP = BEAT;                                  // the quarter: how long a note counts as "just played"
export const NOTE_RING = BEAT + 0.12;

export const T = {
  hook: 0,
  listen: 2,            // scene 2: hear the melody
  challenge: 5.7,       // scene 3: the countdown, 7 → 0
  reveal: 12.7,         // scene 4: time's up, then the answer
  cta: 16.9,            // scene 5: comment call to action
  listenAt: 2.3,        // first melody note while listening
  clearAt: 5.55,        // after the last note every highlight is removed
  answerAt: 13.45,      // first melody note in the reveal
  q: 17.08,
  comment: 17.68,
  chips: [18.3, 18.5, 18.7],
  sweep: 19.2,
};

export const HEARD = MELODY.map((n, i) => ({ ...n, t: T.listenAt + OFFSETS[i], order: i }));
export const ANSWER = MELODY.map((n, i) => ({ ...n, t: T.answerAt + OFFSETS[i], order: i }));

/** The hook's hit on frame 0: low F (low E string, fret 1) — the key's root, not one of the melody's spots. */
export const HOOK_NOTE = { string: 0, fret: 1, midi: midiAt(0, 1) };

export const COUNT_FROM = 7;
export const TICKS = Array.from({ length: COUNT_FROM }, (_, i) => T.challenge + i);
export const remaining = (t) => Math.max(0, T.reveal - t);
