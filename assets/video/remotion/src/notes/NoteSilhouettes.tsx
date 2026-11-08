// "Can you play it without tabs?" — #89's wood-cut film (guitarists-only hook · the melody once · your turn · follow) with no guitar and no
// staff: the melody arrives as note silhouettes, black cut-outs against a huge rising moon. Height = pitch, spacing = time, and each note
// lays a bar of lamplight as long as it sounds, so short and long read without any notation. Eighths drop in pairs and hold hands (the
// beam snaps across when the second lands), quarters thump, rests hang as small breaths. At the hold the camera pulls back and the whole
// melody stands as two lines of skyline in front of the moon.
// Motion (README "Animation principles"):
//   · anticipation — each note falls in accelerating, the moon dips before it rises, the camera pushes in before the pull-back
//   · squash & stretch — every landing squashes on the head and springs back (wob), big leaps fly in on a dotted arc
//   · follow-through — the beam overshoots across to its partner, the camera rides ahead of the pen with an even lag
//   · secondary action — moon ripples, motes, parallax dust, a light running the whole skyline at the end
//   · idle breathing — the moon and rests never freeze
// Pure function of the frame; every time from the king/tunes.mjs story (prop `tune`), which also lays the soundtrack (render-notes.mjs).
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { POP, kick, ramp, springAt, wob, type SpringCfg } from '../ten/motion';
import { clamp, easeOut, rng } from '../util';
import { TUNES } from '../../king/tunes.mjs';
import type { TuneStory, ScoreNote } from '../../king/tunes.d.mts';
import { WOOD, LampRoom, Lens, Line, Caps, YourTurn, SCRIM } from '../rising/RisingWood';

const CRANE: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };
const MOONRISE: SpringCfg = { damping: 16, stiffness: 60, mass: 1.2 };

// --- geometry (world px: x = time, y = pitch) ---------------------------------------------------------------------------------------------
const PX = 520;                 // px per second of music
const SEMI = 40;                // px per semitone
const PEN_X = 610;              // where the newest note lands on screen: in front of the moon
const MID_Y = 1150;             // screen y of the middle of the tune's range while listening
const STEM = 150, HX = 28, HY = 20;   // glyph: stem length, notehead radii (unscaled)
const MOON = { x: 600, y: 1060, r: 400 };
const BIG = 1.25;               // glyph scale while listening
const MARGIN = 96, ROW_Y = [860, 1330], SY = 0.62, GS = 0.46;   // the revealed skyline: rows, pitch scale, glyph scale
const FALL = 0.13, DROP = 260;  // a note falls this long, from this high, and lands on its onset
/** Where each tune's second phrase starts (melody note index): the reveal sets it as the second row. */
const SPLIT: Record<string, number> = { mozart40: 20 };

type Glyph = { k: number; t: number; dur: number; beats: number; midi: number; rest: boolean; kind: ScoreNote['dur']; row: number; partner?: number; lead?: boolean };

function notesOf(S: TuneStory) {
  if (!S.SCORE) throw new Error(`${S.id}: note silhouettes need a score()`);
  const flat = S.SCORE.bars.flat();
  const split = SPLIT[S.id] ?? Infinity;
  let beat = 0;
  const G: Glyph[] = flat.map((n, k) => {
    const g: Glyph = { k, t: S.T.listenAt + beat * S.BEAT, dur: n.beats * S.BEAT, beats: beat, midi: n.midi, rest: !!n.rest, kind: n.dur, row: !n.rest && n.order >= split ? 1 : 0 };
    beat += n.beats;
    return g;
  });
  G.forEach((g, k) => { if (g.rest && k > 0) g.row = G[k - 1].row; });
  // eighth pairs inside one beat hold hands (a beam); the first of the pair leads
  for (let k = 0; k + 1 < G.length; k++) {
    const a = G[k], b = G[k + 1];
    if (!a.rest && !b.rest && a.kind === '8' && b.kind === '8' && a.partner === undefined && Math.floor(a.beats + 1e-6) === Math.floor(b.beats + 1e-6)) { a.partner = k + 1; a.lead = true; b.partner = k; }
  }
  const sounding = G.filter((g) => !g.rest);
  const lo = Math.min(...sounding.map((g) => g.midi)), hi = Math.max(...sounding.map((g) => g.midi)), mid = (lo + hi) / 2;
  const t0 = S.T.listenAt, tE = S.T.hold;
  const wx = (tau: number) => (tau - t0) * PX;
  const wy = (m: number) => -(m - mid) * SEMI;
  const rows = [0, 1].map((r) => G.filter((g) => g.row === r));
  const rowX0 = rows.map((g) => (g.length ? wx(g[0].t) : 0));
  const rowW = rows.map((g, r) => (g.length ? wx(g.at(-1)!.t + g.at(-1)!.dur) - rowX0[r] : 0));
  const fit = (1080 - 2 * MARGIN) / Math.max(...rowW);
  return { S, G, mid, t0, tE, wx, wy, rowX0, fit, nRows: rows[1].length ? 2 : 1 };
}
type Notes = ReturnType<typeof notesOf>;

// --- camera ------------------------------------------------------------------------------------------------------------------------------
/** The camera's x: the pen's world x averaged over the last 0.9 s with an exponential weight, looked 0.27 s ahead, so it rides centred
 *  on the newest note, eases in at the start and settles at the end (no hard lock, no kink). */
function camX(N: Notes, t: number) {
  const pen = (tau: number) => N.wx(clamp(tau, N.t0 - 0.35, N.tE));
  let s = 0, w = 0;
  for (let k = 0; k <= 36; k++) { const wk = Math.exp(-k / 11); s += wk * pen(t + 0.27 - k * 0.025); w += wk; }
  return s / w - PEN_X;
}
type P = [number, number];
function viewAt(N: Notes, t: number, cover: boolean) {
  const { T } = N.S;
  const cx = camX(N, t);
  const rAt = (row: number) => (cover ? 1 : springAt(t, T.hold + 0.25 + row * 0.09, CRANE));
  const pre = !cover && t > T.hold && t < T.hold + 0.25 ? Math.sin(Math.PI * (t - T.hold) / 0.25) : 0;   // anticipation: a push in
  let push = 0.04 * pre;
  if (!cover) for (const g of N.G) { const a = t - g.t; if (!g.rest && a >= 0 && a < 0.6) push += 0.01 * kick(a, 9); }
  const r0 = rAt(0);
  const map = (x: number, y: number, row: number): P => {
    const rr = rAt(row);
    const ax = x - cx, ay = MID_Y + y;
    const bx = MARGIN + (x - N.rowX0[row]) * N.fit, by = (N.nRows === 1 ? 1100 : ROW_Y[row]) + (cover ? 70 : 0) + y * SY;
    let sx = ax + (bx - ax) * rr, sy = ay + (by - ay) * rr;
    const z = 1 + push * (1 - Math.min(1, r0));
    sx = PEN_X + (sx - PEN_X) * z; sy = MID_Y + (sy - MID_Y) * z;
    return [sx, sy];
  };
  const scaleOf = (row: number) => { const rr = rAt(row); return BIG + (GS - BIG) * rr; };
  return { map, scaleOf, cx, reveal: r0 };
}

// --- the room: dust at three depths drifting against the camera ----------------------------------------------------------------------------
const DUST = (() => { const r = rng(1788); return Array.from({ length: 36 }, () => ({ x: r() * 2400, y: r() * 1920, z: 0.15 + r() * 0.55, s: 1.5 + r() * 4, ph: r() * 6.28, o: 0.08 + r() * 0.22 })); })();
const Dust: React.FC<{ t: number; cx: number }> = ({ t, cx }) => (
  <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
    <defs><filter id="nDust" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={2.2} /></filter></defs>
    {DUST.map((d, i) => {
      const x = ((((d.x - cx * d.z + 8 * Math.sin(t * 0.3 + d.ph)) % 2400) + 2400) % 2400) - 600;
      const y = d.y - 14 * t * d.z + 10 * Math.sin(t * 0.4 + d.ph);
      return <circle key={i} cx={x} cy={((y % 1920) + 1920) % 1920} r={d.s * (0.6 + d.z)} fill={i % 3 ? WOOD.lilac : WOOD.amber} opacity={d.o * (0.75 + 0.25 * Math.sin(t * 1.3 + d.ph))} filter="url(#nDust)" />;
    })}
  </svg>
);

/** The moon: rises through the hook (dips first), breathes, pulses on each note, sends ripples; at the reveal grows behind the skyline. */
const Moon: React.FC<{ t: number; N: Notes; reveal: number; cover: boolean }> = ({ t, N, reveal, cover }) => {
  const rise = cover ? 1 : springAt(t, 0.15, MOONRISE);                // half up under the hook's type…
  const rise2 = cover ? 1 : springAt(t, N.S.T.listen - 0.3, MOONRISE);  // …the rest of the way as the music starts
  const dip = cover ? 0 : 40 * Math.sin(Math.PI * clamp(t / 0.3));
  let pulse = 0;
  const ripples: { age: number; big: boolean }[] = [];
  if (!cover) for (const g of N.G) {
    if (g.rest) continue;
    const a = t - g.t;
    if (a >= 0 && a < 0.5) pulse += 0.018 * kick(a, 10);
    if (a >= 0 && a < 1.1) ripples.push({ age: a, big: g.kind !== '8' });
  }
  const breathe = 1 + 0.012 * Math.sin(t * 1.7);
  const R = (MOON.r + (560 - MOON.r) * reveal) * breathe * (1 + pulse);
  const x = MOON.x + (540 - MOON.x) * reveal;
  const y = MOON.y + 900 * (1 - rise) + 330 * (1 - rise2) + dip + (1110 - MOON.y) * reveal;
  const dim = 1 - 0.15 * reveal;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="moonFace" cx="0.42" cy="0.38" r="0.7">
          <stop offset={0} stopColor="#FFF4DC" />
          <stop offset={0.45} stopColor="#F9D6A0" />
          <stop offset={0.85} stopColor={WOOD.amber} />
          <stop offset={1} stopColor={WOOD.ember} />
        </radialGradient>
        <radialGradient id="moonHalo">
          <stop offset={0.55} stopColor={WOOD.ember} stopOpacity={0.45} />
          <stop offset={0.75} stopColor="#C46AA0" stopOpacity={0.18} />
          <stop offset={1} stopColor={WOOD.lilac} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="moonShade" cx="0.7" cy="0.75" r="0.6"><stop offset={0} stopColor="#7A3A2A" stopOpacity={0.25} /><stop offset={1} stopColor="#7A3A2A" stopOpacity={0} /></radialGradient>
      </defs>
      <circle cx={x} cy={y} r={R * 1.9} fill="url(#moonHalo)" opacity={0.9 * dim} />
      <circle cx={x} cy={y} r={R} fill="url(#moonFace)" opacity={dim} />
      <circle cx={x} cy={y} r={R} fill="url(#moonShade)" opacity={dim} />
      {/* soft maria, so it reads as a moon and not a lamp */}
      {[[-0.32, -0.18, 0.2], [0.18, 0.12, 0.26], [-0.05, 0.38, 0.14], [0.36, -0.3, 0.1]].map(([dx, dy, rr], i) => (
        <circle key={i} cx={x + dx * R} cy={y + dy * R} r={rr * R} fill="#D9A06A" opacity={0.18 * dim} />
      ))}
      {ripples.map((p, i) => { const u = easeOut(clamp(p.age / 1.1)); return <circle key={i} cx={x} cy={y} r={R * (1 + (p.big ? 0.32 : 0.18) * u)} fill="none" stroke={WOOD.amber} strokeWidth={p.big ? 3 : 2} opacity={0.45 * (1 - u) * dim} />; })}
    </svg>
  );
};

/** A quarter rest, as engraved (unscaled, centred on 0,0, ~110 px tall). */
const REST_PATH = 'M -8 -55 L 14 -28 Q 0 -14 2 2 L 18 24 Q -4 14 -10 30 Q -14 44 2 56 Q -26 46 -20 26 Q -14 10 4 14 L -16 -10 Q -4 -22 -6 -38 Z';
/** A lone eighth's flag, hanging off the stem top (unscaled). */
const FLAG_PATH = 'M 0 0 C 2 30 40 44 34 98 C 46 54 14 32 0 18 Z';

const INK = '#0B0514';

/** The melody: silhouettes, their duration bars, beams, arcs. `cover`: all of it landed, in the revealed frame. */
const Silhouettes: React.FC<{ t: number; N: Notes; cover: boolean }> = ({ t, N, cover }) => {
  const { T } = N.S;
  const { map, scaleOf } = viewAt(N, t, cover);
  const sw = cover ? -1 : (t - T.sweep) / 1.2, sweeping = sw > 0 && sw < 1;
  const sweepT = N.t0 + easeOut(clamp(sw)) * (N.tE - N.t0);

  type Pose = { hx: number; hy: number; s: number; sx: number; sy: number; o: number; top: P; lit: number; age: number };
  const pose = (g: Glyph): Pose | null => {
    const age = cover ? 9 : t - g.t;
    if (age < -FALL) return null;
    const u = clamp(1 + age / FALL);                                     // the fall: accelerating, lands on the onset
    const off = age < 0 ? -DROP * (1 - u * u) : 0;
    const [x, y] = map(N.wx(g.t), g.rest ? 0 : N.wy(g.midi), g.row);
    const s = scaleOf(g.row);
    const q = age >= 0 ? 0.3 * wob(age, 9, 26) : 0;                     // squash on landing, stretch on the rebound
    const sy = 1 - q, sx = 1 + 0.8 * q;
    const swept = sweeping ? kick(Math.abs(sweepT - g.t), 7) * Math.sin(Math.PI * sw) : 0;
    const hy = y + off + HY * s * (1 - sy);                             // squash about the head's bottom
    const top: P = [x + (HX - 3) * s * sx, hy - STEM * s * sy];
    return { hx: x, hy, s, sx, sy, o: u, top, lit: Math.max(age >= 0 ? kick(age, 3.2) : 0, swept), age };
  };
  const poses = N.G.map(pose);

  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <filter id="nHalo" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={7} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="nRim" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}><feGaussianBlur stdDeviation={5} /></filter>
      </defs>

      {/* duration bars: lamplight as long as the note sounds, filling while it rings, cooling to lilac */}
      {N.G.map((g, k) => {
        const p = poses[k];
        if (!p || g.rest) return null;
        const fill = cover ? 1 : clamp((t - g.t) / g.dur);
        const [x1] = map(N.wx(g.t + g.dur) - 12, 0, g.row);
        const len = Math.max(0, (x1 - p.hx) * (cover ? 1 : fill));
        const h = 14 * p.s, y = p.hy + HY * p.s * p.sy + 12 * p.s;
        const sounding = !cover && t >= g.t && t < g.t + g.dur + 0.15;
        return (
          <g key={`d${k}`} opacity={p.o}>
            <rect x={p.hx - HX * p.s} y={y} width={Math.max(0, x1 - p.hx + HX * p.s)} height={h} rx={h / 2} fill={WOOD.lilac} opacity={0.13} />
            <rect x={p.hx - HX * p.s} y={y} width={len + HX * p.s} height={h} rx={h / 2} fill={sounding || p.lit > 0.5 ? WOOD.amber : WOOD.lilac} opacity={sounding ? 1 : 0.55 + 0.45 * p.lit} filter={sounding ? 'url(#nHalo)' : undefined} />
          </g>
        );
      })}

      {/* big leaps fly in on a dotted arc from the note before */}
      {!cover && N.G.map((g, k) => {
        const p = poses[k];
        const prevK = N.G.slice(0, k).map((h, i) => (h.rest ? -1 : i)).filter((i) => i >= 0).at(-1);
        if (!p || g.rest || prevK === undefined || Math.abs(g.midi - N.G[prevK].midi) < 5 || p.age > 0.8) return null;
        const q = poses[prevK]!;
        const fade = 1 - clamp(p.age / 0.8);
        const a: P = [q.hx, q.hy], b: P = [p.hx, p.hy];
        const c: P = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 170];
        return <path key={`a${k}`} d={`M ${a[0]} ${a[1]} Q ${c[0]} ${c[1]} ${b[0]} ${b[1]}`} fill="none" stroke={WOOD.cream} strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" opacity={0.8 * fade * Math.min(1, p.o * 3)} />;
      })}

      {/* rim light behind every silhouette, so they read off the moon too */}
      <g filter="url(#nRim)" opacity={0.9}>
        {N.G.map((g, k) => {
          const p = poses[k];
          if (!p) return null;
          const c = p.lit > 0.3 ? WOOD.amber : WOOD.lilac;
          if (g.rest) return <path key={`r${k}`} d={REST_PATH} transform={`translate(${p.hx} ${p.hy}) scale(${p.s * 0.9})`} fill={c} opacity={0.5 * p.o} />;
          return (
            <g key={`r${k}`} opacity={(0.55 + 0.45 * p.lit) * p.o}>
              <ellipse cx={p.hx} cy={p.hy} rx={(HX + 5) * p.s * p.sx} ry={(HY + 5) * p.s * p.sy} transform={`rotate(-22 ${p.hx} ${p.hy})`} fill={c} />
              <line x1={p.top[0]} y1={p.hy} x2={p.top[0]} y2={p.top[1]} stroke={c} strokeWidth={10 * p.s} />
            </g>
          );
        })}
      </g>

      {/* the silhouettes: heads, stems, flags, beams, rests */}
      {N.G.map((g, k) => {
        const p = poses[k];
        if (!p) return null;
        if (g.rest) {
          const breathe = 1 + 0.06 * Math.sin(t * 3 + k);
          const pop = cover ? 1 : Math.max(0, springAt(t, g.t, POP));
          return <path key={`s${k}`} d={REST_PATH} transform={`translate(${p.hx} ${p.hy}) scale(${p.s * 0.8 * pop * breathe})`} fill={INK} stroke={WOOD.lilac} strokeWidth={2 / Math.max(0.3, p.s)} opacity={0.9 * p.o} />;
        }
        // a lead eighth shows its flag until its partner lands; then the beam grows across and the flag folds away
        const partner = g.partner !== undefined ? N.G[g.partner] : undefined;
        const beamIn = partner ? (cover ? 1 : clamp(springAt(t, g.lead ? partner.t : g.t, POP))) : 0;
        const flag = g.kind === '8' && (!partner || (g.lead && beamIn < 1)) ? (partner ? 1 - beamIn : 1) : 0;
        return (
          <g key={`s${k}`} opacity={p.o}>
            <line x1={p.top[0]} y1={p.hy - 4 * p.s} x2={p.top[0]} y2={p.top[1]} stroke={INK} strokeWidth={6 * p.s} strokeLinecap="round" />
            <ellipse cx={p.hx} cy={p.hy} rx={HX * p.s * p.sx} ry={HY * p.s * p.sy} transform={`rotate(-22 ${p.hx} ${p.hy})`} fill={INK} />
            {flag > 0.01 && <path d={FLAG_PATH} transform={`translate(${p.top[0]} ${p.top[1]}) scale(${p.s} ${p.s * flag})`} fill={INK} />}
          </g>
        );
      })}
      {N.G.map((g, k) => {
        if (!g.lead || g.partner === undefined) return null;
        const a = poses[k], b = poses[g.partner];
        if (!a || !b) return null;
        const pr = N.G[g.partner];
        const grow = cover ? 1 : clamp(springAt(t, pr.t, POP), 0, 1.08);
        if (grow <= 0.01) return null;
        const ex = a.top[0] + (b.top[0] - a.top[0]) * grow, ey = a.top[1] + (b.top[1] - a.top[1]) * grow;
        const th = 18 * a.s;
        return <polygon key={`b${k}`} points={`${a.top[0] - 3 * a.s},${a.top[1]} ${ex + 3 * a.s},${ey} ${ex + 3 * a.s},${ey + th} ${a.top[0] - 3 * a.s},${a.top[1] + th}`} fill={INK} />;
      })}

      {/* sparks: a note's landing kicks up a few motes of moonlight */}
      {!cover && N.G.map((g, k) => {
        const p = poses[k];
        if (!p || g.rest || p.age < 0 || p.age > 0.7) return null;
        const r = rng(k * 31 + 7), u = easeOut(p.age / 0.7);
        return <g key={`m${k}`}>{Array.from({ length: 5 }, (_, i) => { const a = Math.PI * (1.1 + 0.8 * r()), v = 50 + 70 * r(); return <circle key={i} cx={p.hx + Math.cos(a) * v * u} cy={p.hy + HY * p.s + Math.sin(a) * v * u * 0.6} r={1.6 + 2 * r()} fill={WOOD.amber} opacity={0.85 * (1 - u)} />; })}</g>;
      })}
    </svg>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const NOTE_TUNES = ['mozart40'] as const;
export type NoteTune = (typeof NOTE_TUNES)[number];
export const notesWav = (tune: NoteTune) => `notes-${tune}.wav`;
const NOTESETS = Object.fromEntries(NOTE_TUNES.map((id) => [id, notesOf(TUNES[id])])) as Record<NoteTune, Notes>;

export const NoteSilhouettes: React.FC<{ tune?: NoteTune; silent?: boolean; cover?: boolean }> = ({ tune = 'mozart40', silent, cover = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = cover ? 1.4 : frame / fps;
  const N = NOTESETS[tune], { T } = N.S;
  const { cx, reveal } = viewAt(N, t, cover);
  const hookOut = cover ? undefined : 2.2;

  return (
    <AbsoluteFill style={{ background: WOOD.bg, overflow: 'hidden' }}>
      <LampRoom />
      <Moon t={t} N={N} reveal={reveal} cover={cover} />
      <Dust t={t} cx={cover ? 0 : cx} />
      <AbsoluteFill style={{ background: SCRIM, opacity: 0.75 }} />
      <Silhouettes t={t} N={N} cover={cover} />

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.2} outAt={hookOut} y={230} text="GUITARISTS ONLY" color={WOOD.lilac} />
      <Line t={t} at={-0.2} outAt={hookOut} y={360} size={92}>One listen.</Line>
      <Line t={t} at={0.05} outAt={hookOut} y={490} size={124}>Can you play it</Line>
      <Line t={t} at={0.2} outAt={hookOut} y={635} size={124}><span style={{ fontStyle: 'italic', color: WOOD.lilac }}>without tabs?</span></Line>

      {/* scene 2 · hear it once: no type, only the notes */}

      {/* scene 3 · your turn, follow for the next */}
      {!cover && <YourTurn t={t} T={T} end={N.S.END_TEXT} />}
      <Lens frame={frame} />
      {!silent && !cover && <Audio src={staticFile(notesWav(tune))} />}
    </AbsoluteFill>
  );
};
