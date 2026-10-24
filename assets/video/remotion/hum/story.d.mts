export const FPS: number;
export const DURATION: number;
export const BPM: number;
export const BEAT: number;
export const SOLO_AT: number;
export interface Shot { id: string; t0: number; t1: number }
export const SHOTS: Shot[];
export function shotAt(t: number): Shot;
export interface HumNote { t: number; midi: number; dur: number; crack?: boolean }
export const HUM: HumNote[];
export const T: { turn: number; stop: number; ding: number; crack: number; bulb: number; grab: number; whoosh: number };
export interface SoloNote { t: number; midi: number; dur: number; trem?: boolean; final?: boolean }
export const SOLO: SoloNote[];
export const FINAL: { t: number; midi: number; from: number; slide: number; dur: number };
export function fret(midi: number): number;
