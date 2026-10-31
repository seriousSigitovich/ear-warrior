// "Can you play this by ear?" — the 3D Mozart cut, 10.5 s, 120 fps. Hook · the melody once · your turn; no countdown, no answer.
// A white ball bounces across floating pads in perspective, each pad's height is its note's pitch, so the picture shows the shape of the tune
// and never its notes. ONE timeline: spring/audio.mjs lays the sound from it and src/mozart/Mozart3D.tsx draws every frame from it.
export const FPS = 120;
export const DURATION = 10.5;

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

/**
 * Eine kleine Nachtmusik (K. 525), I. Allegro, the opening (violin I, bars 1–2), an octave lower, rests folded into the note before —
 * the notes of challenge #44 (assets/video/challenge/classics.mjs), which were read from the Mutopia MIDI. `beats` is the written length.
 *   G4 · D4 · G4 · D4 · G4 D4 G4 B4 · D5
 */
export const MELODY = [
  [67, 1.5], [62, 0.5], [67, 1.5], [62, 0.5], [67, 0.5], [62, 0.5], [67, 0.5], [71, 0.5], [74, 2],
].map(([midi, beats]) => ({ midi, beats, name: noteName(midi) }));

export const BPM = 120;
export const BEAT = 60 / BPM;
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const NOTE_RING = BEAT + 0.12;
export const LAST_HOLD = 1.15;                             // the top D rings while the camera sweeps round the shape
export const CHORD = [79, 83, 86, 91];                     // the pop's shimmer: G major

export const T = {
  hook: 0,
  launch: 1.62,         // the ball winds up on the floor and leaps…
  melodyAt: 2.0,        // …onto the first pad
  pullBack: 5.08,       // the last note lands: the camera sweeps round to the side to show the whole shape
  orbit: 5.08,
  echo: 5.75,           // the pads flash again in order, silently
  collapse: 6.3,        // the pads sink into the floor
  flash: 6.8,           // the ball pops; a ring runs across the floor
  turn: 7.0,
  sub: 7.4,
  comment: 7.8,
};

export const NOTES = MELODY.map((n, i) => ({ ...n, t: T.melodyAt + OFFSETS[i], order: i }));
export const END = NOTES[NOTES.length - 1].t;
