// The last scene of the "melody in my head" film: a rock ledge above a precipice at sunset. A huge sun behind layered ridges, god rays on
// the beat, clouds and mist drifting in the wind, grass and hair bent the same way, birds. Everything is a pure function of `t`.
// The scene is drawn far beyond the 1080×1920 frame (X0…X0+W, Y0…Y0+H) so the camera can pull right back at the end.
import React from 'react';
import { clamp, rng } from '../util';
import { BEAT, SOLO_AT } from '../../hum/story.mjs';
import { kick } from './motion';

export const SUN = { x: 560, y: 1130 };
const X0 = -900, Y0 = -800, W = 2880, H = 3700;
const HORIZON = 1180;
const mod = (a: number, m: number) => ((a % m) + m) % m;
export const sinceBeat = (t: number) => mod(t - SOLO_AT, BEAT);

const rs = rng(5);
const STARS = Array.from({ length: 80 }, () => ({ x: X0 + rs() * W, y: Y0 + rs() * 1500, r: 1.2 + rs() * 2.4, p: rs() * 6 }));

/** A jagged ridge line, peaks alternating tall and low. */
function ridge(seed: number, base: number, amp: number, step = 110): string {
  const r = rng(seed);
  let d = `M ${X0} 3100 L ${X0} ${base}`;
  for (let x = X0 + step, i = 0; x <= X0 + W + step; x += step, i++) d += ` L ${x} ${base - amp * (0.25 + 0.75 * r()) * (i % 2 ? 0.45 : 1)}`;
  return `${d} L ${X0 + W + step} 3100 Z`;
}
const RIDGES = [
  { base: 1230, d: ridge(11, 1230, 170), fill: '#8a4f8a' },
  { base: 1320, d: ridge(23, 1320, 200), fill: '#5e3b7c' },
  { base: 1420, d: ridge(37, 1420, 230), fill: '#3b2a63' },
];
const rc = rng(9);
const CLOUDS = Array.from({ length: 16 }, (_, i) => ({ x: rc() * 3000, y: 260 + rc() * 760, w: 260 + rc() * 380, h: 40 + rc() * 50, sp: 14 + (i % 4) * 22 + rc() * 10, o: 0.55 + rc() * 0.3 }));
const MIST = Array.from({ length: 9 }, () => ({ x: rc() * 2600, y: 1560 + rc() * 700, w: 240 + rc() * 260, sp: 40 + rc() * 50, o: 0.1 + rc() * 0.1 }));
const BIRDS = [{ x: 200, y: 760, s: 1 }, { x: 330, y: 840, s: 0.8 }, { x: 760, y: 700, s: 0.9 }, { x: 880, y: 800, s: 0.6 }];

export const CliffBg: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <defs>
      <linearGradient id="cl-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0a0c28" /><stop offset="0.2" stopColor="#21174f" /><stop offset="0.36" stopColor="#5a2a78" /><stop offset="0.44" stopColor="#b1456f" />
        <stop offset="0.5" stopColor="#f07a55" /><stop offset={(HORIZON - Y0) / H} stopColor="#ffc27a" /><stop offset="0.62" stopColor="#ffd9a0" /><stop offset="1" stopColor="#c97a7a" />
      </linearGradient>
      <radialGradient id="cl-sun"><stop offset="0" stopColor="#fff6d8" stopOpacity={1} /><stop offset="0.3" stopColor="#ffd38a" stopOpacity={0.85} /><stop offset="1" stopColor="#ff8a4a" stopOpacity={0} /></radialGradient>
      <linearGradient id="cl-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd7b0" stopOpacity={0} /><stop offset="0.5" stopColor="#ffd7b0" stopOpacity={0.3} /><stop offset="1" stopColor="#ffd7b0" stopOpacity={0} /></linearGradient>
      <linearGradient id="cl-abyss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1030" stopOpacity={0} /><stop offset="1" stopColor="#0a0618" stopOpacity={0.85} /></linearGradient>
    </defs>
    <rect x={X0} y={Y0} width={W} height={H} fill="url(#cl-sky)" />
    {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e8e6ff" opacity={0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + s.p))} />)}
    <circle cx={SUN.x} cy={SUN.y} r={820} fill="url(#cl-sun)" opacity={0.85} />
    <circle cx={SUN.x} cy={SUN.y} r={165} fill="#fff3c9" />
    {/* clouds: dark tops, sun-lit undersides, drifting with the wind */}
    {CLOUDS.map((c, i) => {
      const x = mod(c.x + t * c.sp, 3200) - 1000;
      return (
        <g key={i} opacity={c.o}>
          <ellipse cx={x} cy={c.y + 16} rx={c.w / 2} ry={c.h * 0.55} fill="#ffb27a" opacity={0.55} />
          <ellipse cx={x} cy={c.y} rx={c.w / 2} ry={c.h / 2} fill="#3a2468" />
          <ellipse cx={x - c.w * 0.18} cy={c.y - c.h * 0.3} rx={c.w * 0.28} ry={c.h * 0.42} fill="#3a2468" />
        </g>
      );
    })}
    {BIRDS.map((b, i) => {
      const x = mod(b.x + t * 46, 1700) - 300, flap = Math.sin(t * 7 + i * 1.7);
      return <path key={i} d={`M -16 ${6 - 6 * flap} Q -8 ${-10 + 4 * flap} 0 0 Q 8 ${-10 + 4 * flap} 16 ${6 - 6 * flap}`} fill="none" stroke="#2a1d45" strokeWidth={4} strokeLinecap="round" transform={`translate(${x} ${b.y + 20 * Math.sin(t * 0.8 + i)}) scale(${b.s})`} />;
    })}
    {/* three ridges, each softened by mist */}
    {RIDGES.map((r, i) => (
      <g key={i}>
        <path d={r.d} fill={r.fill} />
        <rect x={X0} y={r.base - 70} width={W} height={260} fill="url(#cl-mist)" />
      </g>
    ))}
    {/* the precipice: mist rising out of the dark below the ledge */}
    <rect x={X0} y={1560} width={W} height={1600} fill="url(#cl-abyss)" />
    {MIST.map((m, i) => <ellipse key={i} cx={mod(m.x + t * m.sp, 3200) - 900} cy={m.y} rx={m.w} ry={60} fill="#ffd7b0" opacity={m.o} />)}
  </g>
);

/** God rays from the sun, pulsing on the beat; `gain` brightens them (the last note). */
export const Rays: React.FC<{ t: number; gain?: number }> = ({ t, gain = 1 }) => {
  const pulse = 1 + 0.45 * kick(sinceBeat(t), 6) * (t >= SOLO_AT ? 1 : 0);
  return (
    <g style={{ mixBlendMode: 'screen' }}>
      <defs><linearGradient id="cl-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0c0" stopOpacity={0.55} /><stop offset="1" stopColor="#fff0c0" stopOpacity={0} /></linearGradient></defs>
      {Array.from({ length: 13 }, (_, i) => {
        const a = -165 + i * 10.5 + 3.5 * Math.sin(t * 0.5 + i * 1.9), w = 22 + 16 * ((i * 7) % 5) / 4;
        return <path key={i} d={`M ${-w * 0.2} 0 L ${w * 0.2} 0 L ${w * 9} -2600 L ${-w * 9} -2600 Z`} fill="url(#cl-ray)" opacity={clamp(0.5 * gain * pulse * (0.6 + 0.4 * Math.sin(t * 1.1 + i)))}
          transform={`translate(${SUN.x} ${SUN.y}) rotate(${a + 90})`} />;
      })}
    </g>
  );
};

/** Streaks of wind and flying specks, all to the right. */
export const WindLines: React.FC<{ t: number; wind: number }> = ({ t, wind }) => (
  <g strokeLinecap="round" fill="none">
    {Array.from({ length: 26 }, (_, i) => {
      const y = 180 + ((i * 193) % 1560), sp = 1100 + (i % 5) * 230, x = mod(i * 211 + t * sp * wind, 3000) - 700, len = 120 + (i % 4) * 70;
      return <path key={i} d={`M ${x} ${y} q ${len * 0.5} ${-10 - (i % 3) * 6} ${len} 0`} stroke="#fff" strokeOpacity={0.1 + 0.07 * (i % 3)} strokeWidth={3 + (i % 3)} />;
    })}
    {Array.from({ length: 22 }, (_, i) => {
      const y0 = 300 + ((i * 137) % 1300), x = mod(i * 307 + t * (1500 + (i % 4) * 300) * wind, 2800) - 600, y = y0 + 30 * Math.sin(t * 6 + i);
      return <ellipse key={i} cx={x} cy={y} rx={9 + (i % 3) * 4} ry={3.5} fill={i % 2 ? '#ffd7b0' : '#fff'} opacity={0.55} transform={`rotate(${20 * Math.sin(t * 8 + i)} ${x} ${y})`} />;
    })}
  </g>
);

// the ledge: left rises gently to a flat top, then the cliff drops away on the right
const TOP: [number, number][] = [[X0, 1590], [-500, 1545], [-200, 1500], [100, 1450], [330, 1432], [540, 1424], [740, 1428], [815, 1446], [842, 1478], [826, 1540], [858, 1620], [838, 1720], [872, 1840], [850, 2000], [880, 3100]];
function topAt(x: number): number {
  for (let i = 1; i < TOP.length; i++) if (x <= TOP[i][0]) { const [x0, y0] = TOP[i - 1], [x1, y1] = TOP[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return TOP[TOP.length - 1][1];
}
const rg = rng(17);
const BLADES = Array.from({ length: 78 }, (_, i) => ({ x: -460 + i * 17 + rg() * 10, h: 46 + rg() * 70, k: 0.55 + rg() * 0.6, p: rg() * 6 }));

/** The rock in front of the person's waist, with sun-lit rim, cracks and grass bent by the wind. */
export const CliffFront: React.FC<{ t: number; wind: number }> = ({ t, wind }) => (
  <g>
    <defs><linearGradient id="cl-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f1438" /><stop offset="1" stopColor="#0a0616" /></linearGradient></defs>
    <path d={`M ${X0} 3100 ${TOP.map(([x, y]) => `L ${x} ${y}`).join(' ')} L 880 3100 Z`} fill="url(#cl-rock)" />
    <path d={`M ${TOP.slice(3).map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ')}`} fill="none" stroke="#ff9a5c" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    {[[-300, 1560, -120, 1700], [100, 1520, 40, 1760], [420, 1500, 520, 1720], [700, 1500, 760, 1680], [830, 1580, 800, 1800], [-520, 1620, -420, 1860]].map(([a, b, c, d], i) => (
      <path key={i} d={`M ${a} ${b} L ${(a + c) / 2 + 24} ${(b + d) / 2 - 12} L ${c} ${d}`} fill="none" stroke="#33235a" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
    ))}
    {BLADES.map((g, i) => {
      if (g.x > 812) return null;
      const y = topAt(g.x), lean = (34 + 40 * g.k) * wind * (0.75 + 0.25 * Math.sin(t * 4.2 + g.p));
      const d = `M ${g.x} ${y + 6} Q ${g.x + lean * 0.25} ${y - g.h * 0.6} ${g.x + lean} ${y - g.h}`;
      return <g key={i}><path d={d} fill="none" stroke="#241a46" strokeWidth={6} strokeLinecap="round" />{i % 3 === 0 && <path d={d} fill="none" stroke="#ffb27a" strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />}</g>;
    })}
  </g>
);
