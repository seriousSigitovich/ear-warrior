// The 3-D world of the neon cut, drawn as one SVG per frame through `cam.ts`: a night road (grid floor, horizon sun, stars) with the guitar
// neck lying on it as the highway. Notes arrive as comets — down their string from beyond the nut, or from the sky in the top-down
// answer — and land on their fret exactly at their note time: shockwave on the board, a light pillar, sparks, the string vibrating.
import React from 'react';
import { N, FONT, rgba } from './theme';
import { type Cam, type V3, type P2, project, projectDir, segment, polygon, circleOnPlane, pxPerUnit, depth, v3 } from './cam';
import { easeOut, rng, clamp } from '../util';
import { springAt, POP } from '../ten/motion';

// --- geometry (world units: 1 = string to string) ---------------------------------------------------------------------------------------
export const NUT_X = 6.5;                                  // the nut; frets run towards −x
const LEN = 13;                                            // nut → fret 7, the same 13 : 1 proportion as #55's board
const SPAN = 1 - 2 ** (-7 / 12);
/** x of fret wire n, real scale-length spacing (each fret 2^(−1/12) of the one before). */
export const fretX = (n: number) => NUT_X - (LEN * (1 - 2 ** (-n / 12))) / SPAN;
/** Where a fingertip sits on fret n: just behind the wire. */
export const noteX = (fret: number) => (fret === 0 ? NUT_X + 0.45 : fretX(fret - 1) + (fretX(fret) - fretX(fret - 1)) * 0.56);
/** z of string s (0 = low E … 5 = high E, which is "up" in the top-down view, as in a tab). */
export const stringZ = (s: number) => s - 2.5;
const HALF = 3.17;                                         // board half-width
const END_X = fretX(12.6);
const GAUGE = [0.13, 0.105, 0.085, 0.065, 0.05, 0.042];
const WOUND = [true, true, true, false, false, false];
const FLOOR_Y = -1.6;
const NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];

/** A note's life on the board. `from`: 'lane' flies down its string from the horizon, 'sky' drops from above. `gone` = when it dissolves. */
export type Hit = { id: string; string: number; fret: number; land: number; from: 'lane' | 'sky'; label: string; gone?: number; big?: boolean; hotFor?: number };
export const FLY = 0.42;                                   // seconds in the air: the comet starts before the sound and lands on it
const landPoint = (h: Hit): V3 => [noteX(h.fret), 0, stringZ(h.string)];
function cometAt(h: Hit, t: number): V3 | null {
  const a = t - (h.land - FLY);
  if (a < 0 || t >= h.land) return null;
  const L = landPoint(h), S: V3 = h.from === 'lane' ? [NUT_X + 11, 0.45, L[2]] : [L[0] + 1.6, 11, L[2] + 1.4];
  return v3.lerp(S, L, (a / FLY) ** 2);                    // accelerating into the impact
}

// --- the sky ---------------------------------------------------------------------------------------------------------------------------
const STARS = (() => { const r = rng(91); return Array.from({ length: 150 }, () => { const az = (r() - 0.5) * 2.6, el = 0.025 + r() ** 1.6 * 0.75; return { d: [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)] as V3, s: 0.8 + r() * 2.2, ph: r() * 6.28 }; }); })();
const SUN_DIR: V3 = [1, 0.085, 0];

const pts = (a: P2[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const line = (s: [P2, P2] | null, props: React.SVGProps<SVGLineElement>, key?: React.Key) =>
  s ? <line key={key} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} {...props} /> : null;
const quad = (c: Cam, x0: number, x1: number, z0: number, z1: number, y = 0) => polygon(c, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);

export type StageProps = {
  t: number; cam: Cam; hits: Hit[];
  /** times a light pulse leaves the nut and runs down all six strings (countdown ticks) */
  waves: number[];
  fretLit: number[];
  /** string names at the nut, 0..1 (the answer view) */
  names: number;
  /** distance the grid floor has scrolled towards the camera */
  scroll: number;
  /** 0..1: lime → pink on the pulses (the last seconds) */
  urgency: number;
};

export const Stage: React.FC<StageProps> = ({ t, cam, hits, waves, fretLit, names, scroll, urgency }) => {
  const hz = projectDir(cam, [cam.fw[0], 0, cam.fw[2]].every((v) => Math.abs(v) < 1e-6) ? [1, 0, 0] : [cam.fw[0], 0, cam.fw[2]]);
  const horizonY = hz && Math.abs(Math.hypot(cam.fw[0], cam.fw[2])) > 0.05 ? hz[1] : -9999;
  const sun = projectDir(cam, SUN_DIR);
  const sunR = cam.f * 0.3;
  const waveCol = urgency > 0.5 ? N.pink : N.lime;

  // floor grid: lines along the road and across it, the cross lines scrolling towards the camera
  const grid: React.ReactNode[] = [];
  for (let k = -16; k <= 16; k++) grid.push(line(segment(cam, [-60, FLOOR_Y, k * 2.2], [320, FLOOR_Y, k * 2.2]), { stroke: rgba(N.pink, k === 0 ? 0.0 : 0.26), strokeWidth: 1.6 }, `a${k}`));
  const off = ((scroll % 2.2) + 2.2) % 2.2;
  for (let k = 0; k < 90; k++) { const x = -40 + k * 2.2 - off; grid.push(line(segment(cam, [x, FLOOR_Y, -36], [x, FLOOR_Y, 36]), { stroke: rgba(N.pink, 0.26), strokeWidth: 1.6 }, `c${k}`)); }

  const live = hits.filter((h) => t >= h.land - FLY);
  const markers = live.filter((h) => t >= h.land).map((h) => ({ h, s: springAt(t, h.land, POP) * (h.gone === undefined ? 1 : 1 - clamp((t - h.gone) / 0.2) ** 2), age: t - h.land }))
    .filter((m) => m.s > 0.002).sort((a, b) => depth(cam, landPoint(b.h)) - depth(cam, landPoint(a.h)));

  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <filter id="bloom" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920} colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={6} result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation={20} result="b2" />
          <feMerge><feMergeNode in="b2" /><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="sky" gradientUnits="userSpaceOnUse" x1={0} y1={horizonY - 1100} x2={0} y2={horizonY}><stop offset={0} stopColor={N.skyTop} /><stop offset={1} stopColor={N.skyLow} /></linearGradient>
        <linearGradient id="haze" gradientUnits="userSpaceOnUse" x1={0} y1={horizonY} x2={0} y2={horizonY + 340}><stop offset={0} stopColor={N.skyLow} stopOpacity={1} /><stop offset={0.25} stopColor={N.skyLow} stopOpacity={0.65} /><stop offset={1} stopColor={N.skyLow} stopOpacity={0} /></linearGradient>
        <linearGradient id="sun" x1={0} y1={0} x2={0} y2={1}><stop offset={0} stopColor="#FFE3F6" /><stop offset={0.35} stopColor="#FF6FC8" /><stop offset={1} stopColor={N.violet} /></linearGradient>
        <radialGradient id="sunGlow"><stop offset={0} stopColor={N.pink} stopOpacity={0.42} /><stop offset={1} stopColor={N.pink} stopOpacity={0} /></radialGradient>
        <radialGradient id="glowL"><stop offset={0} stopColor={N.lime} stopOpacity={0.9} /><stop offset={0.35} stopColor={N.lime} stopOpacity={0.28} /><stop offset={1} stopColor={N.lime} stopOpacity={0} /></radialGradient>
        <radialGradient id="orb" cx={0.36} cy={0.3} r={0.85}><stop offset={0} stopColor="#FBFFE8" /><stop offset={0.4} stopColor={N.lime} /><stop offset={1} stopColor="#6FAE10" /></radialGradient>
        <linearGradient id="streak" x1={0} y1={0} x2={1} y2={0}><stop offset={0} stopColor={N.lime} stopOpacity={0} /><stop offset={0.5} stopColor="#F6FFD8" stopOpacity={1} /><stop offset={1} stopColor={N.lime} stopOpacity={0} /></linearGradient>
        {sun && (
          <mask id="sunMask" maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
            <circle cx={sun[0]} cy={sun[1]} r={sunR} fill="#fff" />
            {Array.from({ length: 7 }, (_, i) => { const y = sun[1] + sunR * (0.05 + i * 0.15), h = sunR * (0.025 + i * 0.017); return <rect key={i} x={sun[0] - sunR} y={y} width={sunR * 2} height={h} fill="#000" />; })}
          </mask>
        )}
      </defs>

      {/* sky, stars, sun */}
      <rect width={1080} height={1920} fill={horizonY > -9000 ? 'url(#sky)' : N.floor} />
      {STARS.map((s, i) => { const p = projectDir(cam, s.d); return p ? <circle key={i} cx={p[0]} cy={p[1]} r={s.s} fill="#fff" opacity={0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.1 + s.ph))} /> : null; })}
      {sun && <circle cx={sun[0]} cy={sun[1]} r={sunR * 2.6} fill="url(#sunGlow)" />}
      {sun && <rect x={sun[0] - sunR} y={sun[1] - sunR} width={sunR * 2} height={sunR * 2} fill="url(#sun)" mask="url(#sunMask)" />}

      {/* the floor */}
      <polygon points={polygon(cam, [[-60, FLOOR_Y, -400], [700, FLOOR_Y, -400], [700, FLOOR_Y, 400], [-60, FLOOR_Y, 400]])} fill={N.floor} />
      <g filter="url(#bloom)" opacity={0.9}>{grid}</g>
      {horizonY > -9000 && <rect x={0} y={horizonY - 1} width={1080} height={342} fill="url(#haze)" />}
      {horizonY > -9000 && <rect x={0} y={horizonY - 1.5} width={1080} height={3} fill={rgba(N.pink, 0.75)} filter="url(#bloom)" />}

      {/* the neck */}
      <polygon points={quad(cam, NUT_X + 0.3, END_X, -HALF - 0.25, HALF + 0.25, -0.3)} fill="rgba(0,0,0,0.55)" />
      <polygon points={quad(cam, NUT_X + 0.25, END_X, -HALF, HALF)} fill={N.board} />
      <g filter="url(#bloom)">
        {line(segment(cam, [NUT_X + 0.25, 0, HALF], [END_X, 0, HALF]), { stroke: N.violet, strokeWidth: 3 })}
        {line(segment(cam, [NUT_X + 0.25, 0, -HALF], [END_X, 0, -HALF]), { stroke: N.violet, strokeWidth: 3 })}
      </g>
      {[3, 5, 7, 9].map((n) => <polygon key={n} points={circleOnPlane(cam, (fretX(n - 1) + fretX(n)) / 2, 0, 0.2)} fill="rgba(255,255,255,0.13)" />)}
      {[-1.4, 1.4].map((z) => <polygon key={z} points={circleOnPlane(cam, (fretX(11) + fretX(12)) / 2, z, 0.2)} fill="rgba(255,255,255,0.13)" />)}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
        <polygon key={n} points={quad(cam, fretX(n) + 0.035, fretX(n) - 0.035, -HALF + 0.06, HALF - 0.06, 0.01)} fill={fretLit.includes(n) || fretLit.includes(n + 1) ? '#D9F3A8' : '#7E8594'} opacity={0.8} />
      ))}
      <polygon points={quad(cam, NUT_X + 0.25, NUT_X, -HALF, HALF, 0.02)} fill="#ECEFF5" />
      {GAUGE.map((g, s) => <polygon key={s} points={quad(cam, NUT_X + 0.1, END_X, stringZ(s) - g / 2, stringZ(s) + g / 2, 0.03)} fill={WOUND[s] ? '#A3AAB6' : '#F1F4FA'} />)}

      {/* fret numbers under the low-E edge, string names at the nut (answer view) */}
      {[1, 3, 5, 7, 9].map((n) => {
        const p = project(cam, [(fretX(n - 1) + fretX(n)) / 2, 0, -HALF - 0.62]), k = pxPerUnit(cam, [(fretX(n - 1) + fretX(n)) / 2, 0, -HALF - 0.62]);
        return p && k > 0 ? <text key={n} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={800} fontSize={Math.min(90, 0.58 * k)} fill={fretLit.includes(n) ? N.lime : 'rgba(255,255,255,0.36)'}>{n}</text> : null;
      })}
      {names > 0.01 && NAMES.map((nm, s) => { const p = project(cam, [NUT_X + 0.8, 0, stringZ(s)]); return p ? <text key={s} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={0.5 * pxPerUnit(cam, [NUT_X + 0.8, 0, 0])} fill={N.dim} opacity={names}>{nm}</text> : null; })}

      {/* everything that glows */}
      <g filter="url(#bloom)">
        {/* tick pulses running down the strings, nut → body */}
        {waves.map((w, i) => {
          const a = (t - w) / 0.75;
          if (a < 0 || a > 1) return null;
          const x = NUT_X - (NUT_X - END_X) * easeOut(a) * 1.05;
          return GAUGE.map((g, s) => line(segment(cam, [x + 1.1, 0.04, stringZ(s)], [x - 1.1, 0.04, stringZ(s)]), { stroke: waveCol, strokeWidth: Math.max(2, (g + 0.05) * pxPerUnit(cam, [x, 0, stringZ(s)])), strokeLinecap: 'round', opacity: 0.85 * (1 - a) }, `${i}-${s}`));
        })}
        {/* plucked strings: fretted point → bridge, a decaying 14 Hz shimmer */}
        {live.map((h) => {
          const a = t - h.land;
          if (a < 0 || a > 1.1) return null;
          const amp = 0.2 * Math.exp(-a * 5.5) * Math.cos(a * 2 * Math.PI * 14), z = stringZ(h.string), x0 = noteX(h.fret);
          const p: P2[] = [];
          for (let i = 0; i <= 30; i++) { const u = i / 30, q = project(cam, [x0 + (END_X - x0) * u, 0.04 + amp * Math.sin(Math.PI * u), z]); if (q) p.push(q); }
          return <polyline key={h.id} points={pts(p)} fill="none" stroke={N.lime} strokeWidth={Math.max(2.5, GAUGE[h.string] * 1.4 * pxPerUnit(cam, landPoint(h)))} strokeLinecap="round" opacity={Math.exp(-a * 2.4)} />;
        })}
        {/* shockwaves on the board */}
        {live.map((h) => {
          const L = landPoint(h), k = pxPerUnit(cam, L);
          return [0, 0.1].map((d, i) => {
            const a = (t - h.land - d) / 0.7;
            if (a < 0 || a >= 1) return null;
            return <polygon key={`${h.id}r${i}`} points={circleOnPlane(cam, L[0], L[2], 0.45 + (h.big ? 4.5 : 3) * easeOut(a), 0.02, 40)} fill="none" stroke={i ? N.white : N.lime} strokeWidth={Math.max(1.5, 0.08 * k * (1 - a))} opacity={1 - a} />;
          });
        })}
        {/* light pillars */}
        {live.map((h) => {
          const a = t - h.land;
          if (a < 0 || a > 1.1) return null;
          const L = landPoint(h), b = project(cam, L), top = project(cam, [L[0], (h.big ? 9 : 6) * easeOut(a / 0.12), L[2]]);
          if (!b || !top) return null;
          const w = (h.big ? 0.75 : 0.5) * pxPerUnit(cam, L) * (1 - 0.6 * clamp(a / 1.1));
          return (
            <g key={`${h.id}p`} opacity={Math.exp(-a * 3)}>
              <linearGradient id={`pg${h.id}`} gradientUnits="userSpaceOnUse" x1={b[0]} y1={b[1]} x2={top[0]} y2={top[1]}><stop offset={0} stopColor="#FAFFE6" /><stop offset={0.25} stopColor={N.lime} stopOpacity={0.8} /><stop offset={1} stopColor={N.lime} stopOpacity={0} /></linearGradient>
              <line x1={b[0]} y1={b[1]} x2={top[0]} y2={top[1]} stroke={`url(#pg${h.id})`} strokeWidth={w} strokeLinecap="round" />
            </g>
          );
        })}
        {/* sparks: thrown up from the impact, gravity pulls them back to the board */}
        {live.map((h) => {
          const a = t - h.land;
          if (a < 0 || a > 0.9) return null;
          const r = rng(h.id.split('').reduce((x, ch) => (x * 31 + ch.charCodeAt(0)) | 0, 7)), L = landPoint(h), n = h.big ? 34 : 20;
          return Array.from({ length: n }, (_, i) => {
            const vx = (r() - 0.5) * 6, vy = 2.5 + r() * 6, vz = (r() - 0.5) * 6, life = 0.45 + r() * 0.45, c = r();
            if (a > life) return null;
            const at = (s: number): V3 => [L[0] + vx * s, Math.max(0.02, vy * s - 7 * s * s), L[2] + vz * s];
            return line(segment(cam, at(Math.max(0, a - 0.035)), at(a)), { stroke: c < 0.25 ? N.white : c < 0.35 ? N.pink : N.lime, strokeWidth: Math.max(1.5, 0.07 * pxPerUnit(cam, at(a))), strokeLinecap: 'round', opacity: 1 - a / life }, `${h.id}s${i}`);
          });
        })}
        {/* the comets */}
        {live.map((h) => {
          const head = cometAt(h, t);
          if (!head) return null;
          const trail: V3[] = [];
          for (let i = 0; i <= 16; i++) { const q = cometAt(h, t - i * 0.012); if (!q) break; trail.push(q); }
          return (
            <g key={`${h.id}c`}>
              {trail.slice(1).map((q, i) => line(segment(cam, trail[i], q), { stroke: i < 3 ? '#F6FFD8' : N.lime, strokeWidth: Math.max(1, 0.34 * pxPerUnit(cam, q) * (1 - i / 16)), strokeLinecap: 'round', opacity: 0.95 * (1 - i / 16) }, i))}
              {(() => { const p = project(cam, head), k = pxPerUnit(cam, head); return p ? <><circle cx={p[0]} cy={p[1]} r={0.8 * k} fill="url(#glowL)" /><circle cx={p[0]} cy={p[1]} r={0.22 * k} fill="#fff" /></> : null; })()}
            </g>
          );
        })}
      </g>

      {/* the landed notes: a glow on the board and a lit orb resting on the string, numbered */}
      {markers.map(({ h, s, age }) => {
        const L = landPoint(h), k = pxPerUnit(cam, L), hot = age < (h.hotFor ?? 0.5) ? Math.exp(-age * 3) : 0;
        const c = project(cam, [L[0], 0.36 * s, L[2]]);
        if (!c || k <= 0) return null;
        const r = 0.4 * k * s * (h.big ? 1.25 : 1);
        return (
          <g key={`${h.id}m`}>
            <polygon points={circleOnPlane(cam, L[0], L[2], 1.3 * s, 0.015)} fill="url(#glowL)" opacity={0.35 + 0.65 * hot} />
            <circle cx={c[0]} cy={c[1]} r={r * 2.3} fill="url(#glowL)" opacity={0.25 + 0.55 * hot} />
            <circle cx={c[0]} cy={c[1]} r={r} fill="url(#orb)" stroke={hot > 0.2 ? '#fff' : 'none'} strokeWidth={Math.max(1, r * 0.09)} />
            {h.label && <text x={c[0]} y={c[1] + r * 0.06} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={900} fontSize={r * 1.1} fill="#0b1204">{h.label}</text>}
          </g>
        );
      })}

      {/* lens flare + anamorphic streak on each impact (screen space) */}
      {live.map((h) => {
        const a = t - h.land;
        if (a < 0 || a > 0.5) return null;
        const p = project(cam, [noteX(h.fret), 0.3, stringZ(h.string)]);
        if (!p) return null;
        const e = Math.exp(-a * 7) * (h.big ? 1.3 : 1);
        return (
          <g key={`${h.id}f`} style={{ mixBlendMode: 'screen' }}>
            <circle cx={p[0]} cy={p[1]} r={240 * e + 40} fill="url(#glowL)" opacity={0.8 * e} />
            <ellipse cx={p[0]} cy={p[1]} rx={620 * e + 60} ry={5 + 4 * e} fill="url(#streak)" opacity={e} />
          </g>
        );
      })}
    </svg>
  );
};
