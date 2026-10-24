// Shoulder-length hair in a steady wind from the left, drawn in HEAD coordinates (head circle r = 65 at the origin, ears at ±64, 8).
// One cohesive dark mass — a cap over the crown, a swept fringe, and locks streaming to the right — drawn as overlapping tapered "tongues"
// in ONE colour so the silhouette reads as a single shape. Light only appears as a warm rim on the outer contour (the sun is behind him)
// and as a few thin sheen lines that follow the flow. Three looks, `variant` a | b | c.
import React from 'react';
import { shade } from './Person';

type Pt = [number, number];
export type HairVariant = 'a' | 'b' | 'c';

const RIM = '#ff9a5c';

/** A tapered tongue along a centre line; `w(s)` is its width at s ∈ [0, 1] (0 = root, 1 = tip). Returns a closed path. */
function tongue(c: Pt[], w: (s: number) => number): string {
  const top: string[] = [], bot: string[] = [];
  c.forEach(([x, y], j) => {
    const [px, py] = c[Math.max(0, j - 1)], [nx, ny] = c[Math.min(c.length - 1, j + 1)];
    const tx = nx - px, ty = ny - py, tl = Math.hypot(tx, ty) || 1, h = w(j / (c.length - 1)) / 2;
    top.push(`${(x - (ty / tl) * h).toFixed(1)} ${(y + (tx / tl) * h).toFixed(1)}`);
    bot.unshift(`${(x + (ty / tl) * h).toFixed(1)} ${(y - (tx / tl) * h).toFixed(1)}`);
  });
  return `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;
}
/** Centre line streaming right from (x0, y0): lift (up, −) / droop (down, +) over its length and a travelling wave. */
function centre(t: number, x0: number, y0: number, len: number, lift: number, droop: number, amp: number, ph: number, n = 32): Pt[] {
  return Array.from({ length: n + 1 }, (_, j) => {
    const s = j / n;
    return [x0 + s * len, y0 + lift * s + droop * s * s + amp * s * Math.sin(t * 5.2 - s * 4.2 + ph)] as Pt;
  });
}
const taper = (root: number, pow = 1.7) => (s: number) => root * Math.pow(Math.max(0, 1 - Math.pow(s, pow)), 0.85);
/** Jagged edges for the rocker look. */
const jag = (root: number, k: number) => (s: number) => taper(root, 1.5)(s) * (1 + 0.22 * Math.sin(s * k));

/** Paint a set of paths as one silhouette: a warm rim just outside, then the body colour over it. */
const Mass: React.FC<{ d: string[]; fill: string }> = ({ d, fill }) => (
  <g>
    <g fill={RIM} stroke={RIM} strokeWidth={7} strokeLinejoin="round" opacity={0.55}>{d.map((p, i) => <path key={i} d={p} />)}</g>
    <g fill={fill}>{d.map((p, i) => <path key={i} d={p} />)}</g>
  </g>
);
const Sheen: React.FC<{ lines: Pt[][]; color: string; width?: number; o?: number }> = ({ lines, color, width = 4, o = 0.55 }) => (
  <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={o}>
    {lines.map((c, i) => <path key={i} d={`M ${c.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}`} />)}
  </g>
);

export const WindHair: React.FC<{ color: string; t: number; wind: number; layer: 'back' | 'front'; variant?: HairVariant }> = ({ color, t, wind, layer, variant = 'b' }) => {   // b = the approved messy-rocker look
  const sheen = shade(color, 3.6), W0 = 0.4 + 0.6 * wind, WB = W0 * 0.6, WF = W0 * 0.78;   // back locks end about at the shoulder, fringe locks a little shorter
  const sub = (c: Pt[], a: number, b: number) => c.slice(Math.round(a * (c.length - 1)), Math.round(b * (c.length - 1)) + 1).map(([x, y]) => [x, y - 5] as Pt);

  // ---------------------------------------------------------------- A: tidy, side-swept
  if (variant === 'a') {
    if (layer === 'back') {
      const tg = [[-40, 188, -16, 12, 9, 0.2, 50], [-14, 205, -8, 16, 10, 1.4, 52], [12, 214, 0, 20, 9, 2.6, 48], [38, 176, 6, 22, 8, 3.8, 40]].map(([y0, len, lift, droop, amp, ph, root]) => centre(t, 18, y0, len * WB, lift * wind, droop, amp, ph));
      const d = [`M -70 -14 A 70 74 0 1 1 70 -14 L 70 34 Q 0 64 -70 34 Z`, ...tg.map((c, i) => tongue(c, taper([50, 52, 48, 40][i])))];
      return <g><Mass d={d} fill={color} /><Sheen lines={[sub(tg[1], 0.25, 0.8), sub(tg[2], 0.2, 0.75)]} color={sheen} /></g>;
    }
    const cap = 'M -68 6 C -82 -60 -40 -86 2 -86 C 46 -86 84 -60 70 -4 C 64 -22 52 -34 36 -38 C 20 -50 -6 -52 -22 -46 C -44 -40 -58 -22 -68 6 Z';
    const fr = [[34, -44, 118, -10, 4, 0.4, 20], [26, -54, 98, -16, 2, 1.6, 17], [14, -62, 84, -14, 0, 2.8, 14]].map(([x0, y0, len, lift, droop, ph, root]) => tongue(centre(t, x0, y0, len * WF, lift * wind, droop, 6, ph, 24), taper(root)));
    return <g><Mass d={[cap, ...fr]} fill={color} /><Sheen lines={[[[-52, -46], [-28, -68], [4, -74], [34, -68]]]} color={sheen} width={4.5} /></g>;
  }

  // ---------------------------------------------------------------- B: messy rocker, spiky
  if (variant === 'b') {
    if (layer === 'back') {
      const spec: [number, number, number, number, number, number][] = [[-48, 170, -22, 8, 10, 0.1], [-24, 215, -12, 14, 12, 1.1], [0, 235, -2, 20, 11, 2.3], [24, 205, 6, 26, 10, 3.2], [48, 160, 10, 26, 8, 4.4]];
      const tg = spec.map(([y0, len, lift, droop, amp, ph]) => centre(t, 18, y0, len * WB, lift * wind, droop, amp, ph));
      const d = [`M -70 -14 A 70 74 0 1 1 70 -14 L 70 34 Q 0 64 -70 34 Z`, ...tg.map((c, i) => tongue(c, jag(44 - 3 * i, 24 + 3 * i)))];
      return <g><Mass d={d} fill={color} /><Sheen lines={[sub(tg[1], 0.2, 0.7), sub(tg[3], 0.2, 0.65)]} color={sheen} /></g>;
    }
    const cap = 'M -68 6 L -76 -28 L -60 -42 L -66 -66 L -42 -64 L -34 -90 L -14 -74 L 4 -98 L 22 -76 L 46 -92 L 52 -66 L 78 -66 L 68 -38 L 76 -14 L 70 4 C 64 -20 50 -34 34 -38 C 18 -46 -4 -50 -20 -44 C -42 -38 -58 -22 -68 6 Z';
    const fr = [[40, -44, 124, -4, 8, 0.3, 20], [30, -58, 108, -14, 4, 1.4, 18], [18, -72, 118, -22, 0, 2.5, 18], [0, -84, 90, -22, -4, 3.6, 14]].map(([x0, y0, len, lift, droop, ph, root]) => tongue(centre(t, x0, y0, len * WF, lift * wind, droop, 7, ph, 24), jag(root, 26)));
    return <g><Mass d={[cap, ...fr]} fill={color} /><Sheen lines={[[[-50, -50], [-30, -70], [0, -80], [30, -74]]]} color={sheen} width={4.5} /></g>;
  }

  // ---------------------------------------------------------------- C: smooth, glossy flow
  if (layer === 'back') {
    const spec: [number, number, number, number, number, number][] = [[-30, 230, -20, 18, 10, 0.3], [4, 250, -6, 26, 12, 1.9], [36, 215, 8, 30, 10, 3.4]];
    const tg = spec.map(([y0, len, lift, droop, amp, ph]) => centre(t, 16, y0, len * WB, lift * wind, droop, amp, ph, 40));
    const d = [`M -70 -14 A 70 74 0 1 1 70 -14 L 70 34 Q 0 64 -70 34 Z`, ...tg.map((c, i) => tongue(c, taper([86, 92, 78][i], 2.1)))];
    return <g><Mass d={d} fill={color} /><Sheen lines={[sub(tg[0], 0.15, 0.85), sub(tg[1], 0.15, 0.85), sub(tg[2], 0.15, 0.8)]} color={sheen} width={5} o={0.5} /></g>;
  }
  const cap = 'M -69 6 C -84 -60 -44 -88 0 -88 C 44 -88 84 -60 69 -2 C 60 -26 44 -38 24 -44 C 10 -52 -8 -52 -24 -42 C -44 -34 -58 -20 -69 6 Z';
  const fr = [[30, -46, 112, -10, 6, 0.6, 26], [10, -64, 100, -14, 2, 2.0, 22]].map(([x0, y0, len, lift, droop, ph, root]) => tongue(centre(t, x0, y0, len * WF, lift * wind, droop, 5, ph, 28), taper(root, 2)));
  return <g><Mass d={[cap, ...fr]} fill={color} /><Sheen lines={[[[-56, -40], [-34, -70], [0, -80], [36, -72]], [[-40, -34], [-20, -58], [8, -66]]]} color={sheen} width={5} /></g>;
};
