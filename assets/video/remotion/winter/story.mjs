// "Can you play this by ear?" — the minimal Winter cut, 20 s. The same five scenes as ten/story.mjs (hook · listen · 7 → 0 · answer · comment),
// the melody is the opening of Vivaldi's Winter, Largo. ONE timeline: ten/audio.mjs lays the sound from it and src/winter/TenWinter.tsx draws
// every frame from it. Same export names as ten/story.mjs, so the audio code serves it unchanged.
export const FPS = 60;
export const DURATION = 20;

/** Standard tuning, low → high: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

const NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];   // E♭ major: spelt with flats
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * Winter (L'inverno, Op. 8 No. 4, RV 297), II. Largo, solo part bar 1 (flutetunes.com MIDI, E♭ major): E♭5 · B♭5 A♭5 · G5 · F5 E♭5 · F5 · B♭4,
 * here an octave lower so it sits in one hand position (frets 3–6, no shifts). `beats` is the written length (1 = a quarter).
 *   E♭4 B4 · B♭4 e6 · A♭4 e4 · G4 e3 · F4 B6 · E♭4 B4 · F4 B6 · B♭3 G3
 */
export const MELODY = [
  { string: 4, fret: 4, beats: 0.5 },
  { string: 5, fret: 6, beats: 0.25 },
  { string: 5, fret: 4, beats: 0.25 },
  { string: 5, fret: 3, beats: 0.5 },
  { string: 4, fret: 6, beats: 0.25 },
  { string: 4, fret: 4, beats: 0.25 },
  { string: 4, fret: 6, beats: 0.5 },
  { string: 3, fret: 3, beats: 0.5 },
].map((n) => ({ ...n, midi: midiAt(n.string, n.fret), name: noteName(midiAt(n.string, n.fret)) }));

export const BPM = 56;                                     // a flowing Largo: the phrase lasts 2.7 s
export const BEAT = 60 / BPM;
/** Seconds from the first note to each note — identical in the first playback and in the reveal. */
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const STEP = BEAT / 2;                              // the eighth: how long a note counts as "just played"
export const NOTE_RING = BEAT + 0.12;                      // legato: each note rings into the next

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

/** The hook's note on frame 0: E♭3 (A string, fret 6) — the key's root, not one of the melody's spots. */
export const HOOK_NOTE = { string: 1, fret: 6, midi: midiAt(1, 6) };

export const COUNT_FROM = 7;
export const TICKS = Array.from({ length: COUNT_FROM }, (_, i) => T.challenge + i);
export const remaining = (t) => Math.max(0, T.reveal - t);
