// Tab Guy, ep. 3 — "He trained his ear": pain → the app → payoff. The three-piece from public/band/ at a party: the bassist plays the opening
// of Beethoven's Fifth, "Your turn!"; Tab Guy answers wrong and freezes. That night: a REAL screen recording of Ear Warrior's first melody
// (public/learn-app.mp4, cut by learn/cut-app.mjs, step marks in learn/app.mjs) inside his phone. DAY 1 → DAY 14. The same party again: he
// answers by ear on the first try, the room cheers, both jump. End card + link. Timeline: ../../learn/story.mjs.
//
// Motion follows README "Animation principles": anticipation before the jumps, squash/stretch at the feet, overshoot pops, holds, secondary
// notes/lights/shake, idle breathing; everything a pure function of `t`.
import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, easeOut, rng } from '../util';
import { T, CALL, CALL2, TRY, ANSWER, APP_LEN, DURATION, FPS } from '../../learn/story.mjs';
import APP from '../../learn/app.mjs';
import SPRITES from '../../jam/sprites.json';

const W = 1080, H = 1920;
const MONO = 'Menlo, "SF Mono", "Courier New", monospace';
const OUTLINE: React.CSSProperties = { fontFamily: MONO, fontWeight: 800, WebkitTextStroke: '10px #0b0716', paintOrder: 'stroke fill', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' };

const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
const pre = (t: number, a: number, b: number) => (t < a || t >= b ? 0 : easeInOut((t - a) / (b - a)));
const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };
const win = (t: number, a: number, b: number, fi = 0.18, fo = 0.18) => clamp((t - a) / fi) * clamp((b - t) / fo);

// --- the band (same sprites and spots as ep. 2) ----------------------------------------------------------------------------------------
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

// --- the party room (ep. 2's room without the birthday props) ----------------------------------------------------------------------------
const BRICKS = (() => { const r = rng(7), out: { x: number; y: number; c: string }[] = []; for (let y = 0; y < 1260; y += 36) for (let x = (y / 36) % 2 ? -40 : 0; x < W; x += 80) out.push({ x, y, c: ['#1d1430', '#21173a', '#1a1229', '#24193f'][Math.floor(r() * 4)] }); return out; })();
const HEADS = (() => { const r = rng(21); return Array.from({ length: 13 }, (_, i) => ({ x: -30 + i * 92 + r() * 30, y: 1740 + r() * 60, s: 0.85 + r() * 0.35, ph: r() * 6.28, arm: r() < 0.55 })); })();
const NOTE_T = [...CALL, ...CALL2, ...ANSWER].map((n) => n.t);

const Room: React.FC<{ t: number; mood: number; energy: number; strobe: number; warm: number }> = ({ t, mood, energy, strobe, warm }) => {
  const pulse = kick(ageOf(t, NOTE_T), 7);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} shapeRendering="crispEdges">
      <defs>
        <linearGradient id="lA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9a8ff" stopOpacity="0.35" /><stop offset="1" stopColor="#c9a8ff" stopOpacity="0" /></linearGradient>
        <linearGradient id="lW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></linearGradient>
        <radialGradient id="lVig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.7" /></radialGradient>
      </defs>
      <rect x={-400} y={-400} width={W + 800} height={1660} fill="#150e26" />
      {BRICKS.map((b, i) => <rect key={i} x={b.x + 2} y={b.y + 2} width={76} height={32} fill={b.c} />)}
      <g opacity={0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 2.3)}>
        <rect x={290} y={700} width={500} height={128} rx={14} fill="none" stroke="#8ee8ff" strokeWidth={8} style={{ filter: 'drop-shadow(0 0 18px #8ee8ff)' }} />
        <text x={540} y={786} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={64} fill="#e6fbff" style={{ filter: 'drop-shadow(0 0 14px #8ee8ff)' }}>OPEN JAM</text>
      </g>
      <rect x={40} y={1180} width={190} height={170} fill="#1b1424" stroke="#3a2d4c" strokeWidth={6} /><rect x={58} y={1200} width={154} height={22} fill="#b8913a" />
      <rect x={850} y={1110} width={210} height={250} fill="#1b1424" stroke="#3a2d4c" strokeWidth={6} />
      {[0, 1].map((k) => <circle key={k} cx={955} cy={1180 + k * 110} r={44 + 3 * pulse} fill="#0b0716" stroke="#2c2238" strokeWidth={6} />)}
      <rect x={-400} y={1340} width={W + 800} height={300} fill="#2a1d3c" />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={-400 + i * 120} y={1340} width={4} height={300} fill="#22172f" />)}
      <rect x={330} y={1250} width={420} height={90} fill="#30223f" stroke="#43305a" strokeWidth={6} />
      <rect x={-400} y={1636} width={W + 800} height={14} fill="#4a3270" />
      {[180, 540, 900].map((x, i) => { const sway = Math.sin(t * 1.4 + i * 2.1) * 90;
        return <polygon key={i} points={`${x - 30},-40 ${x + 30},-40 ${x + 220 + sway},1640 ${x - 220 + sway},1640`} fill="url(#lA)" opacity={(0.55 + 0.45 * pulse) * mood} style={{ mixBlendMode: 'screen' }} />; })}
      <polygon points="260,-40 320,-40 520,1640 60,1640" fill="url(#lW)" opacity={warm} style={{ mixBlendMode: 'screen' }} />
      {strobe > 0 ? <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#fff6e0" opacity={strobe} /> : null}
      {HEADS.map((h, i) => {
        const bob = (energy * 24 + 4) * pulse + 3 * Math.sin(t * 2 + h.ph), up = energy > 0.6 && h.arm ? clamp((energy - 0.6) / 0.2) : 0;
        return (
          <g key={i} transform={`translate(${h.x} ${h.y - bob}) scale(${h.s})`} shapeRendering="auto">
            {up > 0 ? <><rect x={-52} y={-170 * up} width={18} height={170 * up + 40} rx={9} fill="#07040f" /><rect x={36} y={-170 * up} width={18} height={170 * up + 40} rx={9} fill="#07040f" /></> : null}
            <ellipse cx={0} cy={0} rx={48} ry={56} fill="#07040f" />
            <rect x={-80} y={40} width={160} height={260} rx={60} fill="#07040f" />
          </g>
        );
      })}
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="url(#lVig)" />
    </svg>
  );
};

// --- that night: his room, a window with the moon, a desk lamp; he holds the guitar, the phone fills the frame -------------------------
const Night: React.FC<{ t: number }> = ({ t }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }} shapeRendering="crispEdges">
    <defs><radialGradient id="lamp" cx="0.82" cy="0.78" r="0.5"><stop offset="0" stopColor="#ffcf7a" stopOpacity="0.35" /><stop offset="1" stopColor="#ffcf7a" stopOpacity="0" /></radialGradient></defs>
    <rect width={W} height={H} fill="#0e0a1c" />
    {Array.from({ length: 24 }, (_, i) => <rect key={i} x={0} y={i * 80} width={W} height={2} fill="#140f26" />)}
    <rect x={70} y={180} width={300} height={380} fill="#1a2547" stroke="#2c2340" strokeWidth={14} />
    <rect x={213} y={180} width={14} height={380} fill="#2c2340" /><rect x={70} y={363} width={300} height={14} fill="#2c2340" />
    <circle cx={150} cy={260} r={38} fill="#f4ecc8" opacity={0.9} shapeRendering="auto" />
    {[[290, 230], [320, 470], [120, 480], [260, 300]].map(([x, y], i) => <rect key={i} x={x} y={y} width={6} height={6} fill="#fff" opacity={0.4 + 0.5 * Math.abs(Math.sin(t * 2 + i))} />)}
    <rect x={0} y={1640} width={W} height={280} fill="#1a1328" />
    <rect x={760} y={1400} width={320} height={26} fill="#3b2a1e" /><rect x={880} y={1250} width={16} height={150} fill="#5a4636" />
    <polygon points="840,1250 940,1250 960,1190 820,1190" fill="#e0b25a" />
    <rect width={W} height={H} fill="url(#lamp)" />
  </svg>
);

/** The phone with the real recording; `x,y` = centre, `s` = scale (1 → 600 px wide). */
const PHONE_W = 600, PHONE_H = 1304;
const Phone: React.FC<{ x: number; y: number; s: number; rot?: number; from: number; playing: boolean; glow?: number }> = ({ x, y, s, rot = 0, from, playing, glow = 0.45 }) => (
  <div style={{ position: 'absolute', left: x - PHONE_W / 2, top: y - PHONE_H / 2, width: PHONE_W, height: PHONE_H, transform: `rotate(${rot}deg) scale(${s})`, transformOrigin: '50% 50%',
    background: '#0b0716', borderRadius: 78, padding: 16, boxShadow: `0 0 0 8px #3a2a58, 0 0 120px rgba(142,232,255,${glow})` }}>
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 64, overflow: 'hidden', background: '#000' }}>
      {playing ? <Sequence from={Math.round(from * FPS)} layout="none"><OffthreadVideo src={staticFile('learn-app.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Sequence>
        : <Img src={staticFile('learn-app-end.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </div>
  </div>
);

const Bubble: React.FC<{ x: number; y: number; text: string[]; t: number; a: number; b: number; tail: 'left' | 'right' }> = ({ x, y, text, t, a, b, tail }) => {
  const o = win(t, a, b, 0.12, 0.15), pop = 1 + 0.18 * wob(t - a, 9, 26);
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tail === 'right' ? '-100%' : '0'}, -100%) scale(${pop})`, transformOrigin: tail === 'right' ? '100% 100%' : '0 100%', opacity: o }}>
      <div style={{ background: '#fff', color: '#1c1730', fontFamily: MONO, fontWeight: 800, fontSize: 50, lineHeight: 1.2, padding: '18px 26px', borderRadius: 10, boxShadow: '0 0 0 6px #0b0716', whiteSpace: 'nowrap' }}>
        {text.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={{ position: 'absolute', bottom: -22, [tail === 'right' ? 'right' : 'left']: 40, width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '24px solid #fff' }} />
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; style: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', fontFamily: MONO, fontWeight: 800, fontSize: 40, color: '#fff', background: 'rgba(11,7,22,0.82)', border: '4px solid #5a3f86', borderRadius: 10, padding: '12px 20px', letterSpacing: 2, ...style }}>{children}</div>
);

// --- camera on the party (two takes: before and after) -------------------------------------------------------------------------------
type Cam = { t: number; x: number; y: number; s: number };
const CAM: Cam[] = [
  { t: 0, x: 540, y: 1060, s: 1.04 }, { t: T.call - 0.1, x: 545, y: 1070, s: 1.08 },
  { t: T.call + 0.4, x: 720, y: 1180, s: 1.45 }, { t: T.ask + 0.3, x: 720, y: 1185, s: 1.5 },
  { t: T.try - 0.05, x: 420, y: 1230, s: 1.55 }, { t: T.freeze + 0.2, x: 400, y: 1250, s: 1.75 }, { t: T.night, x: 395, y: 1255, s: 1.95 },
  { t: T.back, x: 560, y: 1100, s: 1.12 }, { t: T.call2 + 0.3, x: 600, y: 1130, s: 1.25 },
  { t: T.answer - 0.1, x: 430, y: 1200, s: 1.5 }, { t: T.cheer - 0.05, x: 440, y: 1190, s: 1.58 },
  { t: T.cheer + 0.4, x: 550, y: 1120, s: 1.1 }, { t: DURATION, x: 550, y: 1110, s: 1.14 },
];
function camAt(t: number) {
  let i = 0;
  while (i < CAM.length - 2 && t >= CAM[i + 1].t) i++;
  const a = CAM[i], b = CAM[i + 1], u = easeInOut(clamp((t - a.t) / (b.t - a.t)));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, s: a.s + (b.s - a.s) * u };
}

const STEPS = APP.steps as { at: number; label: string; color: string }[];
const DAY_TUNES = ['Ode to Joy', 'Jingle Bells', 'Amazing Grace', 'Drunken Sailor', 'Habanera'];

export const LearnEar: React.FC = () => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const night = t >= T.night && t < T.back;
  const second = t >= T.back;
  const missAge = t - T.miss, cheerAge = t - T.cheer;

  // party energy: chatter → listening → the miss kills it; second take: it builds with his answer and blows up on the last note
  const energy = !second ? (t < T.call ? 0.45 : t < T.miss ? 0.3 : 0.06) : t < T.answer ? 0.3 : t < T.cheer ? 0.35 + 0.35 * clamp((t - T.answer) / 2) : 1;
  const cold = !second ? win(t, T.miss + 0.1, T.night + 1, 0.4, 0.3) : 0;
  const warm = second ? win(t, T.answer - 0.1, DURATION + 1, 0.4, 0.3) * 0.9 : 0;
  const strobe = cheerAge >= 0 ? 0.5 * kick(cheerAge, 7) : 0;

  const c = camAt(t);
  const shake = (missAge >= 0 && !second ? 22 * kick(missAge, 10) : 0) + (cheerAge >= 0 ? 30 * kick(cheerAge, 8) : 0);
  const shx = shake * Math.sin(t * 91), shy = shake * Math.cos(t * 77);
  const toScreen = (wx: number, wy: number) => ({ x: W / 2 + (wx - c.x) * c.s + shx, y: H / 2 + (wy - c.y) * c.s + shy });

  // bassist: plays the call (HARD on each note), turns to him on "Your turn!"; second take the same, then jumps on the cheer
  const callT = [...CALL, ...CALL2].map((n) => n.t), callAge = ageOf(t, callT);
  const playingCall = (t >= T.call && t < T.ask) || (t >= T.call2 && t < T.answer);
  const ant = pre(t, T.cheer - 0.4, T.cheer), air = hump(t, T.cheer, 0.5), land = t - (T.cheer + 0.5);
  const bassPose: Pose = air > 0 ? 'jump' : playingCall ? (callAge < 0.14 ? 'hard' : 'play') : t >= T.cheer + 0.5 ? 'bob' : 'idle';
  const bLean = 6 * win(t, T.ask - 0.1, T.ask + 1.0, 0.15, 0.25) - 4 * kick(callAge, 10) - 9 * ant + 6 * wob(land, 7, 26) + 2 * Math.sin(t * 2.2);
  const bDy = 34 * ant - 360 * air + 3 * Math.sin(t * 2 * Math.PI / 3.6);
  const bSy = 1 - 0.12 * ant + 0.08 * air - 0.12 * wob(land, 9, 36), bSx = 1 + 0.8 * (1 - bSy);

  // guitarist: idle; first take = three notes and a sour one, recoil, frozen (cold, sweat); second take = HARD on every note, jumps on the cheer
  const tryAge = ageOf(t, TRY.map((n) => n.t)), ansAge = ageOf(t, ANSWER.map((n) => n.t));
  const gAnt = pre(t, T.cheer - 0.35, T.cheer + 0.05), gAir = hump(t, T.cheer + 0.05, 0.5), gLand = t - (T.cheer + 0.55);
  const gPose: Pose = gAir > 0 ? 'jump' : !second ? (tryAge < 0.18 || (missAge >= 0 && missAge < 0.45) ? 'hard' : 'idle')
    : t >= T.answer && t < T.cheer ? (ansAge < 0.16 ? 'hard' : 'play') : t >= T.cheer + 0.55 ? 'bob' : 'idle';
  const gLean = 1.2 * Math.sin(t * 2 * Math.PI / 3.2) - (!second ? 8 * wob(missAge, 8, 24) : 0) - 3 * kick(ansAge, 10) - 8 * gAnt + 6 * wob(gLand, 7, 26);
  const gDy = 3 * Math.sin(t * 2 * Math.PI / 3.6) + (!second ? 18 * kick(missAge, 9) : 0) + 30 * gAnt - 380 * gAir;
  const gSy = 1 - (!second ? 0.07 * wob(missAge, 10, 34) : 0) - 0.1 * gAnt + 0.08 * gAir - 0.1 * wob(gLand, 9, 36), gSx = 1 + 0.8 * (1 - gSy);
  const gFilter = `saturate(${1 - 0.65 * cold}) brightness(${1 - 0.3 * cold}) hue-rotate(${-14 * cold}deg)`;

  const bassBody = toScreen(SPOT.bassist.x - 80, SPOT.bassist.y - 330), bassHead = toScreen(SPOT.bassist.x - 40, SPOT.bassist.y - 600);
  const gGuitar = toScreen(SPOT.guitarist.x + 130, SPOT.guitarist.y - 280);

  const flyers: React.ReactNode[] = [];
  if (!night) {
    [...CALL, ...CALL2].forEach((n, k) => { const a = t - n.t; if (a >= 0 && a < 1.0) flyers.push(
      <div key={`c${k}`} style={{ ...OUTLINE, position: 'absolute', left: bassBody.x - 60 - a * (k % 2 ? 150 : -60), top: bassBody.y - a * 420, fontSize: 72, color: '#8ee8ff', opacity: 1 - a, WebkitTextStroke: '8px #0b0716' }}>♪</div>); });
    TRY.forEach((n, k) => { const a = t - n.t, bad = k === 3; if (a >= 0 && a < (bad ? 1.2 : 0.8)) flyers.push(
      <div key={`t${k}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x - 30 + k * 60, top: gGuitar.y - a * 300, fontSize: bad ? 96 : 60, color: bad ? '#ff5d5d' : '#fff', opacity: 1 - a / (bad ? 1.2 : 0.8), WebkitTextStroke: '8px #0b0716' }}>{bad ? '✕' : '♪'}</div>); });
    ANSWER.forEach((n, k) => { const a = t - n.t; if (a >= 0 && a < 1.1) flyers.push(
      <div key={`a${k}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x - 60 + a * (k % 2 ? 160 : -40), top: gGuitar.y - a * 440, fontSize: 80 + 20 * kick(a, 8), color: '#7cf0a8', opacity: 1 - a / 1.1, WebkitTextStroke: '8px #0b0716' }}>{k % 3 === 2 ? '♫' : '♪'}</div>); });
  }
  const right = ANSWER.filter((n) => t >= n.t).length;

  // night: phone rises in, the recording plays; steps light up; then DAY 1 → 14 over a shrinking phone
  const nightIn = easeOut(clamp((t - T.night - 0.05) / 0.45));
  const daysU = clamp((t - T.days) / 1.3), day = 1 + Math.floor(13 * easeInOut(daysU));
  const phoneY = 1075 + (1 - nightIn) * 1300 + 18 * wob(t - T.night - 0.5, 6, 14);
  const phoneS = 1.25 - 0.45 * easeInOut(clamp((t - T.days) / 0.4));
  const appT = t - T.app;
  const stepIdx = STEPS.reduce((k, s, i) => (appT >= s.at ? i : k), -1);

  const wipe = (a: number) => { const u = (t - a + 0.25) / 0.5; return u <= 0 || u >= 1 ? null : <AbsoluteFill style={{ background: '#0b0716', clipPath: `inset(0 ${100 - 100 * clamp(u * 2)}% 0 ${100 * clamp(u * 2 - 1)}%)` }} />; };

  const cardU = easeOut(clamp((t - T.card) / 0.35));

  return (
    <AbsoluteFill style={{ background: '#0b0716', overflow: 'hidden' }}>
      <Audio src={staticFile('learn.wav')} />
      {!night ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${W / 2 + shx}px, ${H / 2 + shy}px) scale(${c.s}) translate(${-c.x}px, ${-c.y}px)`, transformOrigin: '0 0' }}>
          <Room t={t} mood={1 - 0.55 * cold} energy={energy} strobe={strobe} warm={warm} />
          <Sprite who="drummer" pose={cheerAge >= 0 && cheerAge < 0.15 ? 'hard' : cheerAge >= 0 ? (Math.floor(t / 0.25) % 2 ? 'bob' : 'play') : 'idle'} x={SPOT.drummer.x} y={SPOT.drummer.y} s={SPOT.drummer.s} lean={1.5 * Math.sin(t * 2.1)} />
          <Sprite who="guitarist" pose={gPose} x={SPOT.guitarist.x} y={SPOT.guitarist.y + gDy} s={SPOT.guitarist.s} lean={gLean} sx={gSx} sy={gSy} filter={gFilter} />
          <Sprite who="bassist" pose={bassPose} x={SPOT.bassist.x} y={SPOT.bassist.y + bDy} s={SPOT.bassist.s} flip lean={-bLean} sx={bSx} sy={bSy} />
          {t >= T.freeze && t < T.night ? (() => { const u = ((t - T.freeze) % 1.2) / 1.2; return <div style={{ position: 'absolute', left: SPOT.guitarist.x + 55, top: SPOT.guitarist.y - 600 + 120 * u * u, fontSize: 64, opacity: 1 - u }}>💧</div>; })() : null}
        </div>
      ) : (
        <>
          <Night t={t} />
          <Sprite who="guitarist" pose="idle" x={250} y={1900 + 4 * Math.sin(t * 2)} s={2.2} lean={-3} />
          <Phone x={540} y={phoneY} s={phoneS} rot={-2 + 1.2 * Math.sin(t * 1.3)} from={T.app} playing={t < T.days + 0.1} />
        </>
      )}

      {flyers}
      {cold > 0 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, transparent 35%, rgba(40,70,140,0.45))', opacity: cold }} /> : null}
      {!second && missAge >= 0 && missAge < 0.35 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 40% 60%, rgba(229,72,77,0.55), transparent 60%)', opacity: 1 - missAge / 0.35 }} /> : null}

      {/* hook */}
      {t < T.call + 0.3 ? <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(11,7,22,0.88) 0%, rgba(11,7,22,0.7) 24%, rgba(11,7,22,0) 36%)', opacity: win(t, 0, T.call + 0.3, 0.05, 0.3) }} /> : null}
      {t < T.call + 0.3 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 230, opacity: win(t, 0, T.call + 0.3, 0.05, 0.3) }}>
        <div style={{ ...OUTLINE, fontSize: 84, color: '#ffd43b', transform: `scale(${1 + 0.2 * wob(t - T.hook, 9, 26)})` }}>10 years of tabs.</div>
        {t >= T.hook2 ? <div style={{ ...OUTLINE, fontSize: 116, color: '#ff9ac2', marginTop: 24, transform: `scale(${1 + 0.24 * wob(t - T.hook2, 9, 26)})` }}>Zero by ear.</div> : null}
      </div> : null}

      <Bubble x={bassHead.x} y={bassHead.y} t={t} a={T.ask} b={T.ask + 1.2} text={['YOUR TURN!']} tail="right" />
      {!second && t >= T.miss && t < T.night ? <Chip style={{ left: 50, top: 70, opacity: win(t, T.miss, T.night, 0.1, 0.2) }}>BY EAR: <span style={{ color: '#ff6b6b' }}>✕</span></Chip> : null}
      {[{ a: T.freeze + 0.05, b: T.night - 0.1, text: <>No tab.<br /><span style={{ color: '#ff9ac2' }}>No chance.</span></> }].map((cap, i) => { const o = win(t, cap.a, cap.b, 0.12, 0.2); return o > 0 ? <div key={i} style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 250, fontSize: 96, lineHeight: 1.08, color: '#fff', opacity: o, transform: `scale(${1 + 0.18 * wob(t - cap.a, 9, 26)})` }}>{cap.text}</div> : null; })}

      {/* night captions: what the app does, one step at a time */}
      {night && t < T.days ? <div style={{ position: 'absolute', left: 0, right: 0, top: 70 }}>
        {appT < 0 ? <div style={{ ...OUTLINE, fontSize: 76, color: "#d2cefd", opacity: win(t, T.night + 0.05, T.app, 0.12, 0.1) }}>That night…</div> : null}
        {stepIdx >= 0 && appT >= 0 ? <div key={stepIdx} style={{ ...OUTLINE, fontSize: 76, color: STEPS[stepIdx].color, transform: `scale(${1 + 0.2 * wob(appT - STEPS[stepIdx].at, 9, 26)})` }}>{STEPS[stepIdx].label}</div> : null}
      </div> : null}
      {night && t >= T.days ? <div style={{ position: 'absolute', left: 0, right: 0, top: 90 }}>
        <div style={{ ...OUTLINE, fontSize: 130, color: '#ffd43b', transform: `scale(${1 + 0.06 * kick((t - T.days) % 0.1, 20)})` }}>Day {day}</div>
        <div style={{ ...OUTLINE, fontSize: 48, color: '#7cf0a8', marginTop: 10 }}>{DAY_TUNES[Math.min(DAY_TUNES.length - 1, Math.floor(daysU * DAY_TUNES.length))]} ✓</div>
      </div> : null}

      {/* second take: the score of his answer */}
      {second && t >= T.answer && t < T.card ? <Chip style={{ left: 50, top: 70, opacity: win(t, T.answer, T.card, 0.1, 0.2) }}>BY EAR: <span style={{ color: '#7cf0a8', display: 'inline-block', transform: `scale(${1 + 0.4 * kick(ansAge, 8)})` }}>{right}/8 ✓</span></Chip> : null}
      {second && t >= T.back && t < T.call2 + 1.6 ? <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 250, fontSize: 70, color: '#d2cefd', opacity: win(t, T.back + 0.1, T.call2 + 1.6, 0.15, 0.25) }}>Two weeks later.</div> : null}

      {wipe(T.night)}
      {wipe(T.back)}

      {/* end card */}
      {cardU > 0 ? <AbsoluteFill style={{ background: '#120c2a', transform: `translateY(${(1 - cardU) * H}px)` }}>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 170, fontSize: 104, lineHeight: 1.05, color: '#fff', transform: `scale(${1 + 0.15 * wob(t - T.card - 0.35, 8, 24)})` }}>Hear it.<br /><span style={{ color: '#7cf0a8' }}>Play it back.</span></div>
        <Phone x={540} y={1060} s={0.55} rot={-3 + Math.sin(t * 1.5)} from={0} playing={false} glow={0.6} />
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1500, fontSize: 64, color: '#ffd43b', opacity: clamp((t - T.card - 0.8) / 0.2) }}>Ear Warrior</div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1600, fontSize: 44, color: '#ff9ac2', WebkitTextStroke: '8px #0b0716', opacity: clamp((t - T.card - 1.0) / 0.2) }}>Free beta · link in profile</div>
      </AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
