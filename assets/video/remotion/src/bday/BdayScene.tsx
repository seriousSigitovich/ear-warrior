// Tab Guy, ep. 2 — "Happy Birthday". The three-piece from the band character sheet (public/band/<who>_<pose>.png) plays a birthday party: the
// band ends a song, the cake rolls in, the bassist asks for Happy Birthday; the guitarist (Tab Guy) looks for a tab (it's behind a sign-up
// wall), plays it wrong twice and freezes while the candles melt; the bassist plays it by ear, the drummer and the room join, the candles go
// out on the high note and she jumps; end card with the first line on real frets. Timeline: ../../bday/story.mjs (also the soundtrack, voices).
//
// Everything is a pure function of `t` (README "Animation principles"): poses swap on the beat, SQUASH/STRETCH anchored at the feet,
// ANTICIPATION crouch before the jump, OVERSHOOT on every pop, a HOLD after the landing, SECONDARY candles, smoke, crowd, lights, notes, shake.
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, easeOut, rng } from '../util';
import { T, BEAT, BEATS, LEAD, LEAD_POS, TRIES, REPLAY, OPEN_FILL, OPEN_SNARES, W_KICKS, CLAPS, DURATION } from '../../bday/story.mjs';
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
const beatIdx = (t: number) => { let k = -1; for (let i = 0; i < BEATS.length; i++) if (t >= BEATS[i]) k = i; return k; };

// --- camera ----------------------------------------------------------------------------------------------------------------------------
type Cam = { t: number; x: number; y: number; s: number };
const CAM: Cam[] = [
  { t: 0, x: 540, y: 1040, s: 1.0 }, { t: T.endHit, x: 540, y: 1060, s: 1.06 },
  { t: T.ask - 0.1, x: 545, y: 1070, s: 1.08 }, { t: T.phone - 0.05, x: 560, y: 1100, s: 1.12 },
  { t: T.phone + 0.35, x: 400, y: 1250, s: 1.75 }, { t: T.try1 - 0.15, x: 410, y: 1250, s: 1.8 },
  { t: T.try1 + 0.1, x: 420, y: 1210, s: 1.42 }, { t: T.freeze - 0.05, x: 430, y: 1200, s: 1.45 },
  { t: T.freeze + 0.4, x: 540, y: 1560, s: 1.75 }, { t: T.listen - 0.2, x: 540, y: 1565, s: 1.9 },           // the candles, melting
  { t: T.listen + 0.3, x: 740, y: 1170, s: 1.5 }, { t: T.join - 0.4, x: 735, y: 1165, s: 1.55 },
  { t: T.join + 0.6, x: 560, y: 1160, s: 1.18 }, { t: T.hit - 0.3, x: 560, y: 1190, s: 1.1 },
  { t: T.hit, x: 560, y: 1200, s: 1.14 }, { t: DURATION, x: 560, y: 1180, s: 1.2 },
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
const HEADS = (() => { const r = rng(21); return Array.from({ length: 13 }, (_, i) => ({ x: -30 + i * 92 + r() * 30, y: 1740 + r() * 60, s: 0.85 + r() * 0.35, ph: r() * 6.28, arm: r() < 0.5, hat: r() < 0.45, hc: ['#ff5fa8', '#b5abfc', '#ffd43b', '#7cf0a8'][Math.floor(r() * 4)] })); })();
const BALLOONS = [{ x: 95, y: 640, c: '#ff5fa8' }, { x: 175, y: 560, c: '#b5abfc' }, { x: 250, y: 660, c: '#ffd43b' }, { x: 860, y: 600, c: '#7cf0a8' }, { x: 940, y: 520, c: '#ff5fa8' }, { x: 1010, y: 640, c: '#b5abfc' }];
const FLAGS = Array.from({ length: 15 }, (_, i) => i);

const Room: React.FC<{ t: number; mood: number; warm: number; energy: number; strobe: number; zoom: number; clapAge: number; sign: number }> = ({ t, mood, warm, energy, strobe, zoom, clapAge, sign }) => {
  const bi = beatIdx(t), onBeat = bi >= 0 ? kick(t - BEATS[bi], 7) : 0;
  const wide = clamp((1.22 - zoom) / 0.12);
  const neon = (0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 2.3) + 0.2 * onBeat) * wide * sign;   // off while the bass neck inset sits over it
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} shapeRendering="crispEdges">
      <defs>
        <linearGradient id="bA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9a8ff" stopOpacity="0.35" /><stop offset="1" stopColor="#c9a8ff" stopOpacity="0" /></linearGradient>
        <linearGradient id="bW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></linearGradient>
        <radialGradient id="bVig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.7" /></radialGradient>
      </defs>
      <rect x={-400} y={-400} width={W + 800} height={1660} fill="#150e26" />
      {BRICKS.map((b, i) => <rect key={i} x={b.x + 2} y={b.y + 2} width={76} height={32} fill={b.c} />)}
      {/* bunting across the wall */}
      <g opacity={0.9}>
        <path d="M -20 520 Q 540 610 1100 520" stroke="#3a2d4c" strokeWidth={5} fill="none" />
        {FLAGS.map((i) => { const x = 20 + i * 72, y = 520 + 90 * (1 - Math.pow((x - 540) / 560, 2)) - 0 + 2 * Math.sin(t * 2 + i), sw = 4 * Math.sin(t * 2.4 + i * 0.7);
          return <polygon key={i} points={`${x - 26},${y} ${x + 26},${y} ${x + sw},${y + 58}`} fill={['#ff5fa8', '#b5abfc', '#ffd43b', '#7cf0a8'][i % 4]} opacity={0.85} />; })}
      </g>
      {/* balloons, bobbing */}
      <g shapeRendering="auto">
        {BALLOONS.map((b, i) => { const dy = 10 * Math.sin(t * 1.3 + i * 1.7), dx = 6 * Math.sin(t * 0.9 + i); return (
          <g key={i} transform={`translate(${b.x + dx} ${b.y + dy})`}>
            <path d={`M 0 70 Q ${12 * Math.sin(t * 2 + i)} 160 0 260`} stroke="#8a7fa8" strokeWidth={3} fill="none" />
            <ellipse cx={0} cy={0} rx={52} ry={66} fill={b.c} opacity={0.85} />
            <ellipse cx={-16} cy={-22} rx={12} ry={18} fill="#fff" opacity={0.35} />
            <polygon points="-8,64 8,64 0,76" fill={b.c} />
          </g>); })}
      </g>
      {/* neon sign over the drummer */}
      <g opacity={neon}>
        <rect x={190} y={700} width={700} height={128} rx={14} fill="none" stroke="#ff5fa8" strokeWidth={8} style={{ filter: 'drop-shadow(0 0 18px #ff5fa8)' }} />
        <text x={540} y={786} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={64} fill="#ffd6ec" style={{ filter: 'drop-shadow(0 0 14px #ff5fa8)' }}>HAPPY BIRTHDAY</text>
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
      {/* light beams + a warm spot on the bassist from the moment she listens */}
      {[180, 540, 900].map((x, i) => { const sway = Math.sin(t * 1.4 + i * 2.1) * 90;
        return <polygon key={i} points={`${x - 30},-40 ${x + 30},-40 ${x + 220 + sway},1640 ${x - 220 + sway},1640`} fill="url(#bA)" opacity={(0.55 + 0.45 * onBeat) * mood} style={{ mixBlendMode: 'screen' }} />; })}
      <polygon points="780,-40 840,-40 1060,1640 600,1640" fill="url(#bW)" opacity={warm} style={{ mixBlendMode: 'screen' }} />
      {strobe > 0 ? <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#fff6e0" opacity={strobe} /> : null}
      {/* the crowd: party hats, bobbing with the room's energy, hands up (clapping) when it's high */}
      {HEADS.map((h, i) => {
        const bob = (energy * 22 + 4) * (bi >= 0 ? kick(t - BEATS[bi] - (i % 3) * 0.03, 8) : 0) + 3 * Math.sin(t * 2 + h.ph);
        const up = energy > 0.55 && h.arm ? clamp((energy - 0.55) / 0.2) : 0, cl = 20 * kick(clapAge, 14);
        return (
          <g key={i} transform={`translate(${h.x} ${h.y - bob}) scale(${h.s})`} shapeRendering="auto">
            {up > 0 ? <><rect x={-52 + cl * 0.6} y={-170 * up} width={18} height={170 * up + 40} rx={9} fill="#07040f" /><rect x={36 - cl * 0.6} y={-170 * up} width={18} height={170 * up + 40} rx={9} fill="#07040f" /></> : null}
            <ellipse cx={0} cy={0} rx={48} ry={56} fill="#07040f" />
            {h.hat ? <><polygon points="-30,-40 30,-40 4,-130" fill={h.hc} opacity={0.75} /><circle cx={4} cy={-134} r={10} fill="#fff" opacity={0.7} /></> : null}
            <rect x={-80} y={40} width={160} height={260} rx={60} fill="#07040f" />
          </g>
        );
      })}
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="url(#bVig)" />
    </svg>
  );
};

// --- the cake on its cart: candles shorten and drip while he searches, flames shiver while he's frozen, go out on the high note ----------
const CANDLES = [-92, -46, 0, 46, 92];
const Cake: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.cake - 0.05) return null;
  const inU = clamp((t - T.cake) / 0.45), x = 540 + 760 * (1 - easeOut(inU)) + 30 * wob(t - T.cake - 0.45, 7, 20);
  const tilt = -4 * wob(t - T.cake - 0.45, 7, 20);
  const melt = clamp((t - T.phone) / (T.lick - T.phone));                 // 0 → 1 while he searches, fails, freezes
  const h = 64 * (1 - 0.62 * easeInOut(melt));
  const out = t >= T.hit - 0.02, outAge = t - T.hit;
  const shiver = t > T.freeze && t < T.lick ? 1 : 0;
  return (
    <svg width={600} height={500} viewBox="-300 -400 600 500" style={{ position: 'absolute', left: x - 300, top: 1790 - 400, overflow: 'visible', transform: `rotate(${tilt}deg)`, transformOrigin: '300px 400px' }}>
      {/* cart */}
      <rect x={-170} y={-60} width={340} height={22} fill="#6b4a2f" stroke="#0b0716" strokeWidth={5} />
      <rect x={-150} y={-38} width={10} height={70} fill="#4a3220" /><rect x={140} y={-38} width={10} height={70} fill="#4a3220" />
      {[-140, 145].map((cx) => <circle key={cx} cx={cx} cy={40} r={16} fill="#22172f" stroke="#0b0716" strokeWidth={4} />)}
      {/* cake: plate, two tiers, cream drips */}
      <ellipse cx={0} cy={-62} rx={160} ry={16} fill="#e8e0f4" stroke="#0b0716" strokeWidth={4} />
      <rect x={-140} y={-150} width={280} height={88} rx={10} fill="#f6b6d4" stroke="#0b0716" strokeWidth={5} />
      <rect x={-140} y={-150} width={280} height={22} rx={8} fill="#fff4fa" />
      {[-110, -60, -10, 40, 90].map((dx, i) => <rect key={i} x={dx} y={-130} width={18} height={14 + (i % 2) * 12} rx={8} fill="#fff4fa" />)}
      <rect x={-100} y={-222} width={200} height={74} rx={10} fill="#b5abfc" stroke="#0b0716" strokeWidth={5} />
      <rect x={-100} y={-222} width={200} height={18} rx={8} fill="#efeaff" />
      {/* candles */}
      {CANDLES.map((cx, i) => {
        const hh = h * (1 - 0.06 * (i % 2)), top = -222 - hh;
        const fl = 1 + 0.12 * Math.sin(t * 23 + i * 2) + 0.2 * shiver * Math.sin(t * 41 + i), sway = 3 * Math.sin(t * 7 + i) + 6 * shiver * Math.sin(t * 13 + i);
        const flameO = out ? clamp(1 - outAge / 0.12) : 1;
        return (
          <g key={i}>
            <rect x={cx - 9} y={top} width={18} height={hh} fill={['#ffd43b', '#7cf0a8', '#ff9ac2', '#8ee8ff', '#ffd43b'][i]} stroke="#0b0716" strokeWidth={4} />
            {melt > 0.15 ? <rect x={cx - 11 + (i % 2) * 14} y={top + 2} width={8} height={14 + 26 * melt} rx={4} fill="#fff8e0" opacity={0.9} /> : null}
            <rect x={cx - 1.5} y={top - 12} width={3} height={12} fill="#2a2030" />
            {flameO > 0 ? <g transform={`translate(${cx + sway * 0.4} ${top - 12}) scale(${fl})`} opacity={flameO}>
              <ellipse cx={0} cy={-20} rx={22} ry={30} fill="#ffb347" opacity={0.25} />
              <path d={`M 0 0 C -12 -10 -9 -26 ${sway * 0.5} -42 C 9 -26 12 -10 0 0 Z`} fill="#ffd43b" stroke="#ff8a3d" strokeWidth={3} />
              <path d="M 0 -4 C -5 -10 -4 -18 0 -24 C 4 -18 5 -10 0 -4 Z" fill="#fff6e0" />
            </g> : null}
            {/* smoke after the candles go out */}
            {out && outAge < 1.8 ? [0, 1, 2].map((j) => { const a = outAge - j * 0.18; if (a < 0) return null; const u = a / 1.6;
              return <circle key={j} cx={cx + 22 * Math.sin(a * 3 + i + j) * u} cy={top - 20 - 260 * u} r={10 + 30 * u} fill="#cfc8dc" opacity={0.45 * (1 - u)} />; }) : null}
          </g>
        );
      })}
      {/* the warm glow on the wall of the cake */}
      {!out ? <ellipse cx={0} cy={-260} rx={190} ry={90} fill="#ffb347" opacity={0.12 + 0.03 * Math.sin(t * 17)} style={{ mixBlendMode: 'screen' }} /> : null}
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

/** His phone: types the search, loads, finds the tab — and a sign-up wall over it. */
const Phone: React.FC<{ t: number }> = ({ t }) => {
  const a = T.phone + 0.2, b = T.try1 - 0.1;
  if (t < a - 0.1 || t > b + 0.3) return null;
  const inU = easeOut(clamp((t - a) / 0.35)), outU = clamp((t - b) / 0.25);
  const y = 1920 - (1060 + 40 * wob(t - a - 0.35, 7, 18)) * inU + 1300 * outU * outU;
  const query = 'happy birthday tab', typed = query.slice(0, Math.floor(clamp((t - a - 0.15) / 0.35) * query.length));
  const searching = t > a + 0.5 && t < a + 0.72, page = t >= a + 0.72, wall = t >= a + 0.95;
  const TAB = ['e|-----------------|', 'B|-----------1-0---|', 'G|-0-0-2-0-------- |', 'D|-----------------|'];
  return (
    <div style={{ position: 'absolute', left: 520, top: y, width: 470, height: 900, background: '#0b0716', borderRadius: 54, padding: 26, boxShadow: '0 0 0 8px #3a2a58, 0 0 80px rgba(142,232,255,0.45)', transform: `rotate(${-6 + 2 * Math.sin(t * 3)}deg)` }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#f4f2fa', borderRadius: 30, padding: '40px 26px', fontFamily: MONO, fontWeight: 700, color: '#1c1730', overflow: 'hidden' }}>
        <div style={{ background: '#e2ddf3', borderRadius: 14, padding: '18px 18px', fontSize: 30 }}>🔍 {typed}<span style={{ opacity: Math.sin(t * 14) > 0 && !page ? 1 : 0 }}>|</span></div>
        {searching ? <div style={{ width: 90, height: 90, margin: '120px auto 0', borderRadius: '50%', border: '12px solid #d8d2ee', borderTopColor: '#8a3a86', transform: `rotate(${t * 720}deg)` }} /> : null}
        {page ? <div style={{ marginTop: 34 }}>
          <div style={{ fontSize: 34, lineHeight: 1.2 }}>Happy Birthday<br />Tab <span style={{ color: '#d79b00' }}>★★★★☆</span></div>
          <div style={{ marginTop: 22, fontSize: 25, lineHeight: 1.45, whiteSpace: 'pre', filter: wall ? 'blur(5px)' : 'none' }}>{TAB.join('\n')}{'\n'}{TAB.join('\n')}</div>
        </div> : null}
        {wall ? <div style={{ position: 'absolute', left: 18, right: 18, top: 330, background: '#fff', borderRadius: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', padding: '30px 24px', textAlign: 'center', transform: `scale(${1 + 0.15 * wob(t - a - 0.95, 9, 26)})` }}>
          <div style={{ fontSize: 76 }}>🔒</div>
          <div style={{ fontSize: 34, lineHeight: 1.3, marginTop: 8 }}>Sign up to see<br />the full tab</div>
          <div style={{ marginTop: 22, background: '#e5484d', color: '#fff', borderRadius: 14, padding: '16px 10px', fontSize: 30 }}>START FREE TRIAL</div>
        </div> : null}
      </div>
    </div>
  );
};

/** A fretboard: `strings` strings, frets 0–12; `dots` light up. */
const Neck: React.FC<{ strings: number; dots: { s: number; f: number; c: string; o: number }[]; y: number; o: number }> = ({ strings, dots, y, o }) => {
  if (o <= 0) return null;
  const x0 = 70, w = 940, h = 46 * (strings - 1), fx = (f: number) => x0 + (f === 0 ? -18 : ((f - 0.5) / 12) * w);
  return (
    <svg width={W} height={h + 80} style={{ position: 'absolute', left: 0, top: y, opacity: o }}>
      <rect x={x0} y={30} width={w} height={h + 20} rx={8} fill="#2a1d14" stroke="#0b0716" strokeWidth={6} />
      {Array.from({ length: 13 }, (_, f) => <rect key={f} x={x0 + (f / 12) * w - 3} y={30} width={f === 0 ? 10 : 6} height={h + 20} fill={f === 0 ? '#e8e0cc' : '#c9b48a'} />)}
      {[3, 5, 7, 9].map((f) => <circle key={f} cx={fx(f)} cy={40 + h / 2} r={8} fill="#5a4636" />)}
      <circle cx={fx(12)} cy={40 + h / 2 - 30} r={8} fill="#5a4636" /><circle cx={fx(12)} cy={40 + h / 2 + 30} r={8} fill="#5a4636" />
      {Array.from({ length: strings }, (_, s) => <rect key={s} x={x0} y={40 + s * 46 - 2} width={w} height={3 + (strings - 1 - s) * 0.8} fill="#b9b2a6" />)}
      {dots.map((d, i) => d.o > 0 ? <circle key={i} cx={fx(d.f)} cy={40 + (strings - 1 - d.s) * 46} r={20 * (0.7 + 0.3 * d.o)} fill={d.c} stroke="#0b0716" strokeWidth={5} opacity={d.o} /> : null)}
    </svg>
  );
};

// --- the film --------------------------------------------------------------------------------------------------------------------------
const LEAD_T = LEAD.map((n) => n.t);
const MISS_T = [T.miss1, T.miss2];
const TRY_T = TRIES.flatMap((tr) => tr.notes.map(([o]) => tr.t + o));
const DRUM_HITS = [...OPEN_SNARES, ...OPEN_FILL, T.endHit, ...W_KICKS, T.hit];

export const BdayParty: React.FC = () => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const bi = beatIdx(t), beatAge = bi >= 0 ? t - BEATS[bi] : Infinity;
  const opening = t < T.endHit, waltz = t >= T.join && t < T.card;
  const grooving = opening || waltz;
  const missAge = ageOf(t, MISS_T), tryAge = ageOf(t, TRY_T), hitAge = t - T.hit, endAge = t - T.endHit, onCard = t >= T.card;
  const clapAge = ageOf(t, CLAPS);

  // the room's mood: the misses kill it, the tune lifts it, the high note blows it up
  const energy = opening ? 0.55 : t < T.ask ? 0.75 - 0.3 * clamp(endAge / 0.5) : t < T.miss1 ? 0.35 : t < T.listen ? 0.08 : t < T.lick ? 0.15 :
    t < T.hit ? 0.3 + 0.5 * clamp((t - T.lick) / 6) : 1;
  const warm = win(t, T.listen + 0.2, T.card, 0.5, 0.3) * 0.9;
  const cold = win(t, T.freeze - 0.3, T.listen + 0.3, 0.4, 0.5);
  const strobe = 0.5 * kick(hitAge, 7) * (hitAge >= 0 ? 1 : 0) + 0.25 * kick(endAge, 9) * (endAge >= 0 ? 1 : 0);

  const c = camAt(t);
  const shake = 22 * kick(missAge, 10) + 34 * kick(hitAge, 8) + 14 * kick(endAge, 10);
  const shx = shake * Math.sin(t * 91), shy = shake * Math.cos(t * 77);
  const toScreen = (wx: number, wy: number) => ({ x: W / 2 + (wx - c.x) * c.s + shx, y: H / 2 + (wy - c.y) * c.s + shy });

  // --- drummer: grooves in the opening, rolls, hits; waits with sticks down; a soft waltz from the second line; hits the high note
  const drumHitAge = ageOf(t, DRUM_HITS);
  const drumPose: Pose = t >= OPEN_FILL[0] && t < T.endHit ? 'fill' : drumHitAge < 0.13 ? 'hard' : grooving ? (bi % 2 ? 'bob' : 'play') : t >= T.hit ? 'bob' : 'idle';
  const dBounce = (grooving ? 10 * kick(beatAge, 9) : 0) + 14 * kick(hitAge, 7) + 3 * Math.sin(t * 1.7);
  const dSy = 1 - (grooving ? 0.03 * kick(beatAge, 12) : 0) - 0.05 * kick(hitAge, 9);

  // --- bassist: grooves in the opening, turns to the guitarist on the ask, listens (idle + tilt), plays the tune (HARD on each note),
  //     crouches before the high note, jumps on it, lands with a dust ring
  const lickAge = ageOf(t, LEAD_T);
  const ant = pre(t, T.hit - 0.45, T.hit), air = hump(t, T.hit, 0.5), land = t - (T.hit + 0.5);
  const bassPose: Pose =
    opening ? (bi % 2 ? 'bob' : 'play') : t >= T.hit && t < T.hit + 0.5 ? 'jump' : t >= T.lick && t < T.card ? (lickAge < 0.16 ? 'hard' : 'play') : 'idle';
  const step = easeInOut(clamp((t - T.listen) / 0.5)) * (1 - easeInOut(clamp((t - T.card + 0.3) / 0.3)));
  const bassX = SPOT.bassist.x - 70 * step, bassY = SPOT.bassist.y + 30 * step;
  const bLean = (opening ? 2.2 * Math.sin(t * Math.PI * 2) : 0) + 6 * pre(t, T.ask - 0.1, T.ask + 0.2) * (1 - clamp((t - T.ask - 1.9) / 0.3))
    + (t >= T.listen && t < T.lick ? 7 * easeOut(clamp((t - T.listen) / 0.25)) : 0) - 4 * kick(lickAge, 10) - 9 * ant + 6 * wob(land, 7, 26)
    + (waltz ? 2.5 * Math.sin((t - T.lick - 0.5) * Math.PI * 2 / 1.5) : 0);
  const bDy = (grooving ? 8 * kick(beatAge, 10) : 0) + 34 * ant - 380 * air + 3 * Math.sin(t * 2 * Math.PI / 3.6);
  const bSy = 1 - (grooving ? 0.035 * kick(beatAge, 12) : 0) - 0.12 * ant + 0.08 * air - 0.12 * wob(land, 9, 36), bSx = 1 + 0.8 * (1 - bSy);

  // --- guitarist: plays in the opening; leans to the phone; plays each try (HARD + recoil on the sour note); frozen, cold, a sweat drop
  const gPose: Pose = opening ? (bi % 2 ? 'bob' : 'play') : onCard ? 'idle' : tryAge < 0.2 || missAge < 0.45 ? 'hard' : 'idle';
  const toPhone = win(t, T.phone, T.try1 - 0.1, 0.3, 0.2) + win(t, T.hit + 0.1, T.card + 1, 0.3, 0.2);
  const gLean = 1.2 * Math.sin(t * 2 * Math.PI / 3.2) + 5 * toPhone - 8 * wob(missAge, 8, 24) + (t >= T.freeze && t < T.card ? -1.5 : 0) + (opening ? 2 * Math.sin(t * Math.PI * 2) : 0);
  const gDy = 3 * Math.sin(t * 2 * Math.PI / 3.6) + 18 * kick(missAge, 9) + (opening ? 7 * kick(beatAge, 10) : 0) - 10 * pre(t, T.miss1 - 0.25, T.miss1) - 10 * pre(t, T.miss2 - 0.25, T.miss2);
  const gSy = 1 - 0.07 * wob(missAge, 10, 34), gSx = 1 + 0.8 * (1 - gSy);
  const gCold = Math.max(cold, t >= T.listen ? 0.75 : 0);
  const gFilter = `saturate(${1 - 0.65 * gCold}) brightness(${1 - 0.3 * gCold}) hue-rotate(${-14 * gCold}deg)`;

  const bassHead = toScreen(bassX - 40, bassY - 600), gHead = toScreen(SPOT.guitarist.x, SPOT.guitarist.y - 590), gGuitar = toScreen(SPOT.guitarist.x + 130, SPOT.guitarist.y - 280);
  const bassBody = toScreen(bassX - 80, bassY - 330);

  const misses = (t >= T.miss1 ? 1 : 0) + (t >= T.miss2 ? 1 : 0);
  const candleLeft = 1 - 0.62 * easeInOut(clamp((t - T.phone) / (T.lick - T.phone)));

  // flying notes: white on the right notes of the tries, red ✕ on the sour ones, green from the bass, a ring into her head while she listens
  const flyers: React.ReactNode[] = [];
  TRIES.forEach((tr, k) => tr.notes.forEach(([o], j) => { const a = t - tr.t - o; if (j < 2 && a >= 0 && a < 0.8) flyers.push(
    <div key={`t${k}${j}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x - 30 + j * 70, top: gGuitar.y - a * 260, fontSize: 60, color: '#fff', opacity: 1 - a / 0.8, WebkitTextStroke: '7px #0b0716' }}>♪</div>); }));
  MISS_T.forEach((m, k) => { const a = t - m; if (a >= 0 && a < 1.2) [0, 1, 2].forEach((j) => flyers.push(
    <div key={`m${k}${j}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x + (j - 1) * 110 + a * (j - 1) * 120, top: gGuitar.y - a * 320 - j * 30, fontSize: 84, color: '#ff5d5d', opacity: 1 - a / 1.2, WebkitTextStroke: '8px #0b0716' }}>{j === 1 ? '✕' : '♪'}</div>)); });
  LEAD_T.forEach((m, k) => { const a = t - m; if (a >= 0 && a < 1.1) flyers.push(
    <div key={`l${k}`} style={{ ...OUTLINE, position: 'absolute', left: bassBody.x - 60 - a * (k % 2 ? 150 : -60), top: bassBody.y - a * 420, fontSize: 76 + 20 * kick(a, 8), color: '#7cf0a8', opacity: 1 - a / 1.1, WebkitTextStroke: '8px #0b0716' }}>{k % 3 === 2 ? '♫' : '♪'}</div>); });
  if (t >= T.listen && t < T.lick + 0.1) [0, 1, 2, 3].forEach((j) => { const u = clamp((t - T.listen - j * 0.08) / 0.45); if (u > 0 && u < 1) flyers.push(
    <div key={`e${j}`} style={{ ...OUTLINE, position: 'absolute', left: bassHead.x + 300 * (1 - u) * Math.cos(j * 1.7), top: bassHead.y + 40 + 220 * (1 - u) * Math.sin(j * 1.7), fontSize: 64, color: '#8ee8ff', opacity: Math.sin(u * Math.PI), WebkitTextStroke: '7px #0b0716' }}>♪</div>); });

  const neckO = win(t, T.lick - 0.3, T.hit + 1.6, 0.3, 0.3);
  const neckDots = LEAD_POS.map((p, k) => ({ s: p.s, f: p.f, c: '#3fbf7f', o: t >= LEAD_T[k] ? clamp(1 - (t - LEAD_T[k]) / 1.6) * 0.75 + (t - LEAD_T[k] < 0.2 ? 0.25 : 0) : 0 }));

  const h1 = win(t, 0.05, T.endHit + 0.4, 0.12, 0.3), h2 = win(t, 1.3, T.endHit + 0.4, 0.12, 0.3);
  const cardU = easeOut(clamp((t - T.card) / 0.35));

  return (
    <AbsoluteFill style={{ background: '#0b0716', overflow: 'hidden' }}>
      <Audio src={staticFile('bday.wav')} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${W / 2 + shx}px, ${H / 2 + shy}px) scale(${c.s}) translate(${-c.x}px, ${-c.y}px)`, transformOrigin: '0 0' }}>
        <Room t={t} mood={1 - 0.55 * cold} warm={warm} energy={energy} strobe={strobe} zoom={c.s} clapAge={clapAge} sign={1 - neckO} />
        <Sprite who="drummer" pose={drumPose} x={SPOT.drummer.x} y={SPOT.drummer.y - dBounce * 0.4} s={SPOT.drummer.s} sy={dSy} sx={1 + 0.8 * (1 - dSy)} lean={1.5 * Math.sin(t * 2.1)} />
        <div style={{ position: 'absolute', left: 497, top: 1290, width: 8, height: 330, background: '#3a2a58' }} />
        <div style={{ position: 'absolute', left: 452, top: 1236, width: 96, height: 64, background: '#0b0716', border: '5px solid #3a2a58', borderRadius: 8, boxShadow: `0 0 ${24 + 30 * toPhone}px rgba(142,232,255,${0.35 + 0.4 * toPhone})` }} />
        <Sprite who="guitarist" pose={gPose} x={SPOT.guitarist.x} y={SPOT.guitarist.y + gDy} s={SPOT.guitarist.s} lean={gLean} sx={gSx} sy={gSy} filter={gFilter} />
        <Sprite who="bassist" pose={bassPose} x={bassX} y={bassY + bDy} s={SPOT.bassist.s} flip lean={-bLean} sx={bSx} sy={bSy} />
        {air > 0 ? <div style={{ position: 'absolute', left: bassX - 120 * (1 - 0.4 * air), top: bassY - 14, width: 240 * (1 - 0.4 * air), height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)' }} /> : null}
        {land >= 0 && land < 0.5 ? <div style={{ position: 'absolute', left: bassX - 60 - 300 * easeOut(land / 0.5), top: bassY - 30, width: 120 + 600 * easeOut(land / 0.5), height: 60, borderRadius: '50%', border: '8px solid #ffd27a', opacity: 1 - land / 0.5 }} /> : null}
        {t >= T.freeze + 0.2 && t < T.card ? (() => { const u = ((t - T.freeze - 0.2) % 1.4) / 1.4; return <div style={{ position: 'absolute', left: SPOT.guitarist.x + 55, top: SPOT.guitarist.y - 600 + 120 * u * u, fontSize: 64, opacity: 1 - u }}>💧</div>; })() : null}
        <Cake t={t} />
      </div>

      {flyers}
      {cold > 0 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, transparent 35%, rgba(40,70,140,0.45))', opacity: cold }} /> : null}
      {missAge < 0.35 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 45% 60%, rgba(229,72,77,0.55), transparent 60%)', opacity: 1 - missAge / 0.35 }} /> : null}

      {/* hook, over a dark band so the balloons and the bunting don't eat it */}
      {h1 > 0 ? <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(11,7,22,0.88) 0%, rgba(11,7,22,0.7) 24%, rgba(11,7,22,0) 36%)', opacity: h1 }} /> : null}
      {h1 > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 230, opacity: h1 }}>
        <div style={{ ...OUTLINE, fontSize: 70, color: '#ffd43b', letterSpacing: 4, transform: `scale(${1 + 0.2 * wob(t - 0.05, 9, 26)})` }}>10 years of guitar.</div>
        {h2 > 0 ? <div style={{ ...OUTLINE, fontSize: 96, color: '#fff', marginTop: 20, lineHeight: 1.05, opacity: h2, transform: `scale(${1 + 0.22 * wob(t - 1.3, 9, 26)})` }}>Can’t play<br /><span style={{ color: '#ff9ac2' }}>Happy Birthday.</span></div> : null}
      </div> : null}

      {/* chips: the candles burning down; the wrong notes */}
      {t >= T.ask && t < T.hit + 0.3 ? <Chip style={{ right: 50, top: 70, display: 'flex', alignItems: 'center', gap: 14, opacity: win(t, T.ask, T.hit + 0.3, 0.15, 0.3) }}>
        🕯<div style={{ width: 220, height: 24, background: '#0b0716', border: '4px solid #5a3f86' }}><div style={{ width: `${100 * candleLeft}%`, height: '100%', background: candleLeft < 0.55 ? '#ff8a3d' : '#ffd43b' }} /></div>
      </Chip> : null}
      {t >= T.miss1 && t < T.listen ? <Chip style={{ left: 50, top: 70, opacity: win(t, T.miss1, T.listen, 0.1, 0.3) }}>WRONG NOTES: <span style={{ color: '#ff6b6b', display: 'inline-block', transform: `scale(${1 + 0.5 * kick(missAge, 8)})` }}>{misses}</span></Chip> : null}

      {/* dialogue + captions */}
      <Bubble x={bassHead.x} y={bassHead.y} t={t} a={T.ask} b={T.ask + 2.0} text={['CAKE’S HERE!', 'PLAY HAPPY BIRTHDAY!']} tail="right" />
      <Bubble x={gHead.x - 40} y={gHead.y + 30} t={t} a={T.hit + 0.55} b={T.card} text={['…tab loading']} tail="left" />
      {[
        { a: T.phone + 0.55, b: T.try1 - 0.1, text: <>He needed<br />a tab.</>, color: '#8ee8ff' },
        { a: T.freeze + 0.1, b: T.listen, text: <>The candles<br />didn’t wait.</>, color: '#ffffff' },
        { a: T.listen + 0.05, b: T.listen + 2.0, text: <>She didn’t<br /><span style={{ color: '#7cf0a8' }}>need one.</span></>, color: '#ffffff' },
      ].map((cap, i) => { const o = win(t, cap.a, cap.b, 0.12, 0.2); return o > 0 ? <div key={i} style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 250, fontSize: 84, lineHeight: 1.08, color: cap.color, opacity: o, transform: `scale(${1 + 0.18 * wob(t - cap.a, 9, 26)})` }}>{cap.text}</div> : null; })}

      <Neck strings={4} dots={neckDots} y={480} o={neckO} />
      {t >= T.lick - 0.2 && t < T.card ? <div style={{ position: 'absolute', left: 70, top: 430, display: 'flex', alignItems: 'center', gap: 18, opacity: win(t, T.lick - 0.2, T.card, 0.2, 0.2) }}>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 34, color: '#fff', letterSpacing: 3 }}>PARTY</div>
        <div style={{ width: 420, height: 26, background: '#0b0716', border: '4px solid #5a3f86' }}><div style={{ width: `${100 * clamp(energy)}%`, height: '100%', background: '#ffd43b' }} /></div>
      </div> : null}

      <Phone t={t} />

      {/* end card: the first line on real frets, played once more */}
      {cardU > 0 ? <AbsoluteFill style={{ background: '#120c2a', transform: `translateY(${(1 - cardU) * H}px)` }}>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 260, fontSize: 112, lineHeight: 1.05, color: '#fff', transform: `scale(${1 + 0.15 * wob(t - T.card - 0.35, 8, 24)})` }}>Play what<br />you <span style={{ color: '#8ee8ff' }}>hear.</span></div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 520, fontSize: 60, color: '#d2cefd', opacity: clamp((t - T.card - 0.6) / 0.2) }}>Not what you read.</div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 660, fontSize: 50, color: '#ffd43b', opacity: clamp((t - T.replay + 0.3) / 0.2) }}>Your turn · first line</div>
        <Neck strings={6} y={740} o={clamp((t - T.card - 0.4) / 0.25)} dots={REPLAY.map((n) => ({ s: n.s, f: n.f, c: '#3fbf7f', o: t >= n.t ? 0.55 + 0.45 * kick(t - n.t, 5) : 0 }))} />
        <Sprite who="guitarist" pose={Math.floor((t - T.card) / BEAT) % 2 ? 'bob' : 'play'} x={540} y={1560 + 6 * kick((t - T.card) % BEAT, 10)} s={2.0} />
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1630, fontSize: 52, color: '#ffd43b', opacity: clamp((t - T.card - 2.6) / 0.2) }}>Train your ear</div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1720, fontSize: 46, color: '#ff9ac2', WebkitTextStroke: '8px #0b0716', opacity: clamp((t - T.card - 2.8) / 0.2) }}>Link in profile · earwarrior.app</div>
      </AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
