// "Can you play this by ear?" — the bouncing-ball Spring cut, 10 s, 120 fps. No countdown and no answer: hook · the melody once · your turn.
// The melody is the theme of Vivaldi's Spring; a white ball hops from note to note, its height is the pitch, so the picture shows the shape of
// the tune and never its notes. ONE timeline: spring/audio.mjs lays the sound from it and src/spring/SpringBounce.tsx draws every frame from it.
export const FPS = 120;
export const DURATION = 10;

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];   // E major: spelt with sharps
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

/**
 * Spring (La primavera, Op. 8 No. 1, RV 269), I. Allegro, the theme (violin I, bars 1–2), an octave lower — the same notes as
 * tunes/vivaldi-spring.json, which were checked against the Mutopia MIDI. `beats` is the written length (1 = a quarter).
 *   E4 · G♯4 G♯4 G♯4 · F♯4 E4 · B4 —  B4 A4 · G♯4 G♯4 G♯4 · F♯4 E4 · B4
 */
export const MELODY = [
  [64, 0.5], [68, 0.5], [68, 0.5], [68, 0.5], [66, 0.25], [64, 0.25], [71, 1.5],
  [71, 0.25], [69, 0.25], [68, 0.5], [68, 0.5], [68, 0.5], [66, 0.25], [64, 0.25], [71, 1.5],
].map(([midi, beats]) => ({ midi, beats, name: noteName(midi) }));

export const BPM = 120;
export const BEAT = 60 / BPM;
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const NOTE_RING = BEAT + 0.12;                      // legato: each note rings into the next
export const LAST_HOLD = 0.95;                             // the last note rings this long, into the fold
export const CHORD = [76, 80, 83, 88];                     // the pop's shimmer: E major

export const T = {
  hook: 0,
  launch: 1.62,         // the ball winds up and hops off the hook…
  melodyAt: 2.0,        // …and lands on the first note
  pullBack: 5.3,        // the last note lands: the camera pulls back to show the whole shape
  collapse: 6.15,       // the shape folds into the ball
  flash: 6.55,          // the ball pops: one ring, the call to action
  turn: 6.62,
  sub: 7.05,
  comment: 7.5,
};

export const NOTES = MELODY.map((n, i) => ({ ...n, t: T.melodyAt + OFFSETS[i], order: i }));
/** Where the melody's last note lands. */
export const END = NOTES[NOTES.length - 1].t;
