// "97% of guitarists can't play this by ear" — #60's format (hook · the melody once · your turn; no countdown, no answer; the notes land
// on their real frets, unnumbered) in #57's minimal look, re-timed after #57's Instagram retention curve: the melody starts under the
// hook (#57 lost 28 pp in its first 2 s, before any tune) and the film ends ~2.8 s after the last note instead of 6.5 s later (its
// closing call to action lost 8 pp/s); the loop cuts back into the hook's hit. 6.8 s. ONE timeline: king/audio.mjs lays the sound from
// it and src/toccata/ToccataMinimal.tsx draws every frame from it.
export const FPS = 120;
export const DURATION = 6.8;

/** Standard tuning, low → high: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * Bach, Toccata and Fugue in D minor, BWV 565 (public domain), the opening gesture from memory: the mordent A G A, held; the run down
 * G F E D to C♯, held; D. The run is slowed from its 32nds so every note can land. At guitar pitch: frets 0–4 on the A, D and G strings.
 *   A3 G2 · G3 G0 · A3 G2 | G3 G0 · F3 D3 · E3 D2 · D3 D0 · C#3 A4 | D3 D0
 */
export const MELODY = [
  { string: 3, fret: 2, beats: 0.25 },
  { string: 3, fret: 0, beats: 0.25 },
  { string: 3, fret: 2, beats: 1.5 },
  { string: 3, fret: 0, beats: 0.25 },
  { string: 2, fret: 3, beats: 0.25 },
  { string: 2, fret: 2, beats: 0.25 },
  { string: 2, fret: 0, beats: 0.25 },
  { string: 1, fret: 4, beats: 1 },
  { string: 2, fret: 0, beats: 1.5 },
].map((n) => ({ ...n, midi: midiAt(n.string, n.fret), name: noteName(midiAt(n.string, n.fret)) }));

export const BPM = 80;
export const BEAT = 60 / BPM;
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const STEP = BEAT;                                  // how long a note counts as "just played"
export const NOTE_RING = BEAT + 0.12;

export const T = {
  hook: 0,
  listen: 0.65,         // the pips come in; the hook's words stay up over the melody
  listenAt: 1.0,        // its first note
  hold: 4.35,           // the last note rings; the camera cranes over the board
  cta: 4.55,            // your turn
  sub: 4.85,
  comment: 5.1,
  sweep: 5.5,           // a closing hairline runs down the strings
};

export const HEARD = MELODY.map((n, i) => ({ ...n, t: T.listenAt + OFFSETS[i], order: i }));

/** The hook's hit on frame 0: the open A string (A2) — the key's fifth, not one of the melody's spots. */
export const HOOK_NOTE = { string: 1, fret: 0, midi: midiAt(1, 0) };
/** The soft closing chord: D minor. */
export const CHORD = [74, 77, 81];
