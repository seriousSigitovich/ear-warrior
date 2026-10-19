export interface CutSegment { id: string; from: number; to: number; len: number }
export interface CutLine { at: number; say: string }
export const SEGS: CutSegment[];
export const LINES: CutLine[];
export const CUT_DURATION: number;
export const SEG_STARTS: number[];
export function srcAt(o: number): number;
export function locate(src: number): { k: number; out: number; speed: number } | null;
