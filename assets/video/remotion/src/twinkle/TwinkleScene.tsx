// Tab Guy, ep. 4 — "Twinkle". Tab Guy and Emma are the user's character sheet (public/twinkle/*.png, cut by twinkle/cut-sheet.py). One living
// room, one continuous camera: it never cuts, it travels (a monotone cubic through the keys, so velocity is continuous and nothing overshoots),
// and the night is a grade, not a cut. Timeline: ../../twinkle/story.mjs (also the soundtrack and the voices).
//
// Smoothness rules: every value is a pure function of `t` at 60 fps; motion is eased (smootherstep) or a damped spring (`wob`), never linear;
// a pose swap is a short cross-fade with the heads aligned and a squash hiding it; everything that moves has a small secondary move (breathing,
// sway, a hair of handheld camera, dust in the sun); parts of the world sit on parallax layers.
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, rng } from '../util';
import { T, QP, EMMA1, EMMA2, REPLAY_E, REPLAY_G, GUITAR1, GUITAR2, SOUR, APP, APP_HEARD, APP_TAPS } from '../../twinkle/story.mjs';
import SPRITES from '../../twinkle/sprites.json';

const W = 1080, H = 1920;
const SANS = '"Avenir Next", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
const MONO = 'Menlo, "SF Mono", "Courier New", monospace';
const INK = '#2a1620';

// --- motion vocabulary --------------------------------------------------------------------------------------------------------------------
const sm = (x: number) => { const u = clamp(x); return u * u * u * (u * (u * 6 - 15) + 10); };            // smootherstep: zero velocity AND acceleration at both ends
// a hit has a 3-frame attack (never a one-frame jump), then decays
const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k) * sm(age / 0.05));
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w) * sm(age / 0.06));
const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
const win = (t: number, a: number, b: number, fi = 0.2, fo = 0.2) => sm((t - a) / fi) * sm((b - t) / fo);
const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// --- camera -----------------------------------------------------------------------------------------------------------------------------------
type Key = [number, number, number, number];   // t, x, y, zoom
const KEYS: Key[] = [
  [0.0, 590, 1060, 1.02], [2.9, 585, 1060, 1.06], [3.9, 480, 1000, 1.35], [4.6, 500, 930, 1.8], [6.5, 495, 940, 1.85],
  [7.0, 560, 1150, 1.55], [7.6, 850, 1250, 1.5], [10.3, 870, 1240, 1.78], [11.2, 880, 1250, 1.72], [11.6, 830, 1200, 1.3],
  [12.1, 780, 1200, 1.25], [12.9, 500, 930, 1.75], [15.6, 500, 935, 1.8],
  [16.7, 540, 1060, 1.02], [18.9, 590, 1060, 1.08], [19.9, 650, 1100, 1.02], [23.4, 700, 1130, 1.1], [27.4, 710, 1140, 1.16],
];
/** Monotone cubic (Fritsch–Carlson) through the keys: C1-smooth, no overshoot, holds where two keys agree. */
function pchip(ts: number[], vs: number[], t: number) {
  const n = ts.length;
  if (t <= ts[0]) return vs[0];
  if (t >= ts[n - 1]) return vs[n - 1];
  const d = vs.slice(1).map((v, i) => (v - vs[i]) / (ts[i + 1] - ts[i]));
  const m = vs.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  let i = 0; while (i < n - 2 && t >= ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
}
const KT = KEYS.map((k) => k[0]), KX = KEYS.map((k) => k[1]), KY = KEYS.map((k) => k[2]), KS = KEYS.map((k) => Math.log(k[3]));
const camAt = (t: number) => ({ x: pchip(KT, KX, t), y: pchip(KT, KY, t), s: Math.exp(pchip(KT, KS, t)) });

// --- sprites -----------------------------------------------------------------------------------------------------------------------------------
type SP = Record<string, { w: number; h: number; cx: number; fy: number }>;
const SPR = SPRITES as unknown as SP;
/** A sprite anchored at its foot/base point (x, y), scaled `s` per source pixel; squash/stretch and lean pivot there. */
const Spr: React.FC<{ n: string; x: number; y: number; s: number; sx?: number; sy?: number; rot?: number; o?: number; flip?: boolean; filter?: string; pivotY?: number; fadeBottom?: number }> =
  ({ n, x, y, s, sx = 1, sy = 1, rot = 0, o = 1, flip, filter, pivotY = 0, fadeBottom = 0 }) => {
    const m = SPR[n];
    if (o <= 0.002) return null;
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, opacity: o, filter, transform: `rotate(${rot}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`, transformOrigin: `0 ${-pivotY}px`, willChange: 'transform' }}>
        <Img src={staticFile(`twinkle/${n}.png`)} style={{ position: 'absolute', left: -m.cx * s, top: -m.fy * s, width: m.w * s, height: m.h * s, ...(fadeBottom ? { WebkitMaskImage: `linear-gradient(to bottom, #000 ${100 - fadeBottom}%, transparent 100%)` } : null) }} />
      </div>
    );
  };

// --- the room (day) -----------------------------------------------------------------------------------------------------------------------
const WALL_Y = 1380;
const BOOKS = (() => { const r = rng(5), out: { x: number; w: number; h: number; c: string }[] = []; let x = 0; while (x < 360) { const w = 22 + Math.floor(r() * 22); out.push({ x, w, h: 110 + Math.floor(r() * 50), c: ['#c8553d', '#3f7c85', '#e0a526', '#6b4f9e', '#7aa85a', '#d98aa5'][Math.floor(r() * 6)] }); x += w + 4; } return out; })();
const MOTES = (() => { const r = rng(11); return Array.from({ length: 26 }, () => ({ x: r(), y: r(), s: 0.5 + r(), ph: r() * 6.28 })); })();

const Wall: React.FC<{ t: number }> = ({ t }) => (
  <svg width={W + 1800} height={WALL_Y + 700} viewBox={`-900 -700 ${W + 1800} ${WALL_Y + 700}`} style={{ position: 'absolute', left: -900, top: -700, overflow: 'visible' }} shapeRendering="crispEdges">
    <rect x={-900} y={-700} width={W + 1800} height={WALL_Y + 700} fill="#efd5ab" />
    {Array.from({ length: 36 }, (_, i) => <rect key={i} x={-900 + i * 80} y={-700} width={40} height={WALL_Y + 700} fill="#e9cb9d" />)}
    <rect x={-900} y={1040} width={W + 1800} height={340} fill="#b97c4f" /><rect x={-900} y={1030} width={W + 1800} height={16} fill="#f4e6c8" />
    {Array.from({ length: 36 }, (_, i) => <rect key={i} x={-900 + i * 80 + 38} y={1046} width={6} height={334} fill="#a56d43" />)}
    {/* window */}
    <rect x={90} y={170} width={430} height={600} fill="#fff6e2" /><rect x={110} y={190} width={390} height={560} fill="#a9dcff" />
    <rect x={110} y={190} width={390} height={260} fill="#c9ecff" />
    <g transform={`translate(${((t * 9) % 520) - 100} 0)`}><rect x={120} y={260} width={120} height={34} fill="#fff" /><rect x={150} y={238} width={70} height={30} fill="#fff" /><rect x={-300} y={400} width={150} height={36} fill="#fff" /></g>
    <rect x={296} y={190} width={18} height={560} fill="#fff6e2" /><rect x={110} y={450} width={390} height={18} fill="#fff6e2" />
    <rect x={70} y={750} width={470} height={26} fill="#f4e6c8" />
    {/* shelf with books, a plant and a clock */}
    <rect x={720} y={470} width={420} height={18} fill="#8c5a36" /><rect x={720} y={760} width={420} height={18} fill="#8c5a36" />
    <g transform="translate(740 470)">{BOOKS.map((b, i) => <rect key={i} x={b.x} y={-b.h} width={b.w} height={b.h} fill={b.c} />)}</g>
    <g transform="translate(750 760)">{BOOKS.slice(3).map((b, i) => <rect key={i} x={b.x * 0.6} y={-b.h * 0.8} width={b.w} height={b.h * 0.8} fill={b.c} />)}<rect x={290} y={-80} width={60} height={80} fill="#c8553d" /><ellipse cx={320} cy={-130} rx={54} ry={50} fill="#5e9a4b" /><ellipse cx={298} cy={-150} rx={30} ry={34} fill="#74b85e" /></g>
    <circle cx={1095} cy={300} r={70} fill="#fffdf6" stroke={INK} strokeWidth={6} />
    <rect x={1091} y={248} width={8} height={54} fill={INK} /><rect x={1095} y={296} width={36} height={8} fill={INK} transform={`rotate(${t * 6} 1095 300)`} />
    {/* two frames */}
    <rect x={1230} y={300} width={150} height={190} fill="#8c5a36" /><rect x={1244} y={314} width={122} height={162} fill="#9ad2c6" /><polygon points="1244,476 1290,400 1330,450 1350,420 1366,476" fill="#5e9a4b" />
    <rect x={1230} y={560} width={150} height={110} fill="#8c5a36" /><rect x={1244} y={574} width={122} height={82} fill="#f2b6c1" />
  </svg>
);

const Floor: React.FC<{ light: number }> = ({ light }) => (
  <svg width={W + 1800} height={1100} viewBox={`-900 ${WALL_Y} ${W + 1800} 1100`} style={{ position: 'absolute', left: -900, top: WALL_Y, overflow: 'visible' }} shapeRendering="crispEdges">
    <rect x={-900} y={WALL_Y} width={W + 1800} height={1100} fill="#c28a58" />
    {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-900} y={WALL_Y + i * 70} width={W + 1800} height={6} fill="#a97444" />)}
    {Array.from({ length: 30 }, (_, i) => <rect key={i} x={-900 + ((i * 197) % (W + 1800))} y={WALL_Y + (i % 12) * 70} width={5} height={70} fill="#a97444" />)}
    {/* the rug the two of them sit on */}
    <rect x={-300} y={1450} width={1800} height={700} rx={30} fill="#d56a5b" /><rect x={-260} y={1490} width={1720} height={620} rx={20} fill="#f4dfb6" />
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={-260} y={1520 + i * 66} width={1720} height={28} fill={i % 2 ? '#e8b66c' : '#7cb7b0'} opacity={0.85} />)}
    <rect x={-900} y={WALL_Y} width={W + 1800} height={1100} fill="#1a0f30" opacity={0.0 * light} />
  </svg>
);

const Sofa: React.FC = () => (
  <svg width={900} height={420} viewBox="0 0 900 420" style={{ position: 'absolute', left: -240, top: 1010 }} shapeRendering="crispEdges">
    <rect x={60} y={40} width={720} height={250} rx={26} fill="#3f7c85" /><rect x={90} y={70} width={310} height={170} rx={16} fill="#4a919b" /><rect x={420} y={70} width={310} height={170} rx={16} fill="#4a919b" />
    <rect x={0} y={150} width={120} height={230} rx={26} fill="#336a73" /><rect x={720} y={150} width={120} height={230} rx={26} fill="#336a73" />
    <rect x={60} y={230} width={720} height={150} rx={20} fill="#3a7079" /><rect x={110} y={236} width={300} height={130} rx={14} fill="#448a94" /><rect x={430} y={236} width={300} height={130} rx={14} fill="#448a94" />
    <rect x={640} y={110} width={120} height={120} rx={14} fill="#e0a526" transform="rotate(8 700 170)" />
  </svg>
);
const Lamp: React.FC = () => (
  <svg width={200} height={900} viewBox="0 0 200 900" style={{ position: 'absolute', left: 1330, top: 560 }} shapeRendering="crispEdges">
    <rect x={92} y={190} width={14} height={640} fill="#6b4a2f" /><ellipse cx={100} cy={832} rx={60} ry={16} fill="#6b4a2f" />
    <polygon points="30,200 170,200 140,60 60,60" fill="#f3d58a" /><rect x={60} y={50} width={80} height={14} fill="#e0a526" />
  </svg>
);

// --- flying notes: one per sounding note, from the instrument, drifting up with a sway ---------------------------------------------------
const NOTE_NAMES = ['note_a', 'note_b', 'note_c'];
type Burst = { t: number; x: number; y: number; k: number; c?: string };
const Notes: React.FC<{ t: number; bursts: Burst[] }> = ({ t, bursts }) => (
  <>
    {bursts.map((b, i) => {
      const a = t - b.t;
      if (a < 0 || a > 1.5) return null;
      const u = a / 1.5, n = NOTE_NAMES[b.k % 3];
      const sc = (0.5 + 0.9 * (1 - Math.exp(-a * 14))) * (1 - 0.3 * u);
      const x = b.x + (150 * u + 18 * Math.sin(a * 5 + b.k)), y = b.y - (170 + 90 * (b.k % 3)) * (1 - Math.pow(1 - u, 2));
      return <Spr key={i} n={n} x={x} y={y} s={2.6 * sc} o={Math.min(1, a * 12) * (1 - sm((u - 0.6) / 0.4))} rot={(b.k % 2 ? 1 : -1) * (10 + 8 * Math.sin(a * 4))} filter={b.c ? `drop-shadow(0 0 10px ${b.c})` : 'drop-shadow(0 4px 0 rgba(42,22,32,0.25))'} />;
    })}
  </>
);

// --- speech bubble in the sheet's style -----------------------------------------------------------------------------------------------------
const Bubble: React.FC<{ x: number; y: number; t: number; a: number; b: number; text: string; tail?: 'l' | 'r'; size?: number }> = ({ x, y, t, a, b, text, tail = 'l', size = 64 }) => {
  const o = win(t, a, b, 0.14, 0.18);
  if (o <= 0) return null;
  const pop = 1 + 0.12 * wob(t - a, 8, 22) - 0.35 * (1 - sm((t - a) / 0.2));
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: o, transform: `translate(${tail === 'r' ? '-88%' : '-12%'}, -100%) scale(${pop})`, transformOrigin: tail === 'r' ? '88% 100%' : '12% 100%' }}>
      <div style={{ background: '#fff', color: INK, fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.1, padding: '22px 36px', borderRadius: 40, border: `8px solid ${INK}`, boxShadow: '0 10px 0 rgba(42,22,32,0.25)', whiteSpace: 'nowrap', textAlign: 'center' }}>{text}</div>
      <div style={{ position: 'absolute', bottom: -44, [tail === 'r' ? 'right' : 'left']: 70, width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `48px solid ${INK}` }} />
      <div style={{ position: 'absolute', bottom: -30, [tail === 'r' ? 'right' : 'left']: 76, width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '34px solid #fff' }} />
    </div>
  );
};

// --- the app on his phone (night): a drawn stand-in until the screen recording replaces it (APP_VIDEO in story.mjs) ------------------------
const PHRASE = [60, 60, 67, 67, 69, 69, 67];
const NOTE_LABEL: Record<number, string> = { 60: 'C4', 65: 'F4', 67: 'G4', 69: 'A4' };
const FRET: Record<number, [number, number]> = { 60: [4, 1], 65: [4, 6], 67: [5, 3], 69: [5, 5] };   // [string (0 = low E … 5 = high e), fret] of the app's Twinkle
const Phone: React.FC<{ t: number }> = ({ t }) => {
  const a = APP.open, b = APP.close;
  if (t < a - 0.05 || t > b + 0.45) return null;
  const inU = sm((t - a) / 0.55), outU = sm((t - b) / 0.4);
  const y = lerp(H + 100, 470, inU) + 1700 * outU * outU + 8 * Math.sin(t * 1.3);
  const heardN = APP_HEARD.filter((n) => t >= n.t).length, tapped = APP_TAPS.filter((n) => t >= n.t);
  const slots: (number | null)[] = Array(7).fill(null);
  let si = 0;
  for (const tp of tapped) { if (tp.miss) { slots[si] = -tp.midi; } else { slots[si] = tp.midi; si++; } }   // a miss shows red in slot, the next tap overwrites it
  const missAge = t - APP_TAPS[2].t;
  const checked = t >= APP.check, ok = t >= APP.ok;
  const listening = t < APP.tap0 - 0.15;
  const splash = 1 - sm((t - (APP.heard0 - 0.3)) / 0.22);
  return (
    <div style={{ position: 'absolute', left: 610, top: y, width: 430, height: 900, background: '#0e0a1f', borderRadius: 62, padding: 18, boxShadow: `0 0 0 8px #2b2147, 0 0 120px rgba(142,232,255,${0.5 * (1 - outU)})`, transform: `rotate(${3 - 2 * inU}deg) scale(${1 - 0.04 * outU})` }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: 'linear-gradient(180deg,#1b1238,#120b29)', borderRadius: 46, overflow: 'hidden', fontFamily: SANS, color: '#fff' }}>
        {splash > 0.01 ? <div style={{ position: 'absolute', inset: 0, zIndex: 5, opacity: splash, background: 'linear-gradient(180deg,#2a1a5e,#130b2c)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 + 0.05 * (1 - splash)})` }}>
          <div style={{ width: 170, height: 170, transform: `scale(${1 + 0.18 * wob(t - (APP.open + 0.3), 7, 20)})` }}><EarIcon glow="#ffd43b" /></div>
          <div style={{ marginTop: 34, fontWeight: 900, fontSize: 56, letterSpacing: 1 }}>Ear Warrior</div>
          <div style={{ marginTop: 10, fontSize: 24, color: '#b5abfc' }}>hear it · play it</div>
        </div> : null}
        <div style={{ textAlign: 'center', marginTop: 56, fontWeight: 800, fontSize: 34, letterSpacing: 0.5 }}>Twinkle, Twinkle</div>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 21, color: '#b5abfc' }}>{ok ? 'Correct · 7 of 7 notes · +20 XP' : listening ? (heardN ? 'Listening…' : '') : checked ? 'Checking…' : 'Find the notes'}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 34 }}>
          {slots.map((m, i) => {
            const miss = m !== null && m < 0, on = m !== null && m > 0, hot = i < heardN && listening;
            const col = miss ? '#e5484d' : ok ? '#3fbf7f' : on ? '#8a63ff' : hot ? '#ffd43b' : '#2b2147';
            return <div key={i} style={{ width: 46, height: 46, borderRadius: '50%', background: col, border: '3px solid #4b3a7d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, transform: `scale(${1 + (on && i === si - 1 ? 0.25 * kick(t - tapped[tapped.length - 1].t, 14) : 0) + (miss ? 0.2 * kick(missAge, 10) : 0)})` }}>{miss ? '✕' : on ? NOTE_LABEL[m as number] : hot ? NOTE_LABEL[PHRASE[i]] : ''}</div>;
          })}
        </div>
        {/* the fretboard: six strings, frets 0–7, tap rings */}
        <div style={{ position: 'absolute', left: 24, right: 24, top: 300, height: 420, background: '#2d1e14', borderRadius: 14, border: '4px solid #0e0a1f' }}>
          {Array.from({ length: 8 }, (_, f) => <div key={f} style={{ position: 'absolute', left: `${(f / 8) * 100}%`, top: 0, bottom: 0, width: f === 0 ? 8 : 4, background: f === 0 ? '#e8e0cc' : '#a8946a' }} />)}
          {Array.from({ length: 6 }, (_, s) => <div key={s} style={{ position: 'absolute', left: 0, right: 0, top: `${(s + 0.5) / 6 * 100}%`, height: 2 + (5 - s) * 0.6, background: '#d0c8b8' }} />)}
          {[3, 5].map((f) => <div key={f} style={{ position: 'absolute', left: `${((f - 0.5) / 8) * 100}%`, top: '50%', width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: '50%', background: '#5a4636' }} />)}
          {tapped.map((tp, i) => { const [st, fr] = FRET[tp.midi], a2 = t - tp.t; if (a2 > 0.5) return null; return <div key={i} style={{ position: 'absolute', left: `${((fr - 0.5) / 8) * 100}%`, top: `${(5 - st + 0.5) / 6 * 100}%`, width: 62, height: 62, marginLeft: -31, marginTop: -31, borderRadius: '50%', background: tp.miss ? 'rgba(229,72,77,0.85)' : 'rgba(142,232,255,0.9)', transform: `scale(${0.6 + 0.9 * (1 - Math.exp(-a2 * 14))})`, opacity: 1 - a2 / 0.5 }} />; })}
          {listening && heardN > 0 ? (() => { const n = APP_HEARD[Math.min(heardN, 7) - 1], [st, fr] = FRET[n.midi]; return <div style={{ position: 'absolute', left: `${((fr - 0.5) / 8) * 100}%`, top: `${(5 - st + 0.5) / 6 * 100}%`, width: 46, height: 46, marginLeft: -23, marginTop: -23, borderRadius: '50%', border: '5px solid #ffd43b', opacity: 0.9 }} />; })() : null}
        </div>
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 56, height: 82, borderRadius: 41, background: ok ? '#3fbf7f' : '#8a63ff', fontWeight: 800, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${1 - 0.06 * kick(t - APP.check, 12) * (t >= APP.check ? 1 : 0)})` }}>{ok ? '+20 XP' : 'Check'}</div>
      </div>
    </div>
  );
};

/** A battery: outline, nub and a fill (0–1) that is red when low. */
const Battery: React.FC<{ fill: number; col?: string; w?: number }> = ({ fill, col = '#e5484d', w = 220 }) => (
  <svg viewBox="0 0 124 64" width={w} height={w * 64 / 124} style={{ overflow: 'visible' }}>
    <rect x={3} y={6} width={104} height={52} rx={11} fill="#fff" stroke={INK} strokeWidth={6} />
    <rect x={109} y={21} width={11} height={22} rx={4} fill={INK} />
    {fill > 0.005 ? <rect x={11} y={14} width={Math.max(6, 88 * fill)} height={36} rx={5} fill={col} /> : null}
  </svg>
);
/** The phone: the tab page is open, a low-battery banner pops up (1 %), then the screen dies (a dead battery on black). */
const PAYWALL_FRAME = (t: number) => {
  const a = T.paywall - 0.95, b = T.paywall + 1.15;
  if (t < a || t > b + 0.4) return null;
  const inU = sm((t - a) / 0.45), outU = sm((t - b) / 0.35);
  const y = lerp(H + 100, 480, inU) + 1700 * outU * outU, dead = t - T.paywall, low = t - (T.paywall - 0.5);
  const dim = 0.35 * sm(low / 0.5) * (dead < 0 ? 1 : 0), black = sm(dead / 0.12);
  const banner = low < 0 ? 0 : (dead < 0 ? 1 : 1 - sm(dead / 0.1));
  const blink = dead > 0.25 ? (Math.floor((dead - 0.25) / 0.3) % 2 === 0 ? 1 : 0.25) * sm((dead - 0.25) / 0.08) : 0;
  return (
    <div style={{ position: 'absolute', left: 610, top: y, width: 430, height: 780, transform: `rotate(${4 - 3 * inU}deg)` }}>
      <Spr n="phone" x={215} y={780} s={4.0} rot={0} />
      <div style={{ position: 'absolute', left: 55, top: 160, width: 320, height: 540, overflow: 'hidden', borderRadius: 8 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#05050a', opacity: Math.max(dim, black) }} />
        {banner > 0 ? <div style={{ position: 'absolute', left: 18, right: 18, top: 26, borderRadius: 26, background: '#fff', border: `7px solid ${INK}`, boxShadow: '0 8px 0 rgba(42,22,32,0.3)', padding: '14px 10px 12px', textAlign: 'center', opacity: banner, transform: `translateX(${10 * wob(low, 9, 40)}px) scale(${1 + 0.1 * wob(low, 8, 24) - 0.3 * (1 - sm(low / 0.15))})` }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Battery fill={0.07} w={150} /></div>
          <div style={{ marginTop: 6, fontFamily: SANS, fontWeight: 900, fontSize: 46, color: '#e5484d', lineHeight: 1 }}>1%</div>
          <div style={{ marginTop: 2, fontFamily: SANS, fontWeight: 800, fontSize: 26, color: INK }}>Low battery</div>
        </div> : null}
        {blink > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 190, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: blink, transform: `scale(${1 + 0.1 * wob(dead - 0.25, 8, 26)})` }}>
          <Battery fill={0} w={210} />
          <svg viewBox="0 0 60 80" width={70} height={92} style={{ marginTop: 16 }}><path d="M36 4 L10 46 H28 L22 76 L50 32 H32 Z" fill="#ffd43b" stroke={INK} strokeWidth={4} strokeLinejoin="round" /></svg>
        </div> : null}
      </div>
    </div>
  );
};

// --- the chain that ties Emma to the app: ear → hand → done. Emma runs it on every note; the app runs the same three steps. ------------------
const EarIcon: React.FC<{ glow?: string }> = ({ glow }) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
    <path d="M48 12 C26 12 18 32 20 52 C22 72 36 76 40 86 C44 96 62 96 64 80 C66 68 80 66 82 46 C84 24 68 12 48 12 Z" fill="#f2b48a" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
    <path d="M46 32 C34 32 32 50 42 58 C49 64 52 70 50 80" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M46 48 C42 48 41 54 46 55" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    {glow ? <><path d="M90 34 Q100 52 90 70" stroke={glow} strokeWidth={6} fill="none" strokeLinecap="round" /><path d="M99 24 Q114 52 99 80" stroke={glow} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.6} /></> : null}
  </svg>
);
const TapIcon: React.FC<{ ring: number }> = ({ ring }) => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
    <rect x={14} y={10} width={72} height={80} rx={8} fill="#2d1e14" stroke={INK} strokeWidth={6} />
    {[38, 62].map((x) => <rect key={x} x={x} y={12} width={4} height={76} fill="#a8946a" />)}
    {[28, 50, 72].map((y) => <rect key={y} x={16} y={y} width={68} height={3} fill="#d0c8b8" />)}
    <circle cx={52} cy={50} r={18 + 16 * ring} fill="none" stroke="#8ee8ff" strokeWidth={5} opacity={ring > 0 ? 0.9 * (1 - ring) : 0} />
    <circle cx={52} cy={50} r={12} fill="#8ee8ff" stroke={INK} strokeWidth={5} />
  </svg>
);
const DoneIcon: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
    <circle cx={50} cy={50} r={38} fill="#3fbf7f" stroke={INK} strokeWidth={6} />
    <path d="M30 52 L45 67 L72 36" stroke="#fff" strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
type Ev = { t: number; d: number };
const level = (t: number, evs: Ev[]) => { let l = 0; for (const e of evs) l = Math.max(l, sm((t - e.t) / 0.05) * (1 - sm((t - e.t - e.d) / 0.12))); return l; };
const Chain: React.FC<{ t: number; a: number; b: number; ear: Ev[]; play: Ev[]; done: number[]; total: number }> = ({ t, a, b, ear, play, done, total }) => {
  const o = win(t, a, b, 0.3, 0.25);
  if (o <= 0) return null;
  const pop = 1 + 0.08 * wob(t - a, 8, 22), le = level(t, ear), lp = level(t, play);
  const count = done.filter((d) => t >= d).length, doneAge = ageOf(t, done), ld = Math.min(1, kick(doneAge, 4) * 1.4);
  const ringAge = ageOf(t, play.map((e) => e.t));
  const chip = (x: number, label: string, col: string, lv: number, icon: React.ReactNode, extra?: React.ReactNode) => (
    <div style={{ position: 'absolute', left: x, top: 0, width: 250, textAlign: 'center', transform: `scale(${1 + 0.1 * lv})`, transformOrigin: '50% 50%' }}>
      <div style={{ width: 250, height: 210, borderRadius: 36, background: lv > 0.05 ? col : '#fff6e2', border: `9px solid ${INK}`, boxShadow: `0 10px 0 rgba(42,22,32,0.3)${lv > 0.05 ? `, 0 0 ${50 * lv}px ${col}` : ''}`, padding: 28, boxSizing: 'border-box', position: 'relative' }}>{icon}{extra}</div>
      <div style={{ marginTop: 14, fontFamily: SANS, fontWeight: 900, fontSize: 46, color: '#fff', WebkitTextStroke: `10px ${INK}`, paintOrder: 'stroke fill', letterSpacing: 1 }}>{label}</div>
    </div>
  );
  const arrow = (x: number, k: number) => {
    const dots = k === 0 ? ear : play;
    return (
      <div style={{ position: 'absolute', left: x, top: 78, width: 90, height: 60 }}>
        <svg viewBox="0 0 90 60" width="90" height="60"><path d="M6 30 H60 M46 12 L68 30 L46 48" stroke={INK} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 30 H60 M46 12 L68 30 L46 48" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {dots.map((e, i) => { const u = k === 0 ? (t - (e.t - 0.2)) / 0.2 : (t - e.t) / 0.2; if (u < 0 || u > 1) return null; return <div key={i} style={{ position: 'absolute', left: 6 + 62 * u - 12, top: 18, width: 24, height: 24, borderRadius: '50%', background: k === 0 ? '#ffd43b' : '#8ee8ff', border: `4px solid ${INK}` }} />; })}
      </div>
    );
  };
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 190, height: 280, opacity: o, transform: `translateY(${-40 * (1 - sm((t - a) / 0.4))}px) scale(${pop})`, transformOrigin: '50% 0' }}>
      <div style={{ position: 'absolute', left: 30, top: 0, width: 1020, height: 270 }}>
        {chip(0, 'HEAR', '#ffd43b', le, <EarIcon glow={le > 0.2 ? '#ffd43b' : undefined} />)}
        {arrow(255, 0)}
        {chip(385, 'PLAY', '#8ee8ff', lp, <TapIcon ring={ringAge < 0.35 ? ringAge / 0.35 : 0} />)}
        {arrow(640, 1)}
        {chip(770, 'DONE', '#7cf0a8', ld, <DoneIcon />, count > 0 ? <div style={{ position: 'absolute', right: -14, top: -22, minWidth: 74, padding: '4px 16px', borderRadius: 30, background: '#fff', border: `7px solid ${INK}`, fontFamily: SANS, fontWeight: 900, fontSize: 44, color: INK, transform: `scale(${1 + 0.35 * kick(doneAge, 10)})` }}>{count}/{total}</div> : null)}
      </div>
    </div>
  );
};

// --- the film -----------------------------------------------------------------------------------------------------------------------------------
const TG = { x: 330, y: 1545, s: 3.5 }, EST = { x: 850, y: 1565 }, EPL = { x: 790, y: 1600 }, ES = 3.0;   // Emma: where she stands / where the xylophone sits; one scale for every pose of her sheet
const XYL = { l: -41, r: 126, top: -45, mid: -28 };   // the xylophone in a pose's own pixels, from its (cx, fy) anchor
const BARS = [0, 1, 2, 3, 4, 5, 6, 7];
const BAR_COL = ['#e5484d', '#ff8a3d', '#ffd43b', '#7cd66b', '#3fcfd1', '#4a8cff', '#8a63ff', '#e5484d'];
const barIdx = (midi: number) => [0, 2, 4, 5, 7, 9, 11].indexOf(((midi - 72) % 12 + 12) % 12) + (midi >= 84 ? 7 : 0);
const GT = [...GUITAR1, ...GUITAR2, ...REPLAY_G].map((n) => n.t), ET = [...EMMA1, ...EMMA2, ...REPLAY_E].map((n) => n.t), ASK = 0.45;
const SOURT = SOUR.map((s) => s.t);

// --- Emma's poses (the second sheet): a pose is held for a while, a note changes it. Each note: a "strike" pose (the mallet on the bar, her head dipped)
// then a "raise" pose (the mallet up, a different face); the swaps are 2-frame cross-fades, the xylophone of every pose is aligned to the same spot.
type Seg = { a: number; b: number; n: string; flip?: boolean };
const HOP2 = T.duet - 0.85;
function playSegs(notes: { t: number; dur: number }[], strikes: string[], raises: string[], tail?: string): Seg[] {
  const out: Seg[] = [];
  notes.forEach((nt, k) => {
    const next = notes[k + 1] ? notes[k + 1].t : nt.t + nt.dur;
    out.push({ a: nt.t - 0.02, b: nt.t + 0.15, n: strikes[k % strikes.length] });
    out.push({ a: nt.t + 0.15, b: next - 0.02, n: raises[k % raises.length] });
  });
  if (tail) out.push({ a: notes[notes.length - 1].t + notes[notes.length - 1].dur - 0.02, b: 99, n: tail });
  return out;
}
const SEGS: Seg[] = [
  // Sunday: she runs in (arms up), points at dad, waits, hops down to the xylophone, is startled by the bad notes
  { a: -3, b: 1.1, n: 'excited' }, { a: 1.1, b: 2.5, n: 'pointing', flip: true }, { a: 2.5, b: 3.6, n: 'idle' }, { a: 3.6, b: 5.5, n: 'curious' },
  { a: 5.5, b: 5.85, n: 'excited' }, { a: 5.85, b: 6.05, n: 'sitting' }, { a: 6.05, b: 6.3, n: 'ready' }, { a: 6.3, b: 7.0, n: 'surprised' }, { a: 7.0, b: T.play - 0.02, n: 'ready' },
  // she plays line 1
  ...playSegs(EMMA1, ['p1', 'p3', 'p1', 'p3', 'p1', 'p3', 'p1'], ['p2', 'p2', 'p4', 'p4', 'p4', 'p4', 'p5']),
  { a: 11.43, b: 12.6, n: 'happy' },
  // next Sunday: she watches him (a hop of joy when he gets it), hops down, joins in, looks at him, plays on
  { a: 15.5, b: 17.0, n: 'idle' }, { a: 17.0, b: 18.1, n: 'excited' }, { a: 18.1, b: HOP2, n: 'idle' },
  { a: HOP2, b: HOP2 + 0.3, n: 'excited' }, { a: HOP2 + 0.3, b: HOP2 + 0.5, n: 'sitting' }, { a: HOP2 + 0.5, b: T.duet - 0.02, n: 'ready' },
  ...playSegs(EMMA2, ['p1', 'p3', 'p1', 'p3', 'p1', 'p3', 'p1'], ['p4', 'p4', 'p4', 'p4', 'p4', 'p5', 'p5']),
  { a: T.end - 0.02, b: T.replay - 0.02, n: 'lookdad' },
  ...playSegs(REPLAY_E, ['p1', 'p3'], ['p4', 'p4'], 'p4'),
];
const SEG_FW = 0.04;
const segO = (t: number, g: Seg) => sm((t - g.a + SEG_FW / 2) / SEG_FW) * (1 - sm((t - g.b + SEG_FW / 2) / SEG_FW));

export const TwinkleEp4: React.FC = () => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const c = camAt(t);
  const hand = { x: 5 * Math.sin(t * 0.9) + 3 * Math.sin(t * 2.3 + 1), y: 4 * Math.sin(t * 0.7 + 2) + 2 * Math.sin(t * 2.9), r: 0.12 * Math.sin(t * 0.8 + 0.5) };
  const night = sm((t - T.night) / 0.4) * (1 - sm((t - 15.75) / 0.4));
  const isNight = night > 0.5;
  const toS = (wx: number, wy: number) => ({ x: W / 2 + (wx - c.x) * c.s + hand.x, y: H / 2 + (wy - c.y) * c.s + hand.y });
  // parallax: the wall is far, so it follows the camera at 0.88 of the foreground's travel (and zoom)
  const layer = (d: number): React.CSSProperties => { const bx = 600, by = 1010, lx = bx + (c.x - bx) * d, ly = by + (c.y - by) * d, ls = Math.pow(c.s, d); return { position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${W / 2 + hand.x * d}px, ${H / 2 + hand.y * d}px) scale(${ls}) translate(${-lx}px, ${-ly}px)`, transformOrigin: '0 0' }; };

  // --- Tab Guy ---
  const strumAge = ageOf(t, GT), sourAge = ageOf(t, SOURT), askAge = t - ASK, laughAge = t - T.laugh;
  const laughAmp = laughAge >= 0 && laughAge < 1.0 ? Math.exp(-laughAge * 2.4) * sm(laughAge / 0.05) : 0;
  const phoneIn = sm((t - 4.0) / 0.45) * (1 - sm((t - 5.95) / 0.3)) + sm((t - 12.5) / 0.35) * (1 - sm((t - 15.45) / 0.3));
  const thinkMix = clamp(phoneIn);
    const sway = (t >= T.guitar - 0.1 && t < T.fade + 0.6 ? 1.6 * Math.sin(((t - T.guitar) * Math.PI * 2) / (2 * QP)) : 0);
  const tgRot = 1.0 * Math.sin(t * 1.1) + 3.5 * wob(askAge - 0.9, 7, 20) * (t < 3 ? 1 : 0) - 4 * thinkMix + 6 * wob(sourAge, 6, 34) + sway + 2.4 * laughAmp * Math.sin(t * 34);
  const tgDy = 3 * Math.sin(t * 2 * Math.PI / 3.2) + (t < 6 ? 0 : 0) - 10 * kick(strumAge, 12) * (t >= T.guitar ? 1 : 0) - 7 * laughAmp * Math.abs(Math.sin(t * 17));
  const tgSy = 1 + 0.009 * Math.sin(t * 2 * Math.PI / 3.2) - 0.05 * kick(strumAge, 14) * (t >= T.guitar ? 1 : 0) - 0.06 * wob(sourAge, 7, 30);
  const tgSx = 1 - 0.5 * (tgSy - 1);
  const tgSit = 1 - thinkMix, tgThink = thinkMix;
  const nightIn = night;
  // --- Emma: anchor (stands → hops down to the xylophone → plays → cheers → gone in the night → stands → hops down → duet)
  const hop1 = hump(t, 5.55, 0.5), hop2 = hump(t, HOP2, 0.5);
  const run = 1 - sm(t / 0.85), runX = 560 * run, runDy = -30 * Math.abs(Math.sin(t * 13)) * run;
  const at = sm((t - 5.55) / 0.5) * (1 - sm((t - 12.2) / 0.2)) + sm((t - HOP2) / 0.5);
  const emmaMaster = (t < 14 ? 1 - sm((t - 12.15) / 0.25) : sm((t - 15.85) / 0.15));
  const eAge = ageOf(t, ET), hit = kick(eAge, 11);
  const atXylo = (t >= 6.0 && t < 12.4) || (t >= T.duet - 0.3 && t < T.fade + 0.8);
  const emmaX = EST.x + (EPL.x - EST.x) * at + runX, emmaY = EST.y + (EPL.y - EST.y) * at - 240 * hop1 - 110 * hop2 + runDy;
  const stretchS = hop1 + hop2;
  const emmaSx = (1 + 0.01 * Math.sin(t * 2 * Math.PI / 2.8 + 1)) * (1 - 0.1 * stretchS) * (1 + 0.03 * hit * (atXylo ? 1 : 0));
  const emmaSy = (1 + 0.012 * Math.sin(t * 2 * Math.PI / 2.8)) * (1 + 0.1 * stretchS) * (1 - 0.14 * kick(Math.abs(t - 5.55), 6) * (t < 5.7 ? 1 : 0)) * (1 - 0.04 * hit * (atXylo ? 1 : 0));
  const emmaRot = (atXylo ? 1.2 * Math.sin(t * Math.PI * 2 / (t > 12 ? 2 * QP : 1.0)) : 1.2 * Math.sin(t * 1.7) + 5 * wob(t - ASK + 0.2, 6, 18) * run);

  // note bursts at the instruments
  const guitarPos = { x: TG.x + 255, y: TG.y - 440 }, xyloPos = (m: number) => ({ x: EPL.x + (XYL.l + (barIdx(m) + 0.5) / 8 * (XYL.r - XYL.l)) * ES, y: EPL.y + (XYL.top - 12) * ES });
  const bursts: Burst[] = [
    ...EMMA1.map((n, i) => ({ t: n.t, ...xyloPos(n.midi), k: i, c: BAR_COL[barIdx(n.midi) % 8] })),
    ...EMMA2.map((n, i) => ({ t: n.t, ...xyloPos(n.midi), k: i + 1, c: BAR_COL[barIdx(n.midi) % 8] })),
    ...REPLAY_E.map((n, i) => ({ t: n.t, ...xyloPos(n.midi), k: i, c: BAR_COL[barIdx(n.midi) % 8] })),
    ...GUITAR1.map((n, i) => ({ t: n.t, ...guitarPos, k: i })), ...GUITAR2.map((n, i) => ({ t: n.t, ...guitarPos, k: i + 2 })), ...REPLAY_G.map((n, i) => ({ t: n.t, ...guitarPos, k: i })),
    ...SOUR.flatMap((s) => [0, 1].map((j) => ({ t: s.t, x: guitarPos.x - 40 * j, y: guitarPos.y, k: j + 1, c: '#e5484d' }))),
  ];
  // glow on the bar that was just struck
  const lastE = [...EMMA1, ...EMMA2, ...REPLAY_E].filter((n) => t >= n.t && t - n.t < 0.45).slice(-1)[0];

  const fade0 = sm((t - 0.0) / 0.5);
  const cardU = sm((t - T.card) / 0.5), blackU = sm((t - T.fade) / 0.55);
  // close-ups: his frozen face, then Emma's, then she is FIVE; and Emma's deadpan "Again!"
  const faceO = win(t, T.face, T.emmaFace + 0.06, 0.1, 0.06), emmaFaceO = win(t, T.emmaFace, 11.4, 0.1, 0.15), fiveO = win(t, T.emmaFace + 0.25, 11.4, 0.1, 0.15);
  const portrait = win(t, T.again - 0.6, T.again + 0.85, 0.2, 0.15);
  const glee = sm((t - (T.again - 0.05)) / 0.14);
  const hookO = win(t, T.hook, 3.55, 0.25, 0.3);
  const bubbleT = toS(TG.x + 120, TG.y - 330 * 1.0);
  const sourFace = t >= T.sour1 && t < T.toEmma + 0.1;
  const sunLight = (1 - night) * 0.6;
  const hl = lastE ? (() => { const b = barIdx(lastE.midi) % 8, a = t - lastE.t; return { b, a }; })() : null;

  return (
    <AbsoluteFill style={{ background: '#1a0f30', overflow: 'hidden', opacity: fade0 }}>
      <Audio src={staticFile('twinkle.wav')} />
      {/* far layer: wall, window, shelf */}
      <div style={layer(0.88)}><Wall t={t} /></div>
      {/* sun beams over the room, fading as the night comes */}
      <div style={layer(0.94)}>
        <svg width={W + 1800} height={2400} viewBox={`-900 0 ${W + 1800} 2400`} style={{ position: 'absolute', left: -900, top: 0, mixBlendMode: 'screen', opacity: sunLight }}>
          <defs><linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe9a8" stopOpacity="0.8" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></linearGradient></defs>
          <polygon points={`110,190 500,190 ${1050 + 30 * Math.sin(t * 0.5)},1900 ${500 + 30 * Math.sin(t * 0.5)},2000`} fill="url(#beam)" opacity={0.55} />
        </svg>
      </div>
      <div style={layer(1)}>
        <Sofa /><Lamp /><Floor light={night} />
        {/* soft contact shadows under both characters */}
        <div style={{ position: 'absolute', left: TG.x - 330, top: TG.y - 26, width: 660, height: 56, borderRadius: '50%', background: 'rgba(60,30,20,0.28)', filter: 'blur(10px)' }} />
        <Notes t={t} bursts={bursts} />
        {/* Tab Guy: sits with the guitar; the "think" pose (hand on chin) cross-fades in with the head kept in place */}
        <Spr n="tab_sit" x={TG.x} y={TG.y + tgDy} s={TG.s} rot={tgRot} sx={tgSx} sy={tgSy} o={tgSit} pivotY={0} />
        <Spr n="tab_think" x={TG.x - 7.9 * TG.s + 17} y={TG.y - 28 * TG.s - 20 + tgDy} s={TG.s} rot={tgRot} sx={tgSx} sy={tgSy} o={tgThink} fadeBottom={14} />
        {/* Emma */}
        {SEGS.map((g, i) => { const o = segO(t, g) * emmaMaster * (1 - clamp(emmaFaceO + portrait)); return o > 0.003 ? <Spr key={i} n={`em_${g.n}`} x={emmaX} y={emmaY} s={ES} flip={g.flip} o={o} sx={emmaSx} sy={emmaSy} rot={emmaRot} /> : null; })}
        {/* the struck xylophone bar glows */}
        {hl && atXylo ? (() => {
          const bx = EPL.x + (XYL.l + (hl.b + 0.5) / 8 * (XYL.r - XYL.l)) * ES, by = EPL.y + XYL.mid * ES;
          return <div style={{ position: 'absolute', left: bx - 56, top: by - 44, width: 112, height: 88, borderRadius: '50%', background: BAR_COL[hl.b], opacity: 0.55 * (1 - hl.a / 0.45), mixBlendMode: 'screen', filter: 'blur(14px)' }} />;
        })() : null}
        {/* sunlit dust */}
        {MOTES.map((m, i) => <div key={i} style={{ position: 'absolute', left: 140 + m.x * 900 + 30 * Math.sin(t * 0.4 + m.ph), top: 260 + m.y * 1200 + 40 * Math.sin(t * 0.3 + m.ph * 2), width: 8 * m.s, height: 8 * m.s, borderRadius: '50%', background: '#fff6d8', opacity: 0.55 * (1 - night) }} />)}
      </div>

      {/* grades: the night is a multiply + the phone's glow; the day has a soft vignette and a warm wash */}
      <AbsoluteFill style={{ background: '#0b1034', opacity: 0.8 * night, mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 70% 58%, rgba(142,232,255,0.42), rgba(142,232,255,0) 52%)', opacity: night * sm((t - APP.open + 0.1) / 0.5), mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 52%, rgba(40,15,20,0.45) 100%)' }} />
      <AbsoluteFill style={{ background: '#ffb457', opacity: 0.07 * (1 - night), mixBlendMode: 'soft-light' }} />
      {sourFace ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 40% 55%, rgba(229,72,77,0.4), transparent 60%)', opacity: clamp(1 - sourAge / 0.3) }} /> : null}

      {/* hook: what Emma is asking, in text */}
      {hookO > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 190, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 100, lineHeight: 1.06, color: '#fff', WebkitTextStroke: `18px ${INK}`, paintOrder: 'stroke fill', opacity: hookO, transform: `translateY(${-30 * (1 - sm((t - T.hook) / 0.5))}px) scale(${1 + 0.08 * wob(t - T.hook, 7, 22)})` }}>
        “Dad, can you play<br /><span style={{ color: '#ffd43b' }}>Twinkle Twinkle?</span>”
      </div> : null}
      {/* "That night." */}
      {win(t, T.nextSun, T.guitar + 0.25, 0.2, 0.25) > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 220, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 124, color: '#fff', WebkitTextStroke: `18px ${INK}`, paintOrder: 'stroke fill', opacity: win(t, T.nextSun, T.guitar + 0.25, 0.2, 0.25), transform: `scale(${1 + 0.08 * wob(t - T.nextSun, 7, 22)})` }}>Next <span style={{ color: '#ffd43b' }}>Sunday.</span></div> : null}
      {win(t, T.thatNight, 12.95, 0.2, 0.25) > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 220, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 124, color: '#fff', WebkitTextStroke: `18px ${INK}`, paintOrder: 'stroke fill', opacity: win(t, T.thatNight, 12.95, 0.2, 0.25), transform: `scale(${1 + 0.08 * wob(t - T.thatNight, 7, 22)})` }}>That <span style={{ color: '#8ee8ff' }}>night.</span></div> : null}
      {/* the chain: Emma runs it on every note, the app runs the same three steps */}
      <Chain t={t} a={T.play - 0.25} b={T.face - 0.05} total={7} ear={EMMA1.map((n) => ({ t: n.t - 0.22, d: 0.22 }))} play={EMMA1.map((n) => ({ t: n.t, d: 0.26 }))} done={EMMA1.map((n) => n.t + 0.1)} />
      <Chain t={t} a={APP.open + 0.25} b={15.95} total={7} ear={APP_HEARD.map((n) => ({ t: n.t, d: 0.15 }))} play={APP_TAPS.map((n) => ({ t: n.t, d: 0.14 }))} done={APP_TAPS.filter((n) => !n.miss).map((n) => n.t + 0.06)} />
      <PAYWALL_FRAME_C t={t} />
      <Phone t={t} />
      {/* he laughs */}
      <Bubble x={bubbleT.x} y={bubbleT.y} t={t} a={T.laugh} b={T.laugh + 0.8} text="Okay, okay!" tail="l" size={70} />

      {/* close-up 1: Tab Guy has frozen */}
      {faceO > 0 ? <AbsoluteFill style={{ opacity: faceO }}>
        <AbsoluteFill style={{ background: 'rgba(26,15,48,0.78)' }} />
        <Spr n="tab_h_shock" x={540} y={1400 + 10 * Math.sin(t * 2)} s={8.4 * (1 + 0.05 * sm((t - T.face) / 1.1))} rot={0.9 * Math.sin(t * 46)} sy={1 + 0.006 * Math.sin(t * 30)} fadeBottom={20} />
      </AbsoluteFill> : null}
      {/* close-up 2: Emma, pleased, and the line */}
      {emmaFaceO > 0 ? <AbsoluteFill style={{ opacity: emmaFaceO }}>
        <AbsoluteFill style={{ background: 'rgba(26,15,48,0.72)' }} />
        <Spr n="em_h_five" x={540} y={1460 + 12 * Math.sin(t * 2.2)} s={5.8 * (1 + 0.05 * sm((t - T.emmaFace) / 1.3))} sy={1 + 0.008 * Math.sin(t * 3)} fadeBottom={22} />
      </AbsoluteFill> : null}
      {fiveO > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 170, lineHeight: 1.0, color: '#fff', WebkitTextStroke: `20px ${INK}`, paintOrder: 'stroke fill', opacity: fiveO, transform: `scale(${1 + 0.14 * wob(t - T.emmaFace - 0.25, 7, 22) - 0.3 * (1 - sm((t - T.emmaFace - 0.25) / 0.16))})` }}>She’s <span style={{ color: '#ffd43b' }}>FIVE.</span></div> : null}

      {/* the last shot: Emma's face, deadpan, then she smiles: "Again!" */}
      {portrait > 0 ? <AbsoluteFill style={{ opacity: portrait }}>
        <AbsoluteFill style={{ background: 'rgba(26,15,48,0.72)' }} />
        <Spr n="em_h_calm" x={540} y={1460 + 12 * Math.sin(t * 2)} s={5.4 * (1 + 0.04 * sm((t - T.again + 0.6) / 1.4))} sy={1 + 0.008 * Math.sin(t * 3)} o={1 - glee} fadeBottom={22} />
        <Spr n="em_h_glee" x={540} y={1460 + 12 * Math.sin(t * 2)} s={5.4 * (1 + 0.04 * sm((t - T.again + 0.6) / 1.4))} sy={1 + 0.008 * Math.sin(t * 3)} o={glee} fadeBottom={22} />
        <Bubble x={640} y={640} t={t} a={T.again} b={T.again + 0.85} text="Again!" tail="l" size={96} />
      </AbsoluteFill> : null}

      {/* fade to black, then the line and the logo */}
      {blackU > 0 ? <AbsoluteFill style={{ background: '#0d0820', opacity: 0.985 * blackU }} /> : null}
      {cardU > 0 ? <AbsoluteFill style={{ opacity: cardU }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: SANS, fontWeight: 900, fontSize: 112, lineHeight: 1.1, color: '#fff', WebkitTextStroke: `16px ${INK}`, paintOrder: 'stroke fill', transform: `translateY(${40 * (1 - sm((t - T.card) / 0.5))}px) scale(${1 + 0.04 * wob(t - T.card - 0.2, 7, 22)})` }}>
          Stop reading<br />music.<br /><span style={{ color: '#ffd43b' }}>Start hearing it.</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1210, textAlign: 'center', opacity: sm((t - T.card - 0.4) / 0.4) }}>
          <div style={{ display: 'inline-block', width: 190, height: 190, transform: `scale(${1 + 0.12 * wob(t - T.card - 0.4, 7, 20)})` }}><EarIcon glow="#ffd43b" /></div>
          <div style={{ marginTop: 14, fontFamily: SANS, fontWeight: 900, fontSize: 100, color: '#fff', WebkitTextStroke: `14px ${INK}`, paintOrder: 'stroke fill', letterSpacing: 1 }}>Ear Warrior</div>
          <div style={{ marginTop: 6, fontFamily: SANS, fontWeight: 800, fontSize: 50, color: '#d9d3ff' }}>link in profile</div>
        </div>
      </AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
const PAYWALL_FRAME_C: React.FC<{ t: number }> = ({ t }) => <>{PAYWALL_FRAME(t)}</>;
