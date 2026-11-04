// "Can you play it without tabs?" — #60's cut (src/king/KingNeon.tsx: hook · the melody once · your turn, no countdown, no
// answer, the camera cranes over to the top-down tab view; the same camera moves and timeline) in a warm, grown-up look: a rosewood
// fretboard under one tungsten lamp in a dark room, nickel frets, pearl inlays, bone nut, bronze and steel strings, film grain. A note
// is a spark of lamplight running down its string; it lands on its fret, unnumbered, as a warm glowing dot and stays. Serif type
// (Baskerville), cream on the brand's dark purple, lilac accents in the type, amber lamplight on the wood — no neon, glitch or flash. Ends by asking which song to play next.
// A pure function of the frame; every time comes from a king/tunes.mjs story (prop `tune`, #71 = `rising`), which also lays the soundtrack.
//   0–2.4 hook · 2.4–hold hear the melody · hold → end crane over the board, your turn, which song next
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { type Cam, type Pose, type V3, type P2, makeCam, aim, lerpPose, v3, project, segment, polygon, circleOnPlane, pxPerUnit, depth } from '../neon/cam';
import { NUT_X, fretX, noteX, stringZ } from '../neon/Stage';
import { SOFT, kick, ramp, springAt, type SpringCfg } from '../ten/motion';
import { clamp, easeOut, rng } from '../util';
import { TUNES } from '../../king/tunes.mjs';
import type { TuneStory } from '../../king/tunes.d.mts';

export const WOOD = {
  bg: '#1A0D2E',                                                          // the brand's dark purple (#57/#62's ground)
  board: '#55301C',
  boardFar: '#2C180D',
  grainDark: '#1A0B05',
  grainLight: '#8A5634',
  head: '#1B0F08',
  binding: '#E6D7B8',
  fret: '#A99B80',
  fretHi: '#FFF3D8',
  bone: '#EEE2C8',
  pearl: '#EFE8D8',
  bronze: '#C79A5B',
  steel: '#D8D4CB',
  amber: '#F2B566',
  ember: '#FF9A3C',
  cream: '#F3E9D6',
  lilac: '#B5ABFC',                                                       // the brand accent (app theme accentRamp 400)
  dim: 'rgba(214,206,253,0.62)',
};
export const SERIF = '"Baskerville", "Big Caslon", "Hoefler Text", Georgia, serif';
const CALM: SpringCfg = { damping: 18, stiffness: 140, mass: 0.9 };       // settles without a bounce: unhurried, as the look
const CRANE: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };      // as #60: fast, one visible overshoot

// --- geometry (world units: 1 = string to string; #56/#60's neck, so their camera framing holds) ----------------------------------------
const HALF = 3.17;
const END_X = fretX(12.6);
const HEAD_X = NUT_X + 4.6;                                                // the strings fade out this far past the nut
const GAUGE = [0.115, 0.095, 0.08, 0.06, 0.045, 0.038];
const WOUND = [true, true, true, true, false, false];
const STRING_Y = 0.09;
const NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];
const FLY = 0.42;
/** The room swallows the far neck: it fades into the dark instead of ending. */
const fog = (d: number) => Math.pow(clamp(1 - (d - 8) / 20), 1.4);

/** Grain: long wavy fibres along the neck, a few darker pores. Fixed by seed, so every frame draws the same wood. */
const GRAIN = (() => {
  const r = rng(1964);
  return Array.from({ length: 110 }, () => ({ z: -HALF + 0.05 + r() * (2 * HALF - 0.1), a: 0.03 + r() * 0.08, f: 0.25 + r() * 0.5, ph: r() * 6.28, dark: r() < 0.6, w: 0.01 + r() * 0.045, o: 0.3 + r() * 0.5 }));
})();

type Hit = { id: string; string: number; fret: number; land: number; gone?: number; big?: boolean };
/** What the neck draws for one story: its notes and its camera. */
export type Wood = { S: TuneStory; HITS: Hit[]; cameraAt: (t: number) => Pose };
const landPoint = (h: Hit): V3 => [noteX(h.fret), 0, stringZ(h.string)];
function sparkAt(h: Hit, t: number): V3 | null {
  const a = t - (h.land - FLY);
  if (a < 0 || t >= h.land) return null;
  const L = landPoint(h);
  return v3.lerp([NUT_X + 11, STRING_Y, L[2]], [L[0], STRING_Y, L[2]], (a / FLY) ** 2);   // accelerating into the landing
}

// --- the camera: #60's moves, unchanged ---------------------------------------------------------------------------------------------------
const pose = (pos: [number, number, number], target: [number, number, number], f: number, roll = 0): Pose => ({ pos, ...aim(pos, target), roll, f });
const P_TOP: Pose = { pos: [2.05, 14.6, 1.2], yaw: -Math.PI / 2, pitch: -Math.PI / 2, roll: 0, f: 1150 };   // straight down, a tab

/**
 * The neck for a story. `hook`: #60's opening hit lands a big note on frame 0. `enter`: when the camera leaves the low close shot on the
 * hook note for the road down the neck (#60: 0.22 s; the band cut: when it arrives from the stage).
 */
export function woodOf(S: TuneStory, { hook = true, enter = 0.22 }: { hook?: boolean; enter?: number } = {}): Wood {
  const { T, HEARD, HOOK_NOTE } = S;
  const HITS: Hit[] = [
    ...(hook ? [{ id: 'hook', string: HOOK_NOTE.string, fret: HOOK_NOTE.fret, land: 0, gone: 1.55, big: true }] : []),
    ...HEARD.map((n, i): Hit => {
      const next = HEARD.slice(i + 1).find((m) => m.string === n.string && m.fret === n.fret);
      return { id: `h${i}`, string: n.string, fret: n.fret, land: n.t, gone: next ? next.t - 0.06 : undefined };
    }),
  ];
  const P_HOOK = pose([1.4, 1.5, -4.1], [noteX(HOOK_NOTE.fret), 0.2, HOOK_NOTE.string - 2.5], 900, 0.1);   // low and close, on the hit
  /** Down the neck towards the nut; frets 0–4 mid-frame. A tune that reaches fret 5 gets #60's wider lens aimed a little towards the treble. */
  const P_ROAD = (S.MAX_FRET ?? 4) > 4 ? pose([-6.2, 4.6, 0], [4.6, 0, 0.5], 860) : pose([-6.2, 4.6, 0], [4, 0, 0], 1050);
  return { S, HITS, cameraAt: (t) => cameraAt(t, T, HITS, P_HOOK, P_ROAD, enter) };
}

function cameraAt(t: number, T: TuneStory['T'], HITS: Hit[], P_HOOK: Pose, P_ROAD: Pose, enter: number): Pose {
  let p = lerpPose(P_HOOK, P_ROAD, springAt(t, enter, SOFT));
  const pre = Math.sin(Math.PI * clamp((t - T.hold) / 0.22)) * (t < T.hold + 0.22 ? 1 : 0);
  p = lerpPose(p, P_TOP, springAt(t, T.hold + 0.2, CRANE));
  p = { ...p, pos: v3.add(p.pos, [-0.6 * pre, 0.25 * pre, 0]) };
  const road = 1 - clamp((t - T.hold - 0.2) / 0.4);
  p = { ...p, yaw: p.yaw + road * 0.025 * Math.sin(t * 0.7), pos: v3.add(p.pos, [0, road * 0.12 * Math.sin(t * 0.9), road * 0.28 * Math.sin(t * 0.45)]) };
  const c = makeCam(p);
  let push = 0;
  for (const h of HITS) { const a = t - h.land; if (a >= 0 && a < 0.5) push += (h.big ? 0.4 : 0.14) * kick(a, 10); }
  return { ...p, pos: v3.add(p.pos, v3.mul(c.fw, push)) };
}

// --- drawing helpers ----------------------------------------------------------------------------------------------------------------------
const pts = (a: P2[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
/** A world line cut into pieces, each fogged by its own depth; `width` in world units, so it thins with distance. */
function rod(cam: Cam, a: V3, b: V3, stroke: string, width: number, key: string, n = 10, opacity = 1, minPx = 0.8) {
  return Array.from({ length: n }, (_, i) => {
    const p = v3.lerp(a, b, i / n), q = v3.lerp(a, b, (i + 1) / n), m = v3.lerp(p, q, 0.5), s = segment(cam, p, q), o = fog(depth(cam, m)) * opacity;
    return s && o > 0.01 ? <line key={`${key}${i}`} x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={stroke} strokeWidth={Math.max(minPx, width * pxPerUnit(cam, m))} strokeLinecap="butt" opacity={o} /> : null;
  });
}
/** A wavy world polyline along x at depth-fogged opacity, in a few pieces. */
function fibre(cam: Cam, zAt: (x: number) => number, x0: number, x1: number, stroke: string, width: number, opacity: number, key: string) {
  const pieces = 6, per = 8;
  return Array.from({ length: pieces }, (_, i) => {
    const xa = x0 + ((x1 - x0) * i) / pieces, xb = x0 + ((x1 - x0) * (i + 1)) / pieces;
    const ps: P2[] = [];
    for (let j = 0; j <= per; j++) { const x = xa + ((xb - xa) * j) / per, q = project(cam, [x, 0.002, zAt(x)]); if (q) ps.push(q); }
    const m: V3 = [(xa + xb) / 2, 0, zAt((xa + xb) / 2)], o = fog(depth(cam, m)) * opacity;
    return ps.length > 1 && o > 0.01 ? <polyline key={`${key}${i}`} points={pts(ps)} fill="none" stroke={stroke} strokeWidth={Math.max(0.6, width * pxPerUnit(cam, m))} opacity={o} /> : null;
  });
}

// --- the guitar -------------------------------------------------------------------------------------------------------------------------
export const Guitar: React.FC<{ t: number; cam: Cam; names: number; w: Wood }> = ({ t, cam, names, w: { S: { T }, HITS } }) => {
  const live = HITS.filter((h) => t >= h.land - FLY);
  const lit = live.filter((h) => t >= h.land && (h.gone === undefined || t < h.gone));
  const dots = lit.map((h) => ({ h, s: springAt(t, h.land, CALM) * (h.gone === undefined ? 1 : 1 - clamp((t - h.gone) / 0.25) ** 2) }))
    .sort((a, b) => depth(cam, landPoint(b.h)) - depth(cam, landPoint(a.h)));

  // the board's tone runs from lamp-lit near the nut to the dark: a gradient along the projected neck, stops fogged by real depth
  const a = project(cam, [NUT_X, 0, 0]), b = project(cam, [END_X, 0, 0]);
  const axis = a && b ? [b[0] - a[0], b[1] - a[1]] : null, len2 = axis ? axis[0] ** 2 + axis[1] ** 2 : 0;
  const stops = axis && len2 > 4 ? Array.from({ length: 9 }, (_, i) => {
    const x = NUT_X + ((END_X - NUT_X) * i) / 8, q = project(cam, [x, 0, 0]);
    if (!q) return null;
    const off = clamp(((q[0] - a![0]) * axis[0] + (q[1] - a![1]) * axis[1]) / len2);
    const lamp = Math.exp(-(((x - noteX(2.5)) / 5) ** 2));               // the lamp sits over the first frets
    return { off, o: fog(depth(cam, [x, 0, 0])), lamp };
  }).filter((s): s is { off: number; o: number; lamp: number } => !!s).sort((p, q) => p.off - q.off) : [];

  const plucked = (s: number) => live.filter((h) => h.string === s && t >= h.land && t - h.land < 1.2).sort((p, q) => q.land - p.land)[0];

  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        {a && b && (
          <linearGradient id="boardTone" gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}>
            {stops.length ? stops.map((s, i) => <stop key={i} offset={s.off} stopColor={s.lamp > 0.5 ? WOOD.board : WOOD.boardFar} stopOpacity={s.o} />) : <stop offset={0} stopColor={WOOD.board} />}
          </linearGradient>
        )}
        <radialGradient id="pool"><stop offset={0} stopColor={WOOD.ember} stopOpacity={0.45} /><stop offset={0.55} stopColor={WOOD.ember} stopOpacity={0.16} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
        <radialGradient id="pearl" cx={0.4} cy={0.35} r={0.8}><stop offset={0} stopColor="#FFFFFF" /><stop offset={0.5} stopColor={WOOD.pearl} /><stop offset={1} stopColor="#B9B0A0" /></radialGradient>
        <radialGradient id="ember"><stop offset={0} stopColor="#FFF4DE" /><stop offset={0.35} stopColor={WOOD.amber} /><stop offset={0.7} stopColor={WOOD.ember} stopOpacity={0.55} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
        <radialGradient id="spill"><stop offset={0} stopColor={WOOD.amber} stopOpacity={0.5} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={3} /></filter>
        <filter id="halo" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={14} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* the headstock: a darker finish past the nut, lost in the dark */}
      <polygon points={polygon(cam, [[NUT_X + 0.2, -0.02, -HALF], [HEAD_X, -0.02, -HALF - 0.55], [HEAD_X + 0.4, -0.02, 0], [HEAD_X, -0.02, HALF + 0.55], [NUT_X + 0.2, -0.02, HALF]])} fill={WOOD.head} opacity={fog(depth(cam, [NUT_X + 2.3, 0, 0]))} />
      {/* the board's shadow side, the rosewood, its grain, the cream binding */}
      <polygon points={polygon(cam, [[NUT_X + 0.25, -0.18, -HALF - 0.1], [END_X, -0.18, -HALF - 0.1], [END_X, -0.18, HALF + 0.1], [NUT_X + 0.25, -0.18, HALF + 0.1]])} fill="#000" opacity={0.6} />
      <polygon points={polygon(cam, [[NUT_X + 0.25, 0, -HALF], [END_X, 0, -HALF], [END_X, 0, HALF], [NUT_X + 0.25, 0, HALF]])} fill="url(#boardTone)" />
      {GRAIN.map((g, i) => fibre(cam, (x) => g.z + g.a * Math.sin(x * g.f + g.ph) + 0.015 * Math.sin(x * 2.7 + g.ph * 3), NUT_X + 0.25, END_X, g.dark ? WOOD.grainDark : WOOD.grainLight, g.w, g.o * (g.dark ? 0.7 : 0.4), `g${i}`))}
      <polygon points={circleOnPlane(cam, noteX(2.5), 0.2, 5.2, 0.001, 48)} fill="url(#pool)" style={{ mixBlendMode: 'screen' }} />
      {[-HALF, HALF].map((z) => rod(cam, [NUT_X + 0.25, 0, z], [END_X, 0, z], WOOD.binding, 0.05, `bd${z}`, 10, 0.75))}

      {/* inlays, frets, nut */}
      {[3, 5, 7, 9].map((n) => { const x = (fretX(n - 1) + fretX(n)) / 2; return <polygon key={n} points={circleOnPlane(cam, x, 0, 0.21, 0.004, 28)} fill="url(#pearl)" opacity={0.92 * fog(depth(cam, [x, 0, 0]))} />; })}
      {[-1.5, 1.5].map((z) => { const x = (fretX(11) + fretX(12)) / 2; return <polygon key={z} points={circleOnPlane(cam, x, z, 0.21, 0.004, 28)} fill="url(#pearl)" opacity={0.92 * fog(depth(cam, [x, 0, z]))} />; })}
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
        <g key={`f${n}`}>
          {rod(cam, [fretX(n) - 0.05, 0, -HALF + 0.02], [fretX(n) - 0.05, 0, HALF - 0.02], '#000', 0.09, `fs${n}`, 4, 0.35)}
          {rod(cam, [fretX(n), 0.02, -HALF + 0.02], [fretX(n), 0.02, HALF - 0.02], WOOD.fret, 0.07, `fb${n}`, 4)}
          {rod(cam, [fretX(n) + 0.012, 0.035, -HALF + 0.06], [fretX(n) + 0.012, 0.035, HALF - 0.06], WOOD.fretHi, 0.018, `fh${n}`, 4, 0.8)}
        </g>
      ))}
      {rod(cam, [NUT_X + 0.12, 0.04, -HALF], [NUT_X + 0.12, 0.04, HALF], WOOD.bone, 0.24, 'nut', 4)}

      {/* the lamp's light where notes have landed: warm spill on the wood under each lit dot */}
      {dots.map(({ h, s }) => { const L = landPoint(h); return <polygon key={`${h.id}sp`} points={circleOnPlane(cam, L[0], L[2], (h.big ? 1.6 : 1.1) * s, 0.003, 32)} fill="url(#spill)" opacity={0.7 * fog(depth(cam, L))} style={{ mixBlendMode: 'screen' }} />; })}

      {/* strings: a soft shadow on the wood, then the string; a plucked one warms and trembles beyond its fret */}
      {Array.from({ length: 6 }, (_, s) => {
        const z = stringZ(s), g = GAUGE[s], col = WOUND[s] ? WOOD.bronze : WOOD.steel, p = plucked(s);
        const head = <g key={`hs${s}`}>{rod(cam, [NUT_X + 0.12, STRING_Y, z], [HEAD_X, STRING_Y, z], col, g, `sh${s}`, 6, 0.5 * (1 - names))}</g>;
        const shadow = rod(cam, [NUT_X, 0.001, z + 0.09], [END_X, 0.001, z + 0.09], '#000', g * 1.8, `ss${s}`, 10, 0.45);
        if (!p) return <g key={`s${s}`}>{head}<g filter="url(#soft)">{shadow}</g>{rod(cam, [NUT_X + 0.12, STRING_Y, z], [END_X, STRING_Y, z], col, g, `s${s}`)}{rod(cam, [NUT_X + 0.12, STRING_Y + 0.01, z - g * 0.25], [END_X, STRING_Y + 0.01, z - g * 0.25], '#FFF6E6', g * 0.3, `sl${s}`, 10, 0.5)}</g>;
        const age = t - p.land, x0 = noteX(p.fret), amp = 0.1 * Math.exp(-age * 5) * Math.cos(age * 2 * Math.PI * 9), warm = Math.exp(-age * 2.2);
        const curve: P2[] = [];
        for (let i = 0; i <= 30; i++) { const u = i / 30, q = project(cam, [x0 + (END_X - x0) * u, STRING_Y, z + amp * Math.sin(Math.PI * u)]); if (q) curve.push(q); }
        const k = pxPerUnit(cam, [x0 - 2, 0, z]);
        return (
          <g key={`s${s}`}>
            {head}
            <g filter="url(#soft)">{shadow}</g>
            {rod(cam, [NUT_X + 0.12, STRING_Y, z], [x0, STRING_Y, z], col, g, `sa${s}`, 4)}
            <polyline points={pts(curve)} fill="none" stroke={col} strokeWidth={Math.max(1, g * k)} />
            <polyline points={pts(curve)} fill="none" stroke={WOOD.amber} strokeWidth={Math.max(1, g * k * 1.3)} opacity={0.85 * warm} filter="url(#halo)" />
          </g>
        );
      })}

      {/* fret numbers by the low E, string names at the nut once the board is a tab */}
      {[3, 5, 7, 9].map((n) => {
        const P: V3 = [(fretX(n - 1) + fretX(n)) / 2, 0, -HALF - 0.45], p = project(cam, P), k = pxPerUnit(cam, P);
        return p && k > 0 ? <text key={n} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontStyle="italic" fontSize={Math.min(48, 0.38 * k)} fill={WOOD.dim} opacity={fog(depth(cam, P))}>{n}</text> : null;
      })}
      {names > 0.01 && NAMES.map((nm, s) => {
        const P: V3 = [NUT_X + 1.25, 0, stringZ(s)], p = project(cam, P);
        return p ? <text key={s} x={p[0] - 0.42 * pxPerUnit(cam, P)} y={p[1]} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize={0.42 * pxPerUnit(cam, P)} fill={WOOD.cream} opacity={names * 0.8}>{nm}</text> : null;
      })}

      {/* the closing glint: lamplight runs down every string, nut → body */}
      {(() => {
        const u = (t - T.sweep) / 0.9;
        if (u < 0 || u > 1) return null;
        const x = NUT_X - (NUT_X - END_X) * easeOut(u);
        return <g filter="url(#halo)">{Array.from({ length: 6 }, (_, s) => { const q = segment(cam, [x + 0.8, STRING_Y, stringZ(s)], [x - 0.8, STRING_Y, stringZ(s)]); return q ? <line key={s} x1={q[0][0]} y1={q[0][1]} x2={q[1][0]} y2={q[1][1]} stroke={WOOD.amber} strokeWidth={3} strokeLinecap="round" opacity={1 - u} /> : null; })}</g>;
      })()}

      {/* notes on their way: a spark of lamplight running down its string, a warm trail behind it */}
      <g filter="url(#halo)">
        {live.map((h) => {
          const head = sparkAt(h, t);
          if (!head) return null;
          const tail = sparkAt(h, Math.max(h.land - FLY, t - 0.14)) ?? head, s = segment(cam, tail, head), p = project(cam, head);
          if (!p) return null;
          return (
            <g key={`${h.id}c`}>
              {s && <line x1={s[0][0]} y1={s[0][1]} x2={s[1][0]} y2={s[1][1]} stroke={WOOD.amber} strokeWidth={Math.max(2, 0.06 * pxPerUnit(cam, head))} strokeLinecap="round" opacity={0.7} />}
              <circle cx={p[0]} cy={p[1]} r={Math.max(4, 0.11 * pxPerUnit(cam, head))} fill="#FFF4DE" />
            </g>
          );
        })}
      </g>

      {/* landings: one thin amber ring opens on the wood */}
      {live.map((h) => {
        const u = (t - h.land) / 0.8;
        if (u < 0 || u >= 1) return null;
        const L = landPoint(h);
        return <polygon key={`${h.id}r`} points={circleOnPlane(cam, L[0], L[2], 0.35 + (h.big ? 2.4 : 1.2) * easeOut(u), 0.004, 40)} fill="none" stroke={WOOD.amber} strokeWidth={2} opacity={0.65 * (1 - u)} />;
      })}

      {/* the landed notes: glowing embers on their string and fret, unnumbered; they stay */}
      {dots.map(({ h, s }) => {
        const L: V3 = [landPoint(h)[0], STRING_Y + 0.02, landPoint(h)[2]], p = project(cam, L), k = pxPerUnit(cam, L);
        if (!p || k <= 0 || s < 0.01) return null;
        const r = Math.min(70, 0.3 * k * (h.big ? 1.3 : 1)) * s * (1 + 0.1 * kick(t - h.land - 0.05, 8));
        return (
          <g key={`${h.id}d`}>
            <circle cx={p[0]} cy={p[1]} r={r * 2.4} fill="url(#ember)" opacity={0.55} />
            <circle cx={p[0]} cy={p[1]} r={r} fill="url(#ember)" />
            <circle cx={p[0]} cy={p[1]} r={r * 0.42} fill="#FFF7E8" />
          </g>
        );
      })}
    </svg>
  );
};

// --- type -------------------------------------------------------------------------------------------------------------------------------
const presence = (t: number, at: number, outAt?: number) => springAt(t, at, CALM) * (outAt === undefined ? 1 : 1 - ramp(t, outAt, outAt + 0.3));
/** A line of serif type: fades in while rising 20 px, leaves by fading. */
export const Line: React.FC<{ t: number; at: number; outAt?: number; y: number; size: number; italic?: boolean; color?: string; tracking?: number; children: React.ReactNode }> = ({ t, at, outAt, y, size, italic, color = WOOD.cream, tracking = 0, children }) => {
  const p = presence(t, at, outAt);
  if (p < 0.005) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, transform: `translateY(-50%) translateY(${(1 - Math.min(1, p)) * 20}px)`, opacity: Math.min(1, p), textAlign: 'center', fontFamily: SERIF, fontStyle: italic ? 'italic' : 'normal', fontSize: size, letterSpacing: `${tracking}em`, lineHeight: 1.08, color, whiteSpace: 'pre', textShadow: '0 2px 24px rgba(0,0,0,0.6)' }}>
      {children}
    </div>
  );
};
/** Small letter-spaced caps between two short rules. */
export const Caps: React.FC<{ t: number; at: number; outAt?: number; y: number; text: string; color?: string }> = ({ t, at, outAt, y, text, color = WOOD.dim }) => (
  <Line t={t} at={at} outAt={outAt} y={y} size={30} tracking={0.3} color={color}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 22 }}><span style={{ width: 54, height: 1.5, background: color }} />{text}<span style={{ width: 54, height: 1.5, background: color }} /></span>
  </Line>
);

/** "note n of N" while listening: small amber beads. */
export const Beads: React.FC<{ t: number; y: number; S: TuneStory; from?: number }> = ({ t, y, S: { T, HEARD }, from = T.listen + 0.15 }) => {
  const show = presence(t, from, T.hold);
  const d = Math.min(16, 960 / (1.7 * HEARD.length));                      // a long tune's beads shrink to stay inside the frame
  if (show < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: d * 0.7, opacity: show }}>
      {HEARD.map((n) => {
        const p = Math.min(1, springAt(t, n.t, CALM));
        return <div key={n.order} style={{ width: d, height: d, borderRadius: 99, border: `1.5px solid rgba(242,181,102,0.6)`, background: `rgba(242,181,102,${p})`, boxShadow: p > 0.1 ? `0 0 ${18 * p}px rgba(255,154,60,0.8)` : 'none', transform: `scale(${1 + 0.35 * p * kick(t - n.t, 6)})` }} />;
      })}
    </div>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
/** The tunes cut in this look: #71's Rising Sun, then the next ones from king/tunes.mjs. */
export const WOOD_TUNES = ['rising', 'canon', 'scarborough', 'greensleeves', 'birthday'] as const;
export type WoodTune = (typeof WOOD_TUNES)[number];
/** The soundtrack render-rising.mjs lays for a tune (#71 keeps its old name). */
export const woodWav = (tune: WoodTune) => (tune === 'rising' ? 'rising-wood.wav' : `wood-${tune}.wav`);
const WOODS = Object.fromEntries(WOOD_TUNES.map((id) => [id, woodOf(TUNES[id])])) as Record<WoodTune, Wood>;

/** The room behind the neck: a warm lamp glow above it, a lilac glow from the top. */
export const LampRoom: React.FC = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 45% at 55% 52%, rgba(120,62,24,0.38) 0%, rgba(70,36,60,0.2) 45%, rgba(0,0,0,0) 75%), radial-gradient(ellipse 90% 40% at 50% 8%, rgba(145,132,217,0.22) 0%, rgba(145,132,217,0) 70%)' }} />
);
/** The lens: vignette and film grain. */
export const Lens: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(10,4,20,0.7) 100%)' }} />
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.2 }}>
      <filter id="grainW" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={1 + (Math.floor(frame / 2) % 24)} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1080" height="1920" filter="url(#grainW)" />
    </svg>
  </>
);
/** Scene 3's type: your turn, and which song next. */
export const YourTurn: React.FC<{ t: number; T: TuneStory['T'] }> = ({ t, T }) => (
  <>
    <Line t={t} at={T.cta} y={300} size={150}>Your turn.</Line>
    <Caps t={t} at={T.sub} y={440} text="NO TABS · JUST YOUR EARS" />
    <Line t={t} at={T.comment} y={1560} size={66}>{'Which song should\nwe play '}<span style={{ fontStyle: 'italic', color: WOOD.lilac }}>next?</span></Line>
    <Caps t={t} at={T.comment + 0.35} y={1720} text="TELL US BELOW ↓" color={WOOD.lilac} />
  </>
);
/** Scrims so the type reads over the wood. */
export const SCRIM = 'linear-gradient(180deg, rgba(26,13,46,0.8) 0%, rgba(26,13,46,0.42) 26%, rgba(26,13,46,0) 40%, rgba(26,13,46,0) 70%, rgba(26,13,46,0.78) 92%)';

export const RisingWood: React.FC<{ silent?: boolean; tune?: WoodTune }> = ({ silent, tune = 'rising' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const W = WOODS[tune], { T } = W.S;
  const cam = makeCam(W.cameraAt(t));

  return (
    <AbsoluteFill style={{ background: WOOD.bg, overflow: 'hidden' }}>
      <LampRoom />
      <Guitar t={t} cam={cam} names={ramp(t, T.hold + 0.5, T.hold + 0.9)} w={W} />
      <AbsoluteFill style={{ background: SCRIM }} />

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.2} outAt={2.2} y={260} text="ONE LISTEN" />
      <Line t={t} at={-0.2} outAt={2.2} y={430} size={124}>Can you play it</Line>
      <Line t={t} at={0.15} outAt={2.2} y={575} size={124}><span style={{ fontStyle: 'italic', color: WOOD.lilac }}>without tabs?</span></Line>

      {/* scene 2 · hear the melody, once */}
      <Line t={t} at={T.listen + 0.05} outAt={T.hold} y={290} size={96} italic>Listen once.</Line>
      <Beads t={t} y={400} S={W.S} />

      {/* scene 3 · your turn, and which song next */}
      <YourTurn t={t} T={T} />
      <Lens frame={frame} />
      {!silent && <Audio src={staticFile(woodWav(tune))} />}
    </AbsoluteFill>
  );
};
