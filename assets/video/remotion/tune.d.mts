export const FPS: number;
export const SCENE: number;
export const STINGER_AT: number;
export const DURATION_SEC: number;
export interface Note { phase: 'listen' | 'tour' | 'answer'; s: number; f: number; midi: number; t: number; dur: number }
export interface Copy { listen: string[]; tour: string[]; answer: string[]; chip: string; result: string; tagline: string; brand: string }
export type Tune = { id: string; title: string; bpm: number; beat: number; notes: Note[]; listenCount: number; chord: number[]; stingerAt: number; copy: Copy; audio: string };
export function resolveTune(raw: unknown): Tune;
export function midiOf(name: string): number;
