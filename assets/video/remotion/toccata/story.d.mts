export const FPS: number;
export const DURATION: number;
export const TUNING: number[];
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
export const T: { hook: number; listen: number; listenAt: number; hold: number; cta: number; sub: number; comment: number; sweep: number };
export const HEARD: TimedNote[];
export const HOOK_NOTE: { string: number; fret: number; midi: number };
export const CHORD: number[];
