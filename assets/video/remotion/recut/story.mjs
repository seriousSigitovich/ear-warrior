// The re-cut of #56 («Ну, погоди!», neon highway) after its retention curve (docs/experiments.md, 2026-11-01): viewers left at 4–9 s, as the
// tune ended and a quiet 7 s countdown began, and after the reveal (16.9–20 s). Same hook, melody and picture; the countdown is 3 s, a chip
// says "answer in N" from the first note, the call to action sits over the reveal and the film ends on the answer's last note, so the
// Shorts loop cuts straight into the hook's hit. ONE timeline: ten/audio.mjs lays the sound from it, src/recut/NeonRecut.tsx draws it.
import { MELODY, BEAT, HEARD } from '../neon/story.mjs';

export { FPS, TUNING, STRING_NAMES, noteName, midiAt, MELODY, BPM, BEAT, PHRASE, STEP, NOTE_RING, HEARD, HOOK_NOTE } from '../neon/story.mjs';

export const COUNT_FROM = 3;
const OFFSETS = HEARD.map((n) => n.t - HEARD[0].t);
const LAST_RING = MELODY.at(-1).beats * BEAT + 0.35;     // the answer's last note rings this long, then the loop

const challenge = 5.7, reveal = challenge + COUNT_FROM, answerAt = reveal + 0.75;
export const T = {
  hook: 0,
  listen: 2,
  challenge,            // scene 3: the countdown, 3 → 0
  reveal,               // scene 4: time's up, then the answer with the call to action over it
  listenAt: 2.3,
  clearAt: 5.55,
  answerAt,
  answerChip: 2.6,      // "answer in N" from the first note to the countdown
  cta: answerAt + 0.55, // "comment your score" lands on the answer's second note
  q: answerAt + 0.55,
  comment: answerAt + 0.95,
  chips: [],
  sweep: 99,            // no closing sweep or chord: the film ends on the answer's last note
};
export const DURATION = Math.ceil((answerAt + OFFSETS.at(-1) + LAST_RING) * 10) / 10;

export const ANSWER = MELODY.map((n, i) => ({ ...n, t: answerAt + OFFSETS[i], order: i }));
export const TICKS = Array.from({ length: COUNT_FROM }, (_, i) => challenge + i);
export const remaining = (t) => Math.max(0, reveal - t);
