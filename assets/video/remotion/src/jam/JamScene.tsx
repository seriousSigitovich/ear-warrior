// Tab Guy, ep. 1 — "Blues in A". The three-piece from the band character sheet (public/band/<who>_<pose>.png, one frame per pose) on a club
// stage: the guitarist (Tab Guy) is asked to jump in, looks for a tab on his phone, misses twice and freezes; the bassist listens one beat, plays
// the lick by ear and jumps on the last hit; end card. Timeline: ../../jam/story.mjs (also drives the soundtrack and the voices).
//
// Everything is a pure function of the time `t`. The sheet gives single poses, so the life comes from code (README "Animation principles"):
//   poses swap on the beat (play ↔ head-bob, hit on the snare)  SQUASH/STRETCH anchored at the feet   ANTICIPATION crouch in the drum roll
//   OVERSHOOT damped cosines on every hit, recoil on the misses   HOLD after the landing                  SECONDARY crowd, lights, notes, shake
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, easeOut, rng } from '../util';
import { T, BEAT, BAR, T0, BEATS, SNARES, LEAD, LEAD_POS, FILL, DURATION } from '../../jam/story.mjs';
import SPRITES from '../../jam/sprites.json';

const W = 1080, H = 1920;
const MONO = 'Menlo, "SF Mono", "Courier New", monospace';
const OUTLINE: React.CSSProperties = { fontFamily: MONO, fontWeight: 800, WebkitTextStroke: '10px #0b0716', paintOrder: 'stroke fill', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' };

// --- motion vocabulary (same as src/byear/ByEar.tsx) ----------------------------------------------------------------------------------
const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
const pre = (t: number, a: number, b: number) => (t < a || t >= b ? 0 : easeInOut((t - a) / (b - a)));
const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };
const win = (t: number, a: number, b: number, fi = 0.18, fo = 0.18) => clamp((t - a) / fi) * clamp((b - t) / fo);
/** Index of the current beat (−1 before the first). */
const beatIdx = (t: number) => { let k = -1; for (let i = 0; i < BEATS.length; i++) if (t >= BEATS[i]) k = i; return k; };

// --- camera: eased keyframes of { x, y } (world point at the screen centre) and zoom s -------------------------------------------------
type Cam = { t: number; x: number; y: number; s: number };
const CAM: Cam[] = [
  { t: 0, x: 540, y: 1000, s: 1.0 }, { t: 2.0, x: 540, y: 1020, s: 1.06 },
  { t: T.phone - 0.05, x: 540, y: 1030, s: 1.06 }, { t: T.phone + 0.35, x: 400, y: 1250, s: 1.75 }, { t: T.miss1 - 0.1, x: 410, y: 1250, s: 1.8 },
  { t: T.miss1 + 0.15, x: 400, y: 1180, s: 1.4 }, { t: T.freeze, x: 490, y: 1110, s: 1.18 }, { t: T.listen - 0.2, x: 480, y: 1115, s: 1.24 },     // pull back: the band plays on without him
  { t: T.listen + 0.3, x: 740, y: 1170, s: 1.5 }, { t: T.fill - 1.2, x: 720, y: 1150, s: 1.4 },
  { t: T.fill - 0.3, x: 560, y: 1060, s: 1.08 }, { t: T.hit, x: 560, y: 1040, s: 1.12 }, { t: DURATION, x: 560, y: 1020, s: 1.18 },
];
function camAt(t: number) {
  let i = 0;
  while (i < CAM.length - 2 && t >= CAM[i + 1].t) i++;
  const a = CAM[i], b = CAM[i + 1], u = easeInOut(clamp((t - a.t) / (b.t - a.t)));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, s: a.s + (b.s - a.s) * u };
}

// --- the band ------------------------------------------------------------------------------------------------------------------------
type Who = 'drummer' | 'guitarist' | 'bassist';
type Pose = 'idle' | 'play' | 'hard' | 'bob' | 'fill' | 'jump';
const POSES: Record<Who, Pose[]> = { drummer: ['idle', 'play', 'hard', 'bob', 'fill'], guitarist: ['idle', 'play', 'hard', 'bob', 'jump'], bassist: ['idle', 'play', 'hard', 'bob', 'jump'] };
const SP = SPRITES as Record<string, { w: number; h: number; cx: number }>;
const SPOT = { drummer: { x: 545, y: 1320, s: 2.45 }, guitarist: { x: 290, y: 1600, s: 2.8 }, bassist: { x: 805, y: 1600, s: 2.8 } };

const Sprite: React.FC<{ who: Who; pose: Pose; x: number; y: number; s: number; flip?: boolean; lean?: number; sx?: number; sy?: number; filter?: string }> =
  ({ who, pose, x, y, s, flip, lean = 0, sx = 1, sy = 1, filter }) => (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `rotate(${lean}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`, transformOrigin: '0 0', filter }}>
      {POSES[who].map((p) => {
        const m = SP[`${who}_${p}`];
        return <Img key={p} src={staticFile(`band/${who}_${p}.png`)} style={{ position: 'absolute', left: -m.cx * s, top: -m.h * s, width: m.w * s, height: m.h * s, imageRendering: 'pixelated', visibility: p === pose ? 'visible' : 'hidden' }} />;
      })}
    </div>
  );

// --- the room ------------------------------------------------------------------------------------------------------------------------
const BRICKS = (() => { const r = rng(7), out: { x: number; y: number; c: string }[] = []; for (let y = 0; y < 1260; y += 36) for (let x = (y / 36) % 2 ? -40 : 0; x < W; x += 80) out.push({ x, y, c: ['#1d1430', '#21173a', '#1a1229', '#24193f'][Math.floor(r() * 4)] }); return out; })();
const HEADS = (() => { const r = rng(21); return Array.from({ length: 13 }, (_, i) => ({ x: -30 + i * 92 + r() * 30, y: 1740 + r() * 60, s: 0.85 + r() * 0.35, ph: r() * 6.28, arm: r() < 0.5 })); })();

const Room: React.FC<{ t: number; mood: number; warm: number; energy: number; strobe: number; zoom: number }> = ({ t, mood, warm, energy, strobe, zoom }) => {
  const bi = beatIdx(t), onBeat = bi >= 0 ? kick(t - BEATS[bi], 7) : 0;
  // the sign lives in the wide shots only — in the close-ups it would sit under the captions
  const neon = (0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 2.3) + 0.2 * onBeat) * clamp((1.22 - zoom) / 0.12);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} shapeRendering="crispEdges">
      <defs>
        <linearGradient id="beamA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9a8ff" stopOpacity="0.35" /><stop offset="1" stopColor="#c9a8ff" stopOpacity="0" /></linearGradient>
        <linearGradient id="beamW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></linearGradient>
        <radialGradient id="vig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.7" /></radialGradient>
      </defs>
      <rect x={-400} y={-400} width={W + 800} height={1660} fill="#150e26" />
      {BRICKS.map((b, i) => <rect key={i} x={b.x + 2} y={b.y + 2} width={76} height={32} fill={b.c} />)}
      {/* neon sign over the drummer */}
      <g opacity={neon}>
        <rect x={330} y={700} width={420} height={128} rx={14} fill="none" stroke="#ff5fa8" strokeWidth={8} style={{ filter: 'drop-shadow(0 0 18px #ff5fa8)' }} />
        <text x={540} y={788} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={72} fill="#ffd6ec" style={{ filter: 'drop-shadow(0 0 14px #ff5fa8)' }}>OPEN JAM</text>
      </g>
      {/* amps */}
      <rect x={40} y={1180} width={190} height={170} fill="#1b1424" stroke="#3a2d4c" strokeWidth={6} /><rect x={58} y={1200} width={154} height={22} fill="#b8913a" />
      <rect x={850} y={1110} width={210} height={250} fill="#1b1424" stroke="#3a2d4c" strokeWidth={6} />
      {[0, 1].map((k) => <circle key={k} cx={955} cy={1180 + k * 110} r={44 + 3 * onBeat} fill="#0b0716" stroke="#2c2238" strokeWidth={6} />)}
      {/* drum riser + stage */}
      <rect x={-400} y={1340} width={W + 800} height={300} fill="#2a1d3c" />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={-400 + i * 120} y={1340} width={4} height={300} fill="#22172f" />)}
      <rect x={330} y={1250} width={420} height={90} fill="#30223f" stroke="#43305a" strokeWidth={6} />
      <rect x={-400} y={1636} width={W + 800} height={14} fill="#4a3270" />
      {/* light beams: three cool ones that sway on the beat; a warm spot on the bassist when the lick starts */}
      {[180, 540, 900].map((x, i) => {
        const sway = Math.sin(t * 1.4 + i * 2.1) * 90;
        return <polygon key={i} points={`${x - 30},-40 ${x + 30},-40 ${x + 220 + sway},1640 ${x - 220 + sway},1640`} fill="url(#beamA)" opacity={(0.55 + 0.45 * onBeat) * mood} style={{ mixBlendMode: 'screen' }} />;
      })}
      <polygon points="780,-40 840,-40 1060,1640 600,1640" fill="url(#beamW)" opacity={warm} style={{ mixBlendMode: 'screen' }} />
      {strobe > 0 ? <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#fff6e0" opacity={strobe} /> : null}
      {/* the crowd: silhouettes that bob on the beat with the room's energy, arms up when it's high */}
      {HEADS.map((h, i) => {
        const bob = (energy * 22 + 4) * (bi >= 0 ? kick(t - BEATS[bi] - (i % 3) * 0.03, 8) : 0) + 3 * Math.sin(t * 2 + h.ph);
        const up = energy > 0.7 && h.arm ? clamp((energy - 0.7) / 0.2) : 0;
        return (
          <g key={i} transform={`translate(${h.x} ${h.y - bob}) scale(${h.s})`} shapeRendering="auto">
            {up > 0 ? <rect x={i % 2 ? 40 : -52} y={-170 * up} width={18} height={170 * up + 40} rx={9} fill="#07040f" /> : null}
            <ellipse cx={0} cy={0} rx={48} ry={56} fill="#07040f" />
            <rect x={-80} y={40} width={160} height={260} rx={60} fill="#07040f" />
          </g>
        );
      })}
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="url(#vig)" />
    </svg>
  );
};

// --- overlays ------------------------------------------------------------------------------------------------------------------------
const Chip: React.FC<{ children: React.ReactNode; style: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', fontFamily: MONO, fontWeight: 800, fontSize: 40, color: '#fff', background: 'rgba(11,7,22,0.82)', border: '4px solid #5a3f86', borderRadius: 10, padding: '12px 20px', letterSpacing: 2, ...style }}>{children}</div>
);

const Bubble: React.FC<{ x: number; y: number; text: string[]; t: number; a: number; b: number; tail: 'left' | 'right' }> = ({ x, y, text, t, a, b, tail }) => {
  const o = win(t, a, b, 0.12, 0.15), pop = 1 + 0.18 * wob(t - a, 9, 26);
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tail === 'right' ? '-100%' : '0'}, -100%) scale(${pop})`, transformOrigin: tail === 'right' ? '100% 100%' : '0 100%', opacity: o }}>
      <div style={{ background: '#fff', color: '#1c1730', fontFamily: MONO, fontWeight: 800, fontSize: 46, lineHeight: 1.2, padding: '18px 24px', borderRadius: 10, boxShadow: '0 0 0 6px #0b0716', whiteSpace: 'nowrap' }}>
        {text.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={{ position: 'absolute', bottom: -22, [tail === 'right' ? 'right' : 'left']: 40, width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '24px solid #fff' }} />
    </div>
  );
};

const Phone: React.FC<{ t: number }> = ({ t }) => {
  const a = T.phone + 0.2, b = T.miss1 - 0.05;
  if (t < a - 0.1 || t > b + 0.3) return null;
  const inU = easeOut(clamp((t - a) / 0.35)), outU = clamp((t - b) / 0.25);
  const y = 1920 - (1060 + 40 * wob(t - a - 0.35, 7, 18)) * inU + 1300 * outU * outU;
  const query = 'blues in A tab', typed = query.slice(0, Math.floor(clamp((t - a - 0.2) / 0.4) * query.length));
  const searching = t > a + 0.65 && t < a + 0.9, none = t >= a + 0.9;          // the verdict needs ~0.9 s on screen before the first miss
  return (
    <div style={{ position: 'absolute', left: 520, top: y, width: 470, height: 900, background: '#0b0716', borderRadius: 54, padding: 26, boxShadow: '0 0 0 8px #3a2a58, 0 0 80px rgba(142,232,255,0.45)', transform: `rotate(${-6 + 2 * Math.sin(t * 3)}deg)` }}>
      <div style={{ width: '100%', height: '100%', background: '#f4f2fa', borderRadius: 30, padding: '40px 26px', fontFamily: MONO, fontWeight: 700, color: '#1c1730' }}>
        <div style={{ background: '#e2ddf3', borderRadius: 14, padding: '18px 18px', fontSize: 34 }}>🔍 {typed}<span style={{ opacity: Math.sin(t * 14) > 0 ? 1 : 0 }}>|</span></div>
        {searching ? <div style={{ width: 90, height: 90, margin: '120px auto 0', borderRadius: '50%', border: '12px solid #d8d2ee', borderTopColor: '#8a3a86', transform: `rotate(${t * 720}deg)` }} /> : null}
        {none ? (
          <div style={{ marginTop: 110, textAlign: 'center', fontSize: 40, lineHeight: 1.35, transform: `scale(${1 + 0.15 * wob(t - a - 0.9, 9, 26)})` }}>
            <div style={{ fontSize: 96 }}>🤷</div>
            No tab found for<br /><span style={{ color: '#e5484d' }}>“your band,<br />right now”</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** The app's fretboard as an inset: `strings` strings, frets 0–12; `dots` light up (green = by ear, red = a miss). */
const Neck: React.FC<{ strings: number; dots: { s: number; f: number; c: string; o: number }[]; y: number; o: number }> = ({ strings, dots, y, o }) => {
  if (o <= 0) return null;
  const x0 = 70, w = 940, h = 46 * (strings - 1), fx = (f: number) => x0 + (f === 0 ? -18 : ((f - 0.5) / 12) * w);
  return (
    <svg width={W} height={h + 80} style={{ position: 'absolute', left: 0, top: y, opacity: o }}>
      <rect x={x0} y={30} width={w} height={h + 20} rx={8} fill="#2a1d14" stroke="#0b0716" strokeWidth={6} />
      {Array.from({ length: 13 }, (_, f) => <rect key={f} x={x0 + (f / 12) * w - 3} y={30} width={f === 0 ? 10 : 6} height={h + 20} fill={f === 0 ? '#e8e0cc' : '#c9b48a'} />)}
      {[3, 5, 7, 9].map((f) => <circle key={f} cx={fx(f)} cy={40 + h / 2} r={8} fill="#5a4636" />)}
      {Array.from({ length: strings }, (_, s) => <rect key={s} x={x0} y={40 + s * 46 - 2} width={w} height={3 + (strings - 1 - s) * 0.8} fill="#b9b2a6" />)}
      {dots.map((d, i) => d.o > 0 ? <circle key={i} cx={fx(d.f)} cy={40 + (strings - 1 - d.s) * 46} r={20 * (0.7 + 0.3 * d.o)} fill={d.c} stroke="#0b0716" strokeWidth={5} opacity={d.o} /> : null)}
    </svg>
  );
};

// --- the film --------------------------------------------------------------------------------------------------------------------------
const LEAD_T = LEAD.map((n) => n.t), MISS_T = [T.miss1, T.miss2];
const SN_T = [...SNARES, ...FILL, T.hit];

export const JamBlues: React.FC = () => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const bi = beatIdx(t), beatAge = bi >= 0 ? t - BEATS[bi] : Infinity, grooving = t >= T0 && t < T.fill;
  const missAge = ageOf(t, MISS_T), hitAge = t - T.hit, onCard = t >= T.card;

  // the room's mood: the misses kill it, the lick lifts it, the hit blows it up
  const energy = t < T0 ? 0.25 : t < T.miss1 ? 0.45 : t < T.listen ? 0.12 : t < T.lick ? 0.2 : t < T.hit ? 0.6 + 0.35 * clamp((t - T.lick) / 2) : 1;
  const warm = win(t, T.listen + 0.2, T.card, 0.5, 0.3) * 0.9;
  const cold = win(t, T.freeze - 0.3, T.listen + 0.3, 0.4, 0.5);
  const strobe = hitAge >= 0 ? 0.5 * kick(hitAge, 7) : 0;

  // camera + shake (misses, the hit)
  const c = camAt(t);
  const shake = 26 * kick(missAge, 10) + 34 * kick(hitAge, 8);
  const shx = shake * Math.sin(t * 91), shy = shake * Math.cos(t * 77);
  const toScreen = (wx: number, wy: number) => ({ x: W / 2 + (wx - c.x) * c.s + shx, y: H / 2 + (wy - c.y) * c.s + shy });

  // --- drummer: play ↔ bob on alternate beats, the snare hits show HIT HARD, the roll FILL; a bounce on every beat
  const drumPose: Pose = t < T0 ? (ageOf(t, T.count) < 0.12 ? 'hard' : 'idle') : t >= T.fill && t < T.hit ? 'fill' : ageOf(t, SN_T) < 0.13 ? 'hard' : t >= T.hit + 0.6 ? 'bob' : bi % 2 ? 'bob' : 'play';
  const dBounce = 10 * kick(beatAge, 9) + 14 * kick(hitAge, 7) + 3 * Math.sin(t * 1.7);
  const dSy = 1 - 0.03 * kick(beatAge, 12) - 0.05 * kick(hitAge, 9);

  // --- bassist: grooves from bar 1, nods to the guitarist on the ask, listens (idle + tilt), plays the lick (HARD on each note), crouches, jumps
  const lickAge = ageOf(t, LEAD_T);
  const ant = pre(t, T.fill, T.hit), air = hump(t, T.hit, 0.5), land = t - (T.hit + 0.5);
  const bassPose: Pose =
    t < T0 ? 'idle' : t >= T.listen && t < T.lick ? 'idle' : t >= T.hit && t < T.hit + 0.5 ? 'jump' :
    t >= T.lick && t < T.fill ? (lickAge < 0.16 ? 'hard' : 'play') : t >= T.fill ? 'play' : bi % 2 ? 'bob' : 'play';
  const step = easeInOut(clamp((t - T.listen) / 0.5)) * (1 - easeInOut(clamp((t - T.card + 0.3) / 0.3)));
  const bassX = SPOT.bassist.x - 70 * step, bassY = SPOT.bassist.y + 30 * step;
  const bLean = (grooving ? 2.2 * Math.sin(t * Math.PI * 2 / BAR * 2) : 0) + 6 * pre(t, T.ask - 0.1, T.ask + 0.2) * (1 - clamp((t - T.ask - 1.4) / 0.3))
    + (t >= T.listen && t < T.lick ? 7 * easeOut(clamp((t - T.listen) / 0.25)) : 0) - 4 * kick(lickAge, 10) - 9 * ant + 6 * wob(land, 7, 26);
  const bDy = 8 * kick(beatAge, 10) * (grooving ? 1 : 0) + 34 * ant - 380 * air + 3 * Math.sin(t * 2 * Math.PI / 3.6);
  const bSy = 1 - 0.035 * kick(beatAge, 12) * (grooving ? 1 : 0) - 0.12 * ant + 0.08 * air - 0.12 * wob(land, 9, 36), bSx = 1 + 0.8 * (1 - bSy);

  // --- guitarist: idle and nervous; leans to the phone; STRUM HARD + recoil on each miss; then frozen, cold, a sweat drop
  const missing = missAge < 0.45;
  const gPose: Pose = onCard ? 'idle' : missing ? 'hard' : 'idle';
  const toPhone = win(t, T.phone, T.miss1 - 0.1, 0.3, 0.2) + win(t, T.hit + 0.1, T.card + 1, 0.3, 0.2);
  const gLean = 1.2 * Math.sin(t * 2 * Math.PI / 3.2) + 5 * toPhone - 8 * wob(missAge, 8, 24) + (t >= T.freeze && t < T.card ? -1.5 : 0);
  const gDy = 3 * Math.sin(t * 2 * Math.PI / 3.6) + 18 * kick(missAge, 9) - 10 * pre(t, T.miss1 - 0.25, T.miss1) - 10 * pre(t, T.miss2 - 0.25, T.miss2);
  const gSy = 1 - 0.07 * wob(missAge, 10, 34), gSx = 1 + 0.8 * (1 - gSy);
  const gCold = Math.max(cold, t >= T.listen ? 0.75 : 0);
  const gFilter = `saturate(${1 - 0.65 * gCold}) brightness(${1 - 0.3 * gCold}) hue-rotate(${-14 * gCold}deg)`;

  // --- world → screen anchors for overlays
  const bassHead = toScreen(bassX - 40, bassY - 600), gHead = toScreen(SPOT.guitarist.x, SPOT.guitarist.y - 590), gGuitar = toScreen(SPOT.guitarist.x + 130, SPOT.guitarist.y - 280);
  const bassBody = toScreen(bassX - 80, bassY - 330);

  // bar counter
  const barNo = t >= T0 ? Math.min(12, Math.floor((t - T0) / BAR) + 1) : 0, barAge = t >= T0 ? (t - T0) % BAR : 9;
  const misses = (t >= T.miss1 ? 1 : 0) + (t >= T.miss2 ? 1 : 0);

  // notes: red ✕ from the guitar on the misses, green notes from the bass on every lick note, a ring of notes into the bassist's ear while listening
  const flyers: React.ReactNode[] = [];
  MISS_T.forEach((m, k) => { const a = t - m; if (a >= 0 && a < 1.2) [0, 1, 2].forEach((j) => flyers.push(
    <div key={`m${k}${j}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x + (j - 1) * 110 + a * (j - 1) * 120, top: gGuitar.y - a * 320 - j * 30, fontSize: 84, color: '#ff5d5d', opacity: 1 - a / 1.2, WebkitTextStroke: '8px #0b0716' }}>{j === 1 ? '✕' : '♪'}</div>)); });
  LEAD_T.forEach((m, k) => { const a = t - m; if (a >= 0 && a < 1.1) flyers.push(
    <div key={`l${k}`} style={{ ...OUTLINE, position: 'absolute', left: bassBody.x - 60 - a * (k % 2 ? 150 : -60), top: bassBody.y - a * 420, fontSize: 76 + 20 * kick(a, 8), color: '#7cf0a8', opacity: 1 - a / 1.1, WebkitTextStroke: '8px #0b0716' }}>{k % 3 === 2 ? '♫' : '♪'}</div>); });
  if (t >= T.listen && t < T.lick + 0.1) [0, 1, 2, 3].forEach((j) => { const u = clamp((t - T.listen - j * 0.08) / 0.45); if (u > 0 && u < 1) flyers.push(
    <div key={`e${j}`} style={{ ...OUTLINE, position: 'absolute', left: bassHead.x + 300 * (1 - u) * Math.cos(j * 1.7), top: bassHead.y + 40 + 220 * (1 - u) * Math.sin(j * 1.7), fontSize: 64, color: '#8ee8ff', opacity: Math.sin(u * Math.PI), WebkitTextStroke: '7px #0b0716' }}>♪</div>); });

  // the bass neck inset during the lick (by-ear notes light up and fade)
  const neckO = win(t, T.lick - 0.3, T.fill - 0.1, 0.3, 0.3);
  const neckDots = LEAD_POS.map((p, k) => ({ s: p.s, f: p.f, c: '#3fbf7f', o: t >= LEAD_T[k] ? clamp(1 - (t - LEAD_T[k]) / 1.6) * 0.75 + (t - LEAD_T[k] < 0.2 ? 0.25 : 0) : 0 }));

  // hook
  const h1 = win(t, 0.05, T0 + 0.6, 0.12, 0.3), h2 = win(t, 1.45, T0 + 0.6, 0.12, 0.3);
  // card
  const cardU = easeOut(clamp((t - T.card) / 0.35));
  const BOX = [{ s: 5, f: 5 }, { s: 5, f: 8 }, { s: 4, f: 5 }, { s: 4, f: 7 }, { s: 3, f: 5 }, { s: 3, f: 7 }, { s: 2, f: 5 }, { s: 2, f: 7 }, { s: 1, f: 5 }, { s: 1, f: 8 }, { s: 0, f: 5 }, { s: 0, f: 8 }];

  return (
    <AbsoluteFill style={{ background: '#0b0716', overflow: 'hidden' }}>
      <Audio src={staticFile('jam-blues.wav')} />
      {/* the world, through the camera */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${W / 2 + shx}px, ${H / 2 + shy}px) scale(${c.s}) translate(${-c.x}px, ${-c.y}px)`, transformOrigin: '0 0' }}>
        <Room t={t} mood={1 - 0.55 * cold} warm={warm} energy={energy} strobe={strobe} zoom={c.s} />
        <Sprite who="drummer" pose={drumPose} x={SPOT.drummer.x} y={SPOT.drummer.y - dBounce * 0.4} s={SPOT.drummer.s} sy={dSy} sx={1 + 0.8 * (1 - dSy)} lean={1.5 * Math.sin(t * 2.1)} />
        {/* the phone on a music stand in front of the guitarist */}
        <div style={{ position: 'absolute', left: 497, top: 1290, width: 8, height: 330, background: '#3a2a58' }} />
        <div style={{ position: 'absolute', left: 452, top: 1236, width: 96, height: 64, background: '#0b0716', border: '5px solid #3a2a58', borderRadius: 8, boxShadow: `0 0 ${24 + 30 * toPhone}px rgba(142,232,255,${0.35 + 0.4 * toPhone})` }} />
        <Sprite who="guitarist" pose={gPose} x={SPOT.guitarist.x} y={SPOT.guitarist.y + gDy} s={SPOT.guitarist.s} lean={gLean} sx={gSx} sy={gSy} filter={gFilter} />
        <Sprite who="bassist" pose={bassPose} x={bassX} y={bassY + bDy} s={SPOT.bassist.s} flip lean={-bLean} sx={bSx} sy={bSy} />
        {/* the jump's ground shadow + a dust ring on landing */}
        {air > 0 ? <div style={{ position: 'absolute', left: bassX - 120 * (1 - 0.4 * air), top: bassY - 14, width: 240 * (1 - 0.4 * air), height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)' }} /> : null}
        {land >= 0 && land < 0.5 ? <div style={{ position: 'absolute', left: bassX - 60 - 300 * easeOut(land / 0.5), top: bassY - 30, width: 120 + 600 * easeOut(land / 0.5), height: 60, borderRadius: '50%', border: '8px solid #ffd27a', opacity: 1 - land / 0.5 }} /> : null}
        {/* the sweat drop while he is frozen */}
        {t >= T.freeze + 0.2 && t < T.card ? (() => { const u = ((t - T.freeze - 0.2) % 1.4) / 1.4; return <div style={{ position: 'absolute', left: SPOT.guitarist.x + 55, top: SPOT.guitarist.y - 600 + 120 * u * u, fontSize: 64, opacity: 1 - u }}>💧</div>; })() : null}
      </div>

      {flyers}
      {cold > 0 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, transparent 35%, rgba(40,70,140,0.45))', opacity: cold }} /> : null}
      {missAge < 0.35 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 45% 60%, rgba(229,72,77,0.55), transparent 60%)', opacity: 1 - missAge / 0.35 }} /> : null}

      {/* hook */}
      {h1 > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 230, opacity: h1 }}>
        <div style={{ ...OUTLINE, fontSize: 70, color: '#ffd43b', letterSpacing: 4, transform: `scale(${1 + 0.2 * wob(t - 0.05, 9, 26)})` }}>5 years of guitar.</div>
        {h2 > 0 ? <div style={{ ...OUTLINE, fontSize: 104, color: '#fff', marginTop: 20, lineHeight: 1.05, opacity: h2, transform: `scale(${1 + 0.22 * wob(t - 1.45, 9, 26)})` }}>Can’t jam<br />without <span style={{ color: '#ff9ac2' }}>tabs.</span></div> : null}
      </div> : null}

      {/* bar counter */}
      {t >= T0 && t < T.hit + 0.4 && !onCard ? <Chip style={{ right: 50, top: 70, transform: `scale(${1 + 0.15 * kick(barAge, 10)})`, transformOrigin: '100% 0', opacity: win(t, T0, T.hit + 0.4, 0.15, 0.3) }}>BAR {barNo} / 12</Chip> : null}
      {t >= T.miss1 && t < T.listen ? <Chip style={{ left: 50, top: 70, opacity: win(t, T.miss1, T.listen, 0.1, 0.3) }}>WRONG NOTES: <span style={{ color: '#ff6b6b', display: 'inline-block', transform: `scale(${1 + 0.5 * kick(missAge, 8)})` }}>{misses}</span></Chip> : null}

      {/* dialogue + captions */}
      <Bubble x={bassHead.x} y={bassHead.y} t={t} a={T.ask} b={T.ask + 2.2} text={['BLUES IN A.', 'JUST JUMP IN!']} tail="right" />
      <Bubble x={gHead.x - 40} y={gHead.y + 30} t={t} a={T.hit + 0.55} b={T.card} text={['…tab not found']} tail="left" />
      {[
        { a: T.phone + 0.25, b: T.miss1 - 0.1, text: <>There’s no tab<br />for a jam.</>, color: '#8ee8ff' },
        { a: T.freeze + 0.1, b: T.listen, text: <>The band<br />didn’t wait.</>, color: '#ffffff' },
        { a: T.listen + 0.05, b: T.listen + 2.4, text: <>The bassist<br />just <span style={{ color: '#7cf0a8' }}>listened.</span></>, color: '#ffffff' },
      ].map((cap, i) => { const o = win(t, cap.a, cap.b, 0.12, 0.2); return o > 0 ? <div key={i} style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 250, fontSize: 84, lineHeight: 1.08, color: cap.color, opacity: o, transform: `scale(${1 + 0.18 * wob(t - cap.a, 9, 26)})` }}>{cap.text}</div> : null; })}

      <Neck strings={4} dots={neckDots} y={480} o={neckO} />
      {t >= T.lick - 0.2 && t < T.card ? <div style={{ position: 'absolute', left: 70, top: 430, display: 'flex', alignItems: 'center', gap: 18, opacity: win(t, T.lick - 0.2, T.card, 0.2, 0.2) }}>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 34, color: '#fff', letterSpacing: 3 }}>CROWD</div>
        <div style={{ width: 420, height: 26, background: '#0b0716', border: '4px solid #5a3f86' }}><div style={{ width: `${100 * clamp(energy)}%`, height: '100%', background: '#ffd43b' }} /></div>
      </div> : null}

      <Phone t={t} />

      {/* end card */}
      {cardU > 0 ? <AbsoluteFill style={{ background: '#120c2a', transform: `translateY(${(1 - cardU) * H}px)` }}>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 300, fontSize: 112, lineHeight: 1.05, color: '#fff', transform: `scale(${1 + 0.15 * wob(t - T.card - 0.35, 8, 24)})` }}>Play what<br />you <span style={{ color: '#8ee8ff' }}>hear.</span></div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 560, fontSize: 60, color: '#d2cefd', opacity: clamp((t - T.card - 0.9) / 0.2) }}>Not what you read.</div>
        <Neck strings={6} y={700} o={clamp((t - T.card - 0.4) / 0.25)} dots={BOX.map((p, k) => ({ ...p, c: '#3fbf7f', o: clamp((t - T.card - 0.5 - k * 0.07) / 0.12) }))} />
        <Sprite who="guitarist" pose={Math.floor((t - T.card) / BEAT) % 2 ? 'bob' : 'play'} x={540} y={1530 + 6 * kick((t - T.card) % BEAT, 10)} s={2.0} />
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1600, fontSize: 52, color: '#ffd43b', opacity: clamp((t - T.card - 1.2) / 0.2) }}>Train your ear for jams</div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1690, fontSize: 46, color: '#ff9ac2', WebkitTextStroke: '8px #0b0716', opacity: clamp((t - T.card - 1.4) / 0.2) }}>Link in profile · earwarrior.app</div>
      </AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
