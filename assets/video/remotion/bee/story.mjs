// #69 "97% of guitarists can't play this by ear" — #62's minimal cut (src/toccata/ToccataMinimal.tsx: hook · the melody once under the
// hook's words · your turn, comment the notes; no countdown, no answer; the notes land on their real frets, unnumbered) with #68's tune,
// the opening run of Flight of the Bumblebee. Same gaps as #62, measured from the last note, so 0.3 s shorter: 6.5 s. ONE timeline:
// king/audio.mjs lays the sound from it and src/bee/BeeMinimal.tsx draws every frame from it.
export const FPS = 120;
export const DURATION = 6.5;

/** Standard tuning, low → high: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * Rimsky-Korsakov, Flight of the Bumblebee (1900, public domain), the opening chromatic run, from memory, as king/tunes.mjs `bumblebee`
 * (#68): down from E with the turn back up at D and C, then straight down to F. At guitar pitch: frets 0–4 on the D, G, B and E strings.
 *   E4 E0 · D#4 B4 · D4 B3 · C#4 B2 · D4 B3 · C#4 B2 · C4 B1 · B3 B0 · C4 B1 · B3 B0 · A#3 G3 · A3 G2 · G#3 G1 · G3 G0 · F#3 D4 · F3 D3
 */
export const MELODY = [
  [5, 0], [4, 4], [4, 3], [4, 2], [4, 3], [4, 2], [4, 1], [4, 0],
  [4, 1], [4, 0], [3, 3], [3, 2], [3, 1], [3, 0], [2, 4], [2, 3],
].map(([string, fret], i, all) => ({ string, fret, beats: i === all.length - 1 ? 1 : 0.5, midi: midiAt(string, fret), name: noteName(midiAt(string, fret)) }));

export const BPM = 168;
export const BEAT = 60 / BPM;
const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
export const PHRASE = OFFSETS[OFFSETS.length - 1];
export const STEP = BEAT;                                  // how long a note counts as "just played"
export const NOTE_RING = BEAT + 0.12;

export const T = {
  hook: 0,
  listen: 0.65,         // the pips come in; the hook's words stay up over the melody
  listenAt: 1.0,        // its first note
  hold: 4.05,           // the last note rings; the camera cranes over the board
  cta: 4.25,            // your turn
  sub: 4.55,
  comment: 4.8,
  sweep: 5.2,           // a closing hairline runs down the strings
};

export const HEARD = MELODY.map((n, i) => ({ ...n, t: T.listenAt + OFFSETS[i], order: i }));

/** The hook's hit on frame 0: the open A string (A2), as #62, where the hook camera frames it; not one of the melody's spots. */
export const HOOK_NOTE = { string: 1, fret: 0, midi: midiAt(1, 0) };
/** The soft closing chord: A minor, as #68. */
export const CHORD = [69, 72, 76];
