export { FPS, TUNING, STRING_NAMES, noteName, midiAt, MELODY, BPM, BEAT, PHRASE, STEP, NOTE_RING, HEARD, HOOK_NOTE, type Note, type TimedNote } from '../neon/story.mjs';
import type { TimedNote } from '../neon/story.mjs';
export const DURATION: number;
export const COUNT_FROM: number;
export const T: {
  hook: number; listen: number; challenge: number; reveal: number; listenAt: number; clearAt: number; answerAt: number; answerChip: number;
  cta: number; q: number; comment: number; chips: number[]; sweep: number;
};
export const ANSWER: TimedNote[];
export const TICKS: number[];
export const remaining: (t: number) => number;
