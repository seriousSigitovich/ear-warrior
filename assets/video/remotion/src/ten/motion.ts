// Motion vocabulary — every function is pure in time (seconds), so any frame renders alone and identically.
import { spring } from 'remotion';
import { clamp, easeInOut } from '../util';

export const FPS = 60;
export type SpringCfg = { damping: number; stiffness: number; mass: number };
export const SNAP: SpringCfg = { damping: 11, stiffness: 240, mass: 0.7 };      // fast, slight overshoot, settles
export const POP: SpringCfg = { damping: 9, stiffness: 300, mass: 0.6 };        // livelier
export const SOFT: SpringCfg = { damping: 16, stiffness: 120, mass: 1 };        // calm move with a hint of overshoot

/** 0 → 1 spring that starts at time `at` (0 before it). */
export const springAt = (t: number, at: number, cfg: SpringCfg = SNAP): number =>
  t <= at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config: cfg });
/** Decaying impact: 1 at the hit, → 0. 0 before. */
export const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
/** Damped cosine (overshoot / wobble). */
export const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
/** Eased 0 → 1 between a and b. */
export const ramp = (t: number, a: number, b: number) => easeInOut(clamp((t - a) / (b - a)));
export const lin = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** Presence of something shown in [a, b): springs in at a, ramps out over `out` seconds ending at b. */
export const window = (t: number, a: number, b: number, out = 0.22) => springAt(t, a) * (1 - ramp(t, b - out, b));
