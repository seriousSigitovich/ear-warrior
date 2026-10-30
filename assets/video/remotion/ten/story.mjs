// "Can you play this by ear?" — the 18 s, 10-second-challenge Short. ONE timeline: audio.mjs lays every sound from it and src/ten/TenSecond.tsx
// draws every frame from it, so a note is seen exactly when it is heard. All times in seconds.
export const FPS = 60;
export const DURATION = 18;

/** Standard tuning, low → high, as MIDI numbers: E2 A2 D3 G3 B3 E4. Index 0 is the thickest string. */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
export const midiAt = (string, fret) => TUNING[string] + fret;

/**
 * The melody: five notes, all inside frets 3–5 (one hand position) on the G, B and high-E strings, five different spots.
 * `string` 0 = low E … 5 = high E. The MIDI pitch is always DERIVED from (string, fret), so picture and sound cannot disagree.
 *   E4  B string, fret 5      D4  B string, fret 3      C4  G string, fret 5      G4  high E, fret 3      A4  high E, fret 5
 */
export const MELODY = [
  { string: 4, fret: 5 },
  { string: 4, fret: 3 },
  { string: 3, fret: 5 },
  { string: 5, fret: 3 },
  { string: 5, fret: 5 },
].map((n) => ({ ...n, midi: midiAt(n.string, n.fret), name: noteName(midiAt(n.string, n.fret)) }));

/** Seconds between the five notes — identical in the first playback and in the reveal. */
export const STEP = 0.5;
export const NOTE_RING = 0.62;                         // how long each pluck is held before the next damps it (last one rings on)

/** The beats of the film. */
export const T = {
  hook: 0,
  listen: 2,            // scene 2: hear the melody
  challenge: 5,         // scene 3: the countdown, 7 → 0
  reveal: 12,           // scene 4: time's up, then the answer
  cta: 15,              // scene 5: comment call to action
  listenAt: 2.35,       // first melody note while listening
  clearAt: 4.9,         // after the 5th note every highlight is removed
  answerAt: 12.8,       // first melody note in the reveal
  q: 15.18,             // "DID YOU GET IT?"
  comment: 15.78,       // "COMMENT YOUR SCORE ↓"
  chips: [16.4, 16.6, 16.8],
  sweep: 17.3,          // the closing light sweep
};

/** The first-playback notes and the reveal notes: same MELODY, same offsets, two start times. */
export const HEARD = MELODY.map((n, i) => ({ ...n, t: T.listenAt + i * STEP, order: i }));
export const ANSWER = MELODY.map((n, i) => ({ ...n, t: T.answerAt + i * STEP, order: i }));

/** The hook's flash: a deep open-position note that is NOT part of the melody (low E, fret 3 = G2). */
export const HOOK_NOTE = { string: 0, fret: 3, midi: midiAt(0, 3) };

/** Countdown: 7 at 5.0 s … 0 at 12.0 s. Whole-second boundaries tick. */
export const COUNT_FROM = 7;
export const TICKS = Array.from({ length: COUNT_FROM }, (_, i) => T.challenge + i);   // 5,6,…,11 (the number changes at each)
export const remaining = (t) => Math.max(0, T.reveal - t);
