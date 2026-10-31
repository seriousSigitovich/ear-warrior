export const FPS: number;
export const DURATION: number;
export const TUNING: number[];
export const STRING_NAMES: string[];
export const noteName: (midi: number) => string;
export const midiAt: (string: number, fret: number) => number;
export interface Note { string: number; fret: number; midi: number; name: string; beats: number }
export interface TimedNote extends Note { t: number; order: number }
export const MELODY: Note[];
export const STEP: number;
export const BPM: number;
export const BEAT: number;
export const PHRASE: number;
export const NOTE_RING: number;
export const T: {
  hook: number; listen: number; challenge: number; reveal: number; cta: number;
  listenAt: number; clearAt: number; answerAt: number; q: number; comment: number; chips: number[]; sweep: number;
};
export const HEARD: TimedNote[];
export const ANSWER: TimedNote[];
export const HOOK_NOTE: { string: number; fret: number; midi: number };
export const COUNT_FROM: number;
export const TICKS: number[];
export const remaining: (t: number) => number;
