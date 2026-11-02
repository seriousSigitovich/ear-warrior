// "97% of guitarists can't play this by ear" — #60's cut (src/king/KingNeon.tsx: hook · the melody once · your turn, no countdown, no
// answer, the camera cranes over to the top-down tab view) in #57's minimal look (src/winter/TenWinter.tsx): one flat dark-purple ground,
// the neck in perspective drawn as hairlines that dissolve with distance, white dots, thin type — no glow, grain, glitch, flash or colour.
// A note slides down its string as a white point with a hairline trail and lands on its fret, unnumbered, and stays. A pure function of
// the frame; every time comes from ../../toccata/story.mjs, which also lays the soundtrack.
//   0 the hook's hit · 1–4 the melody, under the hook's words · 4.35–6.8 crane over the board, your turn, comment the notes → loop
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { type Cam, type Pose, type V3, type P2, makeCam, aim, lerpPose, v3, project, segment, circleOnPlane, pxPerUnit, depth } from '../neon/cam';
import { NUT_X, fretX, noteX, stringZ } from '../neon/Stage';
import { SOFT, kick, ramp, springAt, type SpringCfg } from '../ten/motion';
import { clamp, easeOut } from '../util';
import { W, FONT, Line, Caps, CALM } from '../winter/TenWinter';
import { Pips } from '../spring/SpringBounce';
import { T, HEARD, HOOK_NOTE } from '../../toccata/story.mjs';

const CRANE: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };       // as #60: fast, one visible overshoot

// --- the board's geometry (world units: 1 = string to string; the same neck as #56/#60, so their camera framing holds) -----------------
const HALF = 3.17;
const END_X = fretX(12.6);
const NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];
const FLY = 0.42;                                                          // seconds a note slides down its string before it lands
/** Haze: the far neck dissolves into the ground instead of ending. */
const fog = (d: number) => Math.pow(clamp(1 - (d - 7) / 22), 1.3);

type Hit = { id: string; string: number; fret: number; land: number; gone?: number; big?: boolean };
const landPoint = (h: Hit): V3 => [noteX(h.fret), 0, stringZ(h.string)];
function pointAt(h: Hit, t: number): V3 | null {
  const a = t - (h.land - FLY);
  if (a < 0 || t >= h.land) return null;
  const L = landPoint(h);
  return v3.lerp([NUT_X + 11, 0.04, L[2]], L, (a / FLY) ** 2);              // accelerating into the landing
}

const HITS: Hit[] = [
  { id: 'hook', string: HOOK_NOTE.string, fret: HOOK_NOTE.fret, land: 0, gone: 1.55, big: true },
  ...HEARD.map((n, i): Hit => {
    const next = HEARD.slice(i + 1).find((m) => m.string === n.string && m.fret === n.fret);
    return { id: `h${i}`, string: n.string, fret: n.fret, land: n.t, gone: next ? next.t - 0.06 : undefined };
  }),
];

// --- the camera: #60's moves --------------------------------------------------------------------------------------------------------------
const pose = (pos: [number, number, number], target: [number, number, number], f: number, roll = 0): Pose => ({ pos, ...aim(pos, target), roll, f });
const HOOK_AT: [number, number, number] = [noteX(HOOK_NOTE.fret), 0.2, HOOK_NOTE.string - 2.5];
const P_HOOK = pose([noteX(HOOK_NOTE.fret) + 1.4, 1.5, -4.1], HOOK_AT, 900, 0.1);   // low and close, on the hit
const P_ROAD = pose([-6.2, 4.6, 0], [4, 0, 0], 1050);                      // down the neck towards the nut; frets 0–4 mid-frame
const P_TOP: Pose = { pos: [2.05, 14.6, 1.2], yaw: -Math.PI / 2, pitch: -Math.PI / 2, roll: 0, f: 1150 };   // straight down, a tab

function cameraAt(t: number): Pose {
  let p = lerpPose(P_HOOK, P_ROAD, springAt(t, 0.22, SOFT));               // hold on the hit, then pull back to reveal the neck
  const pre = Math.sin(Math.PI * clamp((t - T.hold) / 0.22)) * (t < T.hold + 0.22 ? 1 : 0);   // anticipation: a short lean back
  p = lerpPose(p, P_TOP, springAt(t, T.hold + 0.2, CRANE));
  p = { ...p, pos: v3.add(p.pos, [-0.6 * pre, 0.25 * pre, 0]) };
  const road = 1 - clamp((t - T.hold - 0.2) / 0.4);                         // never still: a slow drift while on the neck
  p = { ...p, yaw: p.yaw + road * 0.025 * Math.sin(t * 0.7), pos: v3.add(p.pos, [0, road * 0.12 * Math.sin(t * 0.9), road * 0.28 * Math.sin(t * 0.45)]) };
  const c = makeCam(p);
  let push = 0;                                                             // each landing nudges the camera forward
  for (const h of HITS) { const a = t - h.land; if (a >= 0 && a < 0.5) push += (h.big ? 0.4 : 0.14) * kick(a, 10); }
  return { ...p, pos: v3.add(p.pos, v3.mul(c.fw, push)) };
}

// --- the board, drawn as hairlines ------------------------------------------------------------------------------------------------------
const pts = (a: P2[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
/** A world line cut into pieces, each fogged by its own depth. */
function hairline(cam: Cam, a: V3, b: V3, stroke: string, width: number, key: string, n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const p = v3.lerp(a, b, i / n), q = v3.lerp(a, b, (i + 1) / n), s = segment(cam, p, q), o = fog(depth(cam, v3.lerp(p, q, 0.5)));
    return s && o > 0.01 ? <line key={`${key}${i}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={stroke} strokeWidth={width} strokeLinecap="round" opacity={o} /> : null;
  });
}

const Board: React.FC<{ t: number; cam: Cam; names: number }> = ({ t, cam, names }) => {
  const live = HITS.filter((h) => t >= h.land - FLY);
  const lit = live.filter((h) => t >= h.land && (h.gone === undefined || t < h.gone));
  const dots = lit.map((h) => ({ h, s: springAt(t, h.land, CALM) * (h.gone === undefined ? 1 : 1 - clamp((t - h.gone) / 0.2) ** 2) }))
    .sort((a, b) => depth(cam, landPoint(b.h)) - depth(cam, landPoint(a.h)));
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {/* frets, nut, strings */}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => hairline(cam, [fretX(n), 0, -HALF + 0.3], [fretX(n), 0, HALF - 0.3], lit.some((h) => h.fret === n || h.fret === n + 1) ? W.dim : W.hair, 1.5, `f${n}`, 4))}
      {hairline(cam, [NUT_X, 0, -HALF + 0.3], [NUT_X, 0, HALF - 0.3], W.dim, 4, 'nut', 4)}
      {Array.from({ length: 6 }, (_, s) => {
        const w = 1 + (5 - s) * 0.22, z = stringZ(s);
        const p = live.filter((h) => h.string === s && t >= h.land && t - h.land < 0.9).sort((a, b) => b.land - a.land)[0];
        if (!p) return hairline(cam, [NUT_X, 0, z], [END_X, 0, z], W.dim, w, `s${s}`);
        // plucked: the fretted part stays still, the rest trembles once and settles, as #57
        const age = t - p.land, x0 = noteX(p.fret), amp = 0.12 * Math.exp(-age * 6) * Math.cos(age * 2 * Math.PI * 11);
        const curve: P2[] = [];
        for (let i = 0; i <= 30; i++) { const u = i / 30, q = project(cam, [x0 + (END_X - x0) * u, 0, z + amp * Math.sin(Math.PI * u)]); if (q) curve.push(q); }
        return (
          <g key={`s${s}`}>
            {hairline(cam, [NUT_X, 0, z], [x0, 0, z], W.dim, w, `s${s}a`, 4)}
            <polyline points={pts(curve)} fill="none" stroke={W.ink} strokeWidth={w + 0.5} opacity={0.55 + 0.45 * Math.exp(-age * 3)} />
          </g>
        );
      })}

      {/* fret numbers under the low E, string names at the nut once the board is a tab */}
      {[3, 5, 7, 9].map((n) => {
        const P: V3 = [(fretX(n - 1) + fretX(n)) / 2, 0, -HALF - 0.4], p = project(cam, P), k = pxPerUnit(cam, P);
        return p && k > 0 ? <text key={n} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={400} fontSize={Math.min(48, 0.36 * k)} fill={W.dim} opacity={fog(depth(cam, P))}>{n}</text> : null;
      })}
      {names > 0.01 && NAMES.map((nm, s) => {
        const P: V3 = [NUT_X + 1.25, 0, stringZ(s)], p = project(cam, P);
        return p ? <text key={s} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={400} fontSize={0.4 * pxPerUnit(cam, P)} fill={W.dim} opacity={names}>{nm}</text> : null;
      })}

      {/* the closing line: a short hairline runs down every string, nut → body */}
      {(() => {
        const a = (t - T.sweep) / 0.75;
        if (a < 0 || a > 1) return null;
        const x = NUT_X - (NUT_X - END_X) * easeOut(a);
        return Array.from({ length: 6 }, (_, s) => {
          const q = segment(cam, [x + 0.9, 0, stringZ(s)], [x - 0.9, 0, stringZ(s)]);
          return q ? <line key={s} x1={q[0][0]} y1={q[0][1]} x2={q[1][0]} y2={q[1][1]} stroke={W.ink} strokeWidth={2.5} strokeLinecap="round" opacity={1 - a} /> : null;
        });
      })()}

      {/* notes on their way: a white point sliding down its string, a hairline behind it */}
      {live.map((h) => {
        const head = pointAt(h, t);
        if (!head) return null;
        const tail = pointAt(h, Math.max(h.land - FLY, t - 0.16)) ?? head, s = segment(cam, tail, head), p = project(cam, head);
        if (!p) return null;
        return (
          <g key={`${h.id}c`}>
            {s && <line x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={W.ink} strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />}
            <circle cx={p[0]} cy={p[1]} r={Math.max(3, 0.1 * pxPerUnit(cam, head))} fill={W.ink} />
          </g>
        );
      })}

      {/* landings: one hairline ring opens on the board */}
      {live.map((h) => {
        const a = (t - h.land) / 0.7;
        if (a < 0 || a >= 1) return null;
        const L = landPoint(h);
        return <polygon key={`${h.id}r`} points={circleOnPlane(cam, L[0], L[2], 0.35 + (h.big ? 2.6 : 1.3) * easeOut(a), 0, 40)} fill="none" stroke={W.ink} strokeWidth={1.5} opacity={0.6 * (1 - a)} />;
      })}

      {/* the landed notes: white dots on their string and fret, unnumbered; they stay */}
      {dots.map(({ h, s }) => {
        const L = landPoint(h), p = project(cam, L), k = pxPerUnit(cam, L);
        if (!p || k <= 0 || s < 0.01) return null;
        const r = Math.min(64, 0.3 * k * (h.big ? 1.3 : 1)) * s * (1 + 0.12 * kick(t - h.land - 0.05, 8));
        return <circle key={`${h.id}d`} cx={p[0]} cy={p[1]} r={r} fill={W.ink} />;
      })}
    </svg>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const ToccataMinimal: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = makeCam(cameraAt(t));

  return (
    <AbsoluteFill style={{ background: W.bg, fontFamily: FONT, overflow: 'hidden' }}>
      <Board t={t} cam={cam} names={ramp(t, T.hold + 0.5, T.hold + 0.9)} />

      {/* the hook, and the melody under it: the words stay up until the last note has rung */}
      <Caps t={t} at={-0.3} outAt={T.hold} y={280} text="ONE LISTEN · NO TABS" />
      <Line t={t} at={-0.3} outAt={T.hold} y={420} size={84}><span style={{ fontWeight: 500 }}>97%</span> of guitarists</Line>
      <Line t={t} at={0.15} outAt={T.hold} y={600} size={112}>{'can’t play this\nby ear.'}</Line>
      <Pips t={t} y={725} notes={HEARD} from={T.listen} to={T.hold} />

      {/* scene 3 · your turn */}
      <Line t={t} at={T.cta} y={330} size={150}>Your turn</Line>
      <Line t={t} at={T.sub} y={470} size={38} weight={400} color={W.dim}>No tabs. Just your ears.</Line>
      <Line t={t} at={T.comment} y={1600} size={56} weight={400}>Comment the notes ↓</Line>

      {!silent && <Audio src={staticFile('toccata-minimal.wav')} />}
    </AbsoluteFill>
  );
};
