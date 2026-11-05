// The disco jam loop: one 8 s timeline read by both the soundtrack (groove/audio.mjs) and the picture (src/groove/Groove.tsx).
// Four bars of a four-on-the-floor groove at ♩ = 120 (one bar = 2 s), I–vi–ii–V in C: | Cmaj7 | Am7 | Dm7 | G7 | — the bright, bouncing
// disco/funk turnaround; G7 leads straight back into Cmaj7, so the loop never lands and never stops.
// Over all four chords the C major pentatonic (C D E G A) is safe: no note of the box clashes with any of them. The box drawn is the one at
// frets 5–8 (the shape players know as the A-minor "box 1"). Each bar lights the chord's own triad inside the box — the notes to land on.
// Variant "call" adds a two-bar guitar call (bars 1–2) and leaves bars 3–4 empty for the viewer's answer.
// Pitches are never typed: every note is (string, fret) and its MIDI number comes from standard tuning.

export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = 4 * BEAT;
export const STEP = BEAT / 4;                                 // a 16th
export const BARS = 4;
export const DURATION = BARS * BAR;                           // 8 s, one pass of the loop

/** Standard tuning, low E (string 0) → high E (string 5). */
export const OPEN = [40, 45, 50, 55, 59, 64];
const PC = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const midiOf = (s, f) => OPEN[s] + f;
export const nameOf = (m) => PC[m % 12];

export const KEY = { root: 0, name: 'C', scale: 'C major pentatonic' };
/** The box: C major pentatonic at frets 5–8, two notes a string. */
export const BOX = [[0, 5], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5], [5, 8]]
  .map(([s, f]) => ({ s, f, midi: midiOf(s, f), name: nameOf(midiOf(s, f)) }));

/**
 * The chords, one a bar. `tones` = the triad's pitch classes (root first), lit in the box; `bass` = the root for the octave bass;
 * `voicing` = the guitar's four-note chop on the top strings (smooth voice leading, all within a tone of each other).
 */
export const CHORDS = [
  { name: 'Cmaj7', short: 'C', tones: [0, 4, 7], bass: 36, voicing: [60, 64, 67, 71], color: '#FF4FD8' },
  { name: 'Am7', short: 'Am', tones: [9, 0, 4], bass: 33, voicing: [57, 60, 64, 67], color: '#38E1FF' },
  { name: 'Dm7', short: 'Dm', tones: [2, 5, 9], bass: 38, voicing: [57, 60, 62, 65], color: '#C6FF4D' },
  { name: 'G7', short: 'G', tones: [7, 11, 2], bass: 31, voicing: [59, 62, 65, 67], color: '#FFB547' },
];
export const BAR_T = CHORDS.map((_, i) => i * BAR);
export const BEATS = Array.from({ length: BARS * 4 }, (_, i) => i * BEAT);

// --- the band (same in both variants, so the two cuts differ only by the call) ------------------------------------------------------
/** Guitar chop, 16 steps a bar: C = the chord, g = a muted scratch, . = rest. */
export const CHOP = 'C.gC.gC.gCgC.gCg';
/** Disco octave bass: 8ths, low root on the beat, the octave on the "and". */
export const BASS = CHORDS.flatMap((c, b) => Array.from({ length: 8 }, (_, k) => ({ t: b * BAR + k * 2 * STEP, midi: c.bass + (k % 2 ? 12 : 0), dur: 2 * STEP * 0.8 })));
export const KICKS = BEATS;
export const CLAPS = BEATS.filter((_, i) => i % 2 === 1);
export const OPEN_HATS = BEATS.map((t) => t + 2 * STEP);
export const HATS = Array.from({ length: BARS * 16 }, (_, i) => i * STEP).filter((_, i) => i % 4 === 1 || i % 4 === 3);
/** A snare pickup on the last two 16ths, back into bar 1. */
export const FILL = [DURATION - 2 * STEP, DURATION - STEP];

// --- variant "call": a two-bar guitar phrase, then two bars for the answer ---------------------------------------------------------
/** E G A G E D C … A C D C — the major pentatonic skipping down and home; every note in the box. `b` = start in beats, `len` in beats. */
const CALL_RAW = [
  [0.0, 0.5, 4, 5], [0.5, 0.25, 4, 8], [0.75, 0.75, 5, 5], [1.5, 0.5, 4, 8], [2.0, 0.5, 4, 5], [2.5, 0.5, 3, 7], [3.0, 1.0, 3, 5],
  [4.5, 0.25, 2, 7], [4.75, 0.75, 3, 5], [5.5, 0.5, 3, 7], [6.0, 1.5, 3, 5],
];
export const CALL = CALL_RAW.map(([b, len, s, f]) => ({ t: b * BEAT, dur: len * BEAT, s, f, midi: midiOf(s, f), name: nameOf(midiOf(s, f)) }));
export const CALL_END = 2 * BAR;                              // the answer: bars 3–4
