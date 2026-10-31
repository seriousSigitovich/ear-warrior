export const FPS: number;
export const DURATION: number;
export const noteName: (midi: number) => string;
export interface Note { midi: number; name: string; beats: number }
export interface TimedNote extends Note { t: number; order: number }
export const MELODY: Note[];
export const BPM: number;
export const BEAT: number;
export const PHRASE: number;
export const NOTE_RING: number;
export const LAST_HOLD: number;
export const CHORD: number[];
export const T: { hook: number; launch: number; melodyAt: number; pullBack: number; collapse: number; flash: number; turn: number; sub: number; comment: number; orbit?: number; echo?: number };
export const NOTES: TimedNote[];
export const END: number;
