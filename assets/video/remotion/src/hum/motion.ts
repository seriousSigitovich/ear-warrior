// Small motion vocabulary shared by the "melody in my head" film (same helpers as ByEar.tsx).
import { easeInOut, lerp } from '../util';

/** Exponential decay from 1 at `age` = 0 (an impact that fades). 0 before the hit. */
export const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
/** Damped cosine: starts at 1, swings through zero and the other way, dies out (overshoot). 0 before the hit. */
export const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
/** 0 → 1 → 0 parabola over [a, a+d]. */
export const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
/** Ramp 0 → 1 over [a, b], eased. */
export const smooth = (a: number, b: number, t: number) => easeInOut((t - a) / (b - a));
/** Piecewise keyframes with ease-in-out between them. */
export function kf(t: number, pts: [number, number][]): number {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return lerp(va, vb, easeInOut((t - a) / (b - a))); }
  return pts[pts.length - 1][1];
}
