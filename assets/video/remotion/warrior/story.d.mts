export const FPS: number;
export const BPM: number;
export const EIGHTH: number;
export const T0: number;
export const BAR: number;
export interface Story {
  DURATION: number;
  T: { bar2: number; fillAt: number; chord: number; hold: number };
  CHUGS: { t: number; midi: number; big: boolean }[];
  LEAD: { t: number; midi: number; dur: number }[];
  KICKS: number[];
  SNARES: number[];
  FILL: number[];
  HATS: number[];
  /** take-driven stories only: beat length, first beat, beat times (see take.mjs) */
  BEAT?: number;
  T0?: number;
  BEATS?: number[];
}
export function makeStory(bars: number): Story;
export const RIFF: Story;
export const ROOT: Story;
