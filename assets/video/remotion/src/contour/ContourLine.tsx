// "Can you play it without tabs?" — #71's wood-cut film (hook · the melody once · your turn · which song next) with the guitar taken out:
// viewers complained the neck is a tab. The melody is one fine line of light that draws its own contour as it sounds — height = pitch,
// length = time — a pen of lamplight writing in the dark. Same room, type, grain, timeline and soundtrack as RisingWood.
// Motion (assets/video/remotion/README "Animation principles"):
//   · anticipation — the waiting dot recoils before the pen sets off; the camera pushes in a touch before it pulls back to the reveal
//   · follow-through — the camera trails the pen (an exponential lag, not a lock), each leap of pitch overshoots and settles like a voice
//   · overshoot — knots pop on a spring, the reveal lands with one visible overshoot (CRANE)
//   · hold — the last note's knot rests while the line is still, before "your turn"
//   · secondary action — ripples and motes at each knot, parallax dust in the room, a light that runs the whole line at the end
//   · idle breathing — the dot and the room never freeze
// Pure function of the frame; every time from the king/tunes.mjs story (prop `tune`), which also lays the soundtrack (render-contour.mjs).
//   0–2.4 hook (the dot) · 2.4–hold the line draws the melody · hold → end pull back to the whole contour, your turn, which song next
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { POP, kick, ramp, springAt, type SpringCfg } from '../ten/motion';
import { clamp, easeOut, rng } from '../util';
import { TUNES } from '../../king/tunes.mjs';
import type { TuneStory } from '../../king/tunes.d.mts';
import { WOOD, LampRoom, Lens, Line, Caps, YourTurn, SCRIM } from '../rising/RisingWood';

const CALM: SpringCfg = { damping: 18, stiffness: 140, mass: 0.9 };
const CRANE: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };

// --- the line's geometry (world px: x = time, y = pitch; screen maps below) ---------------------------------------------------------
const PX = 340;                 // px per second of music
const SEMI = 44;                // px per semitone
const PEN_AT = 0.62;            // where the pen rides across the frame once the camera has caught up
const LINE_Y = 1010;            // screen y of the middle of the tune's range
const MARGIN = 90;              // the revealed contour's side margins
const LEAD = 0.3;               // the pen sets off this long before the first note, so the line arrives at it
const ROW_Y = [830, 1260];      // the revealed contour: one row per phrase, like lines of verse
const SY = 0.78;                // the revealed rows' pitch scale
/** Where each tune's second phrase starts (a note index): the reveal folds the line into two rows there. */
const SPLIT: Record<string, number> = { brahms: 13 };
const sine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));   // the glide's ease: a slow, even S

type Note = { t: number; midi: number; i: number };
export type Contour = ReturnType<typeof contourOf>;

export function contourOf(S: TuneStory) {
  const { T, HEARD } = S;
  const notes: Note[] = HEARD.map((n, i) => ({ t: n.t, midi: n.midi, i }));
  const lo = Math.min(...notes.map((n) => n.midi)), hi = Math.max(...notes.map((n) => n.midi));
  const mid = (lo + hi) / 2;
  const tS = T.listenAt - LEAD, tE = T.hold;            // the pen moves from tS, stops on the hold
  const X0 = 540;
  const xAt = (tau: number) => X0 + clamp(tau - tS, 0, tE - tS) * PX;
  const yOf = (m: number) => -(m - mid) * SEMI;
  /** How long the line leans into note k: most of a short note, up to 0.32 s of a long one — it lands exactly on the onset. */
  const glide = (k: number) => Math.min(0.32, 0.6 * (notes[k].t - notes[k - 1].t));
  /** The pitch line at time tau: each note a plateau, then a slow S into the next pitch that arrives on its onset. */
  const yAt = (tau: number) => {
    let y = yOf(notes[0].midi);
    for (let k = 1; k < notes.length; k++) {
      const g = glide(k), g0 = notes[k].t - g;
      if (tau <= g0) break;
      y += (yOf(notes[k].midi) - yOf(notes[k - 1].midi)) * sine((tau - g0) / g);
    }
    return y;
  };
  const split = SPLIT[S.id] ?? notes.length;
  const tSplit = split < notes.length ? notes[split].t - glide(split) : Infinity;   // the second phrase starts where its first glide does
  const rowOf = (tau: number) => (tau < tSplit ? 0 : 1);
  const rowX = [X0, xAt(Math.min(tSplit, tE))];
  const fit = (1080 - 2 * MARGIN) / Math.max(...rowX.map((x, r) => (r ? xAt(tE) - x : Math.min(xAt(tE), rowX[1]) - x)));
  return { S, notes, lo, hi, tS, tE, tSplit, X0, X1: xAt(tE), xAt, yAt, yOf, rowOf, rowX, fit, rows: tSplit < tE ? 2 : 1 };
}

// --- the camera -----------------------------------------------------------------------------------------------------------------------
const softMax0 = (x: number, k = 60) => k * Math.log1p(Math.exp(x / k));   // max(0, x) without a kink, so the camera eases into the follow
/** The camera's x while listening: it trails the pen with an exponential lag (τ ≈ 0.28 s) — follow-through, never a hard lock. */
function followX(C: Contour, t: number) {
  let s = 0, w = 0;
  for (let k = 0; k <= 36; k++) { const wk = Math.exp(-k / 11); s += wk * C.xAt(t - k * 0.025); w += wk; }
  return softMax0(s / w - PEN_AT * 1080);
}
type Map = (x: number, y: number, row: number) => [number, number];
/** World → screen. Listening: the camera rides the pen. From the hold: one spring pulls back until the whole contour fits the frame. */
function mapAt(C: Contour, t: number, cover = false): { map: Map } {
  const { T } = C.S;
  const camX = followX(C, t);
  const one = C.rows === 1;
  const rAt = (row: number) => (cover ? 1 : springAt(t, T.hold + 0.25 + row * 0.09, CRANE));   // the rows land staggered
  const r = rAt(0);
  const pre = !cover && t > T.hold && t < T.hold + 0.25 ? Math.sin(Math.PI * (t - T.hold) / 0.25) : 0;   // anticipation: a push in
  let push = 0;
  if (!cover) for (const n of C.notes) { const a = t - n.t; if (a >= 0 && a < 0.6) push += 0.012 * kick(a, 9); }
  push += 0.05 * kick(t, 6) + 0.035 * pre;                         // the hook hit, the pre-reveal push
  const penX = C.xAt(t) - camX, penY = LINE_Y + C.yAt(t);
  const map: Map = (x, y, row) => {
    const ax = x - camX, ay = LINE_Y + y, rr = rAt(row);
    const bx = MARGIN + (x - C.rowX[row]) * C.fit, by = (one ? LINE_Y : ROW_Y[row]) + (cover ? 90 : 0) + y * SY;   // the cover clears the hook's type
    let sx = ax + (bx - ax) * rr, sy = ay + (by - ay) * rr;
    const z = 1 + push * (1 - Math.min(1, r));                     // pushes centre on the pen while it writes
    sx = penX + (sx - penX) * z; sy = penY + (sy - penY) * z;
    return [sx, sy];
  };
  return { map };
}

// --- the room's dust: slow motes at three depths, drifting against the camera (parallax sells the travel) --------------------------------
const DUST = (() => { const r = rng(1868); return Array.from({ length: 34 }, () => ({ x: r() * 2400, y: r() * 1920, z: 0.15 + r() * 0.55, s: 1.5 + r() * 4, ph: r() * 6.28, o: 0.08 + r() * 0.22 })); })();
const Dust: React.FC<{ t: number; camX: number }> = ({ t, camX }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    {DUST.map((d, i) => {
      const x = ((((d.x - camX * d.z + 8 * Math.sin(t * 0.3 + d.ph)) % 2400) + 2400) % 2400) - 600;
      const y = d.y - 14 * t * d.z + 10 * Math.sin(t * 0.4 + d.ph);
      return <circle key={i} cx={x} cy={((y % 1920) + 1920) % 1920} r={d.s * (0.6 + d.z)} fill={i % 3 ? WOOD.lilac : WOOD.amber} opacity={d.o * (0.75 + 0.25 * Math.sin(t * 1.3 + d.ph))} filter="url(#dustBlur)" />;
    })}
    <defs><filter id="dustBlur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={2.2} /></filter></defs>
  </svg>
);

const pts = (a: [number, number][]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const MOTES = (() => { const r = rng(49); return Array.from({ length: 200 }, () => ({ a: -Math.PI / 2 + (r() - 0.5) * 2.2, v: 40 + r() * 70, s: 1.4 + r() * 2.2 })); })();

/** The line, its knots and its pen. `cover`: the whole contour, fully drawn, in the revealed frame. */
const Pen: React.FC<{ t: number; C: Contour; cover?: boolean }> = ({ t, C, cover = false }) => {
  const { T } = C.S;
  const { map } = mapAt(C, t, cover);
  const now = cover ? C.tE : Math.min(t, C.tE);
  const drawing = now > C.tS;

  // the line between two times, sampled at 1/120 s in screen space (strokes keep their width through the reveal), one run per row
  const runs = (a: number, b: number): [number, number][][] => {
    const out: [number, number][][] = [[], []];
    if (b <= a) return [];
    const at = (tau: number) => out[C.rowOf(tau)].push(map(C.xAt(tau), C.yAt(tau), C.rowOf(tau)));
    for (let tau = a; tau < b; tau += 1 / 120) at(tau);
    at(b);
    if (a < C.tSplit && b > C.tSplit) out[0].push(map(C.xAt(C.tSplit), C.yAt(C.tSplit), 0));   // row 0 runs to the fold
    return out.filter((r) => r.length > 1);
  };
  const path = drawing ? runs(C.tS, now) : [];
  const tail = drawing ? runs(Math.max(C.tS, now - 0.45), now) : [];
  const head = map(C.xAt(now), C.yAt(now), C.rowOf(now));

  // the closing light runs the whole line, left → right
  const sw = cover ? -1 : (t - T.sweep) / 1.1, sweeping = sw > 0 && sw < 1;
  const sweepAt = C.tS + easeOut(clamp(sw)) * (C.tE - C.tS);
  const glint = sweeping ? runs(Math.max(C.tS, sweepAt - 0.5), sweepAt) : [];

  // the dot before the pen sets off: pops on the hook hit, breathes, recoils (anticipation) as the pen is about to leave
  const dotIn = cover ? 1 : springAt(t, 0, POP);
  const recoil = !cover && t > C.tS - 0.28 && t < C.tS ? -16 * Math.sin(Math.PI * (t - (C.tS - 0.28)) / 0.28) : 0;
  const breathe = 1 + 0.06 * Math.sin(t * 3.1);
  const start = map(C.X0 + recoil, C.yOf(C.notes[0].midi), 0);
  const penOn = cover ? 0 : 1 - ramp(t, C.tE + 0.15, C.tE + 0.7);   // the pen's light goes out on the hold; the line stays
  const lineIn = cover ? 1 : ramp(t, 0.05, 0.9);

  // the faint horizon the dot waits on, gone once the melody starts
  const horizon = cover ? 0 : ramp(t, 0.3, 1.1) * (1 - ramp(t, C.tS, C.tS + 0.6));

  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="ink" gradientUnits="userSpaceOnUse" x1={head[0] - 900} y1={0} x2={head[0]} y2={0}>
          <stop offset={0} stopColor={WOOD.lilac} stopOpacity={0.85} />
          <stop offset={0.7} stopColor={WOOD.lilac} />
          <stop offset={1} stopColor={WOOD.cream} />
        </linearGradient>
        <linearGradient id="horizon" x1={0} x2={1}>
          <stop offset={0} stopColor={WOOD.lilac} stopOpacity={0} />
          <stop offset={0.35} stopColor={WOOD.lilac} stopOpacity={0.5} />
          <stop offset={1} stopColor={WOOD.lilac} stopOpacity={0} />
        </linearGradient>
        <radialGradient id="nib"><stop offset={0} stopColor="#FFF6E6" /><stop offset={0.3} stopColor={WOOD.amber} stopOpacity={0.8} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
        <radialGradient id="knotGlow"><stop offset={0} stopColor={WOOD.amber} stopOpacity={0.7} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
        <filter id="glow" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}><feGaussianBlur stdDeviation={12} /></filter>
        <filter id="halo" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={6} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {horizon > 0.01 && <line x1={0} y1={start[1]} x2={1080} y2={start[1]} stroke="url(#horizon)" strokeWidth={1.5} opacity={horizon} strokeDasharray="2 10" />}

      {/* the line: a wide soft bloom, then the ink, then the warm fresh stretch behind the pen */}
      {path.map((p, i) => <polyline key={`b${i}`} points={pts(p)} fill="none" stroke={WOOD.lilac} strokeWidth={18} strokeLinejoin="round" strokeLinecap="round" opacity={0.32 * lineIn} filter="url(#glow)" />)}
      {path.map((p, i) => <polyline key={`i${i}`} points={pts(p)} fill="none" stroke="url(#ink)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" opacity={lineIn} />)}
      {tail.map((p, i) => <polyline key={`t${i}`} points={pts(p)} fill="none" stroke={WOOD.amber} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" opacity={0.9 * penOn} filter="url(#halo)" />)}
      {glint.map((p, i) => <polyline key={`g${i}`} points={pts(p)} fill="none" stroke="#FFF6E6" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={Math.sin(Math.PI * sw)} filter="url(#halo)" />)}

      {/* knots: each note lands as a bead that pops on a spring, sends one ripple and a few motes, then cools to a small ember */}
      {C.notes.map((n) => {
        if (!cover && t < n.t) return null;
        const age = cover ? 9 : t - n.t, last = n.i === C.notes.length - 1;
        const [x, y] = map(C.xAt(n.t), C.yOf(n.midi), C.rowOf(n.t));
        const pop = cover ? 1 : springAt(t, n.t, POP);
        const lit = kick(age, 2.6);
        const swept = sweeping ? kick(Math.abs(sweepAt - n.t), 9) * Math.sin(Math.PI * sw) : 0;   // the closing light passes
        const r = (last ? 11 : 7) * pop * (1 + 0.5 * lit + 0.6 * swept);
        const ripple = clamp(age / 0.75);
        return (
          <g key={n.i}>
            <circle cx={x} cy={y} r={r * 4.2} fill="url(#knotGlow)" opacity={Math.max(0.25 * pop, 0.9 * lit, swept) * (last ? 1.4 : 1)} />
            {ripple < 1 && <circle cx={x} cy={y} r={10 + 70 * easeOut(ripple) * (last ? 1.8 : 1)} fill="none" stroke={WOOD.amber} strokeWidth={2} opacity={0.6 * (1 - ripple)} />}
            {age < 0.9 && MOTES.slice((n.i * 4) % 196, (n.i * 4) % 196 + 4).map((m, k) => {
              const d = m.v * easeOut(age / 0.9);
              return <circle key={k} cx={x + Math.cos(m.a) * d} cy={y + Math.sin(m.a) * d - 12 * age} r={m.s} fill={WOOD.amber} opacity={0.8 * (1 - age / 0.9)} />;
            })}
            <circle cx={x} cy={y} r={r} fill={lit > 0.3 || swept > 0.3 ? '#FFF6E6' : WOOD.cream} stroke={WOOD.amber} strokeWidth={1.5} />
          </g>
        );
      })}

      {/* the dot that waits through the hook, the pen once it moves */}
      {!drawing && dotIn > 0.01 && <>
        <circle cx={start[0]} cy={start[1]} r={70 * dotIn * breathe} fill="url(#nib)" opacity={0.85} />
        <circle cx={start[0]} cy={start[1]} r={12 * dotIn * breathe} fill="#FFF6E6" />
        {[0, 0.12].map((d) => { const u = clamp((t - d) / 1.1); return u > 0 && u < 1 ? <circle key={d} cx={start[0]} cy={start[1]} r={14 + 260 * easeOut(u)} fill="none" stroke={WOOD.amber} strokeWidth={2.5 - d * 8} opacity={0.7 * (1 - u)} /> : null; })}
      </>}
      {drawing && penOn > 0.01 && <g opacity={penOn}>
        <circle cx={head[0]} cy={head[1]} r={64 * breathe} fill="url(#nib)" opacity={0.9} />
        <circle cx={head[0]} cy={head[1]} r={10} fill="#FFF6E6" />
      </g>}
    </svg>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const CONTOUR_TUNES = ['brahms'] as const;
export type ContourTune = (typeof CONTOUR_TUNES)[number];
export const contourWav = (tune: ContourTune) => `contour-${tune}.wav`;
const CONTOURS = Object.fromEntries(CONTOUR_TUNES.map((id) => [id, contourOf(TUNES[id])])) as Record<ContourTune, Contour>;

export const ContourLine: React.FC<{ tune?: ContourTune; silent?: boolean; cover?: boolean }> = ({ tune = 'brahms', silent, cover = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = cover ? 1.2 : frame / fps;
  const C = CONTOURS[tune], { T } = C.S;
  const camX = cover ? 0 : followX(C, t);                              // stops with the pen, so the dust settles on the reveal

  return (
    <AbsoluteFill style={{ background: WOOD.bg, overflow: 'hidden' }}>
      <LampRoom />
      <Dust t={t} camX={camX} />
      <AbsoluteFill style={{ background: SCRIM, opacity: 0.6 }} />
      <Pen t={t} C={C} cover={cover} />

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.2} outAt={cover ? undefined : 2.2} y={260} text="ONE LISTEN" />
      <Line t={t} at={-0.2} outAt={cover ? undefined : 2.2} y={430} size={124}>Can you play it</Line>
      <Line t={t} at={0.15} outAt={cover ? undefined : 2.2} y={575} size={124}><span style={{ fontStyle: 'italic', color: WOOD.lilac }}>without tabs?</span></Line>

      {/* scene 2 · hear the melody, once — no staff, no frets: only its shape */}
      {!cover && <Line t={t} at={T.listen + 0.05} outAt={T.hold} y={330} size={96} italic>Listen once.</Line>}
      {!cover && <Caps t={t} at={T.listen + 0.35} outAt={T.hold} y={455} text="FOLLOW THE SHAPE" />}

      {/* scene 3 · your turn, and which song next */}
      {!cover && <YourTurn t={t} T={T} />}
      <Lens frame={frame} />
      {!silent && !cover && <Audio src={staticFile(contourWav(tune))} />}
    </AbsoluteFill>
  );
};
