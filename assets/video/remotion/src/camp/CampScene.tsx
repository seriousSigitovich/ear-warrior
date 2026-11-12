// Tab Guy — "No signal". Drawn like a 2D cartoon (thick ink outline on every character, round white heads, a lit night backdrop with parallax,
// hard cuts every 1–2 s, one caption word at a time) around a REAL screen recording of Ear Warrior (public/camp/app-take{A,B}.mp4) with motion
// layered on top: tap ripples and note chips, a shake and red flash on the miss, confetti on "Correct", a week of days.
// Timeline: ../../camp/story.mjs (also the soundtrack and the voices). Everything is a pure function of `t`.
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, easeOut, rng } from '../util';
import { Person, type Mood } from '../pain/Person';
import { T, DURATION, APP, TAPS, HEARD, MOMENTS, SOUR, PLAY, PLAY_END, LINES } from '../../camp/story.mjs';
import META from '../../camp/voice-meta.json';

const W = 1080, H = 1920;
const INK = '#120d1c';
const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
const PURPLE = '#8f83dc';
const TG = { x: 340, y: 1170, s: 1.45 }, FR = { x: 790, y: 1170, s: 1.45 };   // Tab Guy (left, his guitar neck points off-screen) and the friend

const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
const win = (t: number, a: number, b: number, fi = 0.12, fo = 0.12) => clamp((t - a) / fi) * clamp((b - t) / fo);
const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };
/** 0 → overshoot → 1: a pop-in. */
const pop = (age: number) => (age < 0 ? 0 : 1 - Math.exp(-age * 14) * Math.cos(age * 20));

/** How long each line is spoken: the measured length once the voices exist, a guess before. */
const lineLen = (i: number) => (META as number[])[i] ?? Math.max(0.6, LINES[i].say.length * 0.075);
const speaking = (t: number, who: string) => LINES.some((l, i) => l.who === who && t >= l.at && t < l.at + lineLen(i));

// --- camera ----------------------------------------------------------------------------------------------------------------------------
type Shot = { a: number; b: number; x: number; y: number; s0: number; s1: number };
const SHOTS: Shot[] = [
  { a: 0, b: T.noSignal - 0.05, x: 560, y: 1040, s0: 1.0, s1: 1.07 },
  { a: T.noSignal - 0.05, b: T.songs, x: TG.x + 40, y: 900, s0: 1.8, s1: 1.95 },
  { a: T.songs, b: 4.5, x: TG.x + 40, y: 1000, s0: 1.45, s1: 1.55 },
  { a: 4.5, b: 5.25, x: 560, y: 1040, s0: 1.12, s1: 1.22 },
  { a: 5.25, b: 6.0, x: FR.x, y: 900, s0: 1.9, s1: 2.05 },
  { a: T.camp2, b: 18.8, x: 560, y: 1040, s0: 1.0, s1: 1.06 },
  { a: 18.8, b: T.play, x: TG.x + 30, y: 900, s0: 2.0, s1: 2.1 },
  { a: T.play, b: 21.2, x: TG.x + 60, y: 1090, s0: 1.45, s1: 1.58 },
  { a: 21.2, b: PLAY_END + 0.05, x: 540, y: 1000, s0: 1.1, s1: 1.25 },
  { a: PLAY_END + 0.05, b: DURATION + 1, x: 540, y: 1000, s0: 1.2, s1: 1.3 },
];
function cam(t: number) {
  const sh = SHOTS.find((s) => t >= s.a && t < s.b) ?? SHOTS[SHOTS.length - 1];
  const u = easeInOut(clamp((t - sh.a) / (sh.b - sh.a)));
  const hit = Math.max(wob(ageOf(t, SOUR.map((c) => c.t)), 9, 40), 0) * 14;
  return { x: sh.x + Math.sin(t * 1.7) * 3 + hit, y: sh.y + Math.cos(t * 2.3) * 3, s: sh.s0 + (sh.s1 - sh.s0) * u };
}

// --- the camp backdrop -----------------------------------------------------------------------------------------------------------------
const FIRE = { x: 560, y: 1370 };
const Stars: React.FC<{ t: number }> = ({ t }) => {
  const r = rng(77);
  return <g>{Array.from({ length: 70 }, (_, i) => { const x = r() * W, y = r() * 760, tw = 0.5 + 0.5 * Math.sin(t * (1 + r() * 2) + i); return <circle key={i} cx={x} cy={y} r={1.4 + r() * 2.2} fill="#fff7d6" opacity={0.35 + 0.55 * tw} />; })}</g>;
};
function pines(seed: number, base: number, hMin: number, hMax: number, step: number, fill: string) {
  const r = rng(seed);
  const out: React.ReactNode[] = [];
  for (let x = -60, i = 0; x < W + 80; x += step * (0.7 + r() * 0.6), i++) {
    const h = hMin + r() * (hMax - hMin), w = h * 0.34;
    const tiers = [0, 1, 2].map((k) => { const yy = base - h * (0.18 + k * 0.28), ww = w * (1 - k * 0.28); return `M ${x - ww} ${yy + h * 0.3} L ${x} ${yy - h * 0.3} L ${x + ww} ${yy + h * 0.3} Z`; });
    out.push(<g key={i}><rect x={x - 7} y={base - 20} width={14} height={40} fill={fill} />{tiers.map((d, k) => <path key={k} d={d} fill={fill} />)}</g>);
  }
  return out;
}
const FAR = pines(5, 1000, 260, 420, 70, '#0f1736'), MID = pines(9, 1075, 330, 520, 110, '#0a1028');

const Backdrop: React.FC<{ t: number; cx: number; cy: number; s: number }> = ({ t, cx, cy, s }) => {
  // the backdrop moves at half the camera's speed: parallax
  const ps = 1 + (s - 1) * 0.5, px = 540 + (cx - 540) * 0.5, py = 960 + (cy - 960) * 0.5;
  const flick = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 6.3);
  return (
    <g transform={`translate(540 960) scale(${ps}) translate(${-px} ${-py})`}>
      <rect x={-300} y={-300} width={W + 600} height={1400} fill="url(#sky)" />
      <Stars t={t} />
      <circle cx={880} cy={250} r={150} fill="#ffe9b0" opacity={0.12} /><circle cx={880} cy={250} r={72} fill="#fff4cf" />
      <circle cx={858} cy={236} r={11} fill="#e8d9a8" opacity={0.7} /><circle cx={900} cy={272} r={8} fill="#e8d9a8" opacity={0.7} />
      {FAR}
      <rect x={-300} y={1000} width={W + 600} height={1200} fill="url(#ground)" />
      {MID}
      <ellipse cx={FIRE.x} cy={FIRE.y + 40} rx={620 * flick} ry={260 * flick} fill="url(#glowG)" />
    </g>
  );
};

const Flames: React.FC<{ t: number }> = ({ t }) => {
  const f = (k: number, ph: number) => 1 + 0.12 * Math.sin(t * (12 + k * 3) + ph) + 0.06 * Math.sin(t * 25 + ph * 2);
  const flame = (sx: number, sy: number, fill: string, k: number) => (
    <path d="M 0 0 C -70 -40 -62 -140 4 -230 C 64 -140 72 -40 0 0 Z" fill={fill} transform={`scale(${sx * f(k, k)} ${sy * f(k, k * 2)}) skewX(${Math.sin(t * 9 + k) * 4})`} />
  );
  return (
    <g transform={`translate(${FIRE.x} ${FIRE.y + 40})`}>
      <ellipse cx={0} cy={6} rx={170} ry={36} fill="#2a1a14" />
      <g stroke={INK} strokeWidth={9} strokeLinejoin="round">{flame(1.2, 1.25, '#ff5a1f', 1)}</g>
      {flame(0.85, 0.95, '#ff9d2e', 2)}{flame(0.5, 0.62, '#ffe08a', 3)}
      <g stroke={INK} strokeWidth={8}><rect x={-150} y={-6} width={300} height={44} rx={22} fill="#6b4a33" transform="rotate(-6)" /><rect x={-140} y={-6} width={290} height={40} rx={20} fill="#7c5638" transform="rotate(7)" /></g>
    </g>
  );
};
const Sparks: React.FC<{ t: number }> = ({ t }) => {
  const r = rng(31);
  return <g>{Array.from({ length: 34 }, (_, i) => {
    const life = 1.4 + r() * 1.4, ph = r() * life, age = (t + ph) % life, x0 = FIRE.x + (r() - 0.5) * 140;
    return <circle key={i} cx={x0 + Math.sin(age * 3 + i) * 34} cy={FIRE.y - 60 - age * 240} r={3 + r() * 3} fill={i % 3 ? '#ffb347' : '#fff1a8'} opacity={clamp(1 - age / life)} />;
  })}</g>;
};

// --- characters --------------------------------------------------------------------------------------------------------------------------
const Ink: React.FC<{ children: React.ReactNode }> = ({ children }) => <g filter="url(#ink)">{children}</g>;
const Log: React.FC<{ x: number; y: number; w?: number }> = ({ x, y, w = 470 }) => (
  <g stroke={INK} strokeWidth={9}>
    <rect x={x - w / 2} y={y} width={w} height={118} rx={50} fill="#6b4a33" />
    <rect x={x - w / 2 + 14} y={y + 12} width={w - 28} height={26} rx={13} fill="#8a6244" stroke="none" opacity={0.7} />
    <ellipse cx={x + w / 2 - 34} cy={y + 59} rx={30} ry={46} fill="#c79a6b" /><ellipse cx={x + w / 2 - 34} cy={y + 59} rx={14} ry={24} fill="none" stroke="#8a6244" strokeWidth={5} />
  </g>
);
const Glasses: React.FC = () => (
  <g transform="translate(0 -262)" fill="none" stroke={INK} strokeWidth={7}>
    <circle cx={-27} cy={0} r={26} fill="rgba(255,255,255,0.16)" /><circle cx={27} cy={0} r={26} fill="rgba(255,255,255,0.16)" />
    <path d="M -2 -2 Q 0 -8 2 -2" /><path d="M -53 -3 L -66 -9" /><path d="M 53 -3 L 66 -9" />
  </g>
);

const SKIN = '#fff9f2';
const TabGuy: React.FC<{ t: number }> = ({ t }) => {
  let mood: Mood = 'grin';
  if (t >= T.noSignal) mood = 'worry';
  if (t >= T.songs) mood = 'tense';
  if (t >= T.sour1 + 0.08) mood = 'cringe';
  if (t >= T.gone) mood = 'sad';
  if (t >= T.camp2) mood = 'neutral';
  if (t >= 18.75) mood = 'focus';
  if (t >= PLAY_END) mood = 'grin';
  const plays = t >= T.play && t < PLAY_END + 0.4;
  const strum = (() => {
    const times = [...SOUR.map((c) => c.t), ...PLAY.map((n) => n.t)];
    const age = ageOf(t, times);
    return age < 0.2 ? age / 0.2 : 0;
  })();
  const fret = PLAY.filter((n) => n.t <= t).at(-1)?.fret ?? 0;
  const phone = t >= T.noSignal && t < T.sour1;
  const sour = (t >= T.sour1 && t < T.gone + 0.3);
  const g = phone
    ? { showGuitar: true as const, left: [-150, -110] as [number, number], leftHold: 'phone' as const, right: [100, 50] as [number, number] }
    : { guitar: { u: plays ? 0.28 + fret * 0.06 : 0.5, strum, jitter: sour ? 5 : 0, glow: plays ? 0.5 : 0 } };
  return <Person x={TG.x} y={TG.y} scale={TG.s} t={t} seed={3} skin={SKIN} shirt="#3b4a7a" hair="beanie" hairColor="#3a2a22" accent="#e8445a"
    mood={mood} talk={0} bob={Math.sin(t * 2.2) * 3} lean={Math.sin(t * 1.3) * 1.2} look={t < T.noSignal ? [-0.8, 0] : phone ? [-0.2, 0.7] : [-0.5, 0]} {...g} extras={<Glasses />} />;
};
const Friend: React.FC<{ t: number }> = ({ t }) => {
  let mood: Mood = 'happy';
  if (t >= 0.05) mood = 'grin';
  if (t >= 2.4) mood = 'happy';
  if (t >= T.sour1 + 0.1) mood = 'neutral';
  if (t >= T.sour2 + 0.15) mood = 'worry';
  if (t >= T.camp2) mood = 'happy';
  if (t >= T.play - 0.1) mood = 'love';
  if (t >= PLAY_END) mood = 'grin';
  const talk = speaking(t, 'friend') ? 0.45 + 0.4 * Math.sin(t * 22) : t >= T.play && t < PLAY_END ? 0.2 + 0.15 * Math.sin(t * 9) : 0;
  const clapAge = t >= PLAY_END + 0.3 ? (t - PLAY_END - 0.3) % 0.32 : 9;
  const clap = clapAge < 0.12 ? 1 : 0;
  return <Person x={FR.x} y={FR.y} scale={FR.s} t={t} seed={8} skin={SKIN} shirt="#c9783a" hair="long" hairColor="#4a2f22"
    mood={mood} talk={talk} bob={Math.sin(t * 2.6 + 1) * 3 + (t >= T.play && t < PLAY_END ? Math.sin(t * 5) * 5 : 0)} lean={t >= T.play && t < PLAY_END ? Math.sin(t * 2.6) * 5 : Math.sin(t * 1.1) * 1}
    look={[0.6, 0]} left={clap ? [20, -90] : undefined} right={clap ? [60, -90] : undefined} />;
};
const FloatingNotes: React.FC<{ t: number }> = ({ t }) => (
  <g>{PLAY.filter((n) => t >= n.t && t < n.t + 1.4).map((n, i) => {
    const age = t - n.t;
    return <text key={n.t} x={TG.x + 20 + Math.sin(age * 4 + i) * 40 + (i % 3) * 18} y={1150 - age * 230} fontFamily={FONT} fontWeight={900} fontSize={58} fill={i % 2 ? '#fff' : PURPLE} stroke={INK} strokeWidth={6} paintOrder="stroke" opacity={clamp(1 - age / 1.4)} transform={`rotate(${Math.sin(i) * 14} ${TG.x} 1120)`}>{i % 2 ? '♪' : '♫'}</text>;
  })}</g>
);

const CampWorld: React.FC<{ t: number }> = ({ t }) => {
  const c = cam(t);
  const flick = 0.5 + 0.5 * Math.sin(t * 15) * Math.sin(t * 5.1);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0d2c" /><stop offset="0.55" stopColor="#1d2a5e" /><stop offset="1" stopColor="#5a3b63" /></linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14213a" /><stop offset="1" stopColor="#0a0f1e" /></linearGradient>
        <radialGradient id="glowG"><stop offset="0" stopColor="#ff9d2e" stopOpacity="0.75" /><stop offset="0.5" stopColor="#ff6a1f" stopOpacity="0.28" /><stop offset="1" stopColor="#ff6a1f" stopOpacity="0" /></radialGradient>
        <radialGradient id="glowA"><stop offset="0" stopColor="#ffb25a" stopOpacity="0.9" /><stop offset="1" stopColor="#ffb25a" stopOpacity="0" /></radialGradient>
        <filter id="ink" x="-8%" y="-8%" width="116%" height="116%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d" />
          <feFlood floodColor={INK} /><feComposite in2="d" operator="in" result="o" />
          <feMerge><feMergeNode in="o" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <Backdrop t={t} cx={c.x} cy={c.y} s={c.s} />
      <g transform={`translate(540 960) scale(${c.s}) translate(${-c.x} ${-c.y})`}>
        <Flames t={t} />
        <Ink><Friend t={t} /></Ink><Ink><TabGuy t={t} /></Ink>
        <Log x={TG.x} y={TG.y + 64} w={520} /><Log x={FR.x} y={FR.y + 64} w={520} />
        <Sparks t={t} /><FloatingNotes t={t} />
        {/* warm light from the fire on both faces */}
        <ellipse cx={FIRE.x} cy={1180} rx={760} ry={600} fill="url(#glowA)" opacity={0.2 + 0.06 * flick} style={{ mixBlendMode: 'soft-light' }} />
      </g>
      <rect width={W} height={H} fill="url(#vig)" />
      <defs><radialGradient id="vig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.55" /></radialGradient></defs>
    </svg>
  );
};

// --- the phone with no signal (cutaway) -----------------------------------------------------------------------------------------------
const NoSignalPhone: React.FC<{ t: number }> = ({ t }) => {
  const a = T.songs, b = T.sour1 - 0.1;
  if (t < a || t >= b) return null;
  const age = t - a, sc = (0.6 + 0.4 * easeOut(age / 0.22)) * (1 + 0.02 * Math.sin(t * 5)), out = clamp((b - t) / 0.15);
  return (
    <AbsoluteFill style={{ background: `rgba(6,4,16,${0.55 * out})`, alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div style={{ transform: `scale(${sc}) rotate(${-5 + Math.sin(t * 2) * 1.2}deg)`, width: 560, height: 1020, borderRadius: 84, background: '#1c1a28', border: `14px solid ${INK}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#f3efe9' }}>
          <div style={{ height: 120, background: '#2e3a52', color: '#fff', fontFamily: FONT, fontSize: 34, display: 'flex', alignItems: 'flex-end', padding: '0 0 22px 36px' }}>tabsite.com</div>
          {[0, 1, 2, 3].map((i) => <div key={i} style={{ margin: '34px 36px 0', height: 38, borderRadius: 19, background: '#d9d3ca', width: i % 2 ? '60%' : '82%' }} />)}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 470, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width={150} height={150} viewBox="-50 -50 100 100" style={{ transform: `rotate(${t * 380}deg)` }}><circle r={34} fill="none" stroke="#d9d3ca" strokeWidth={11} /><path d="M 0 -34 A 34 34 0 0 1 34 0" fill="none" stroke="#2e3a52" strokeWidth={11} strokeLinecap="round" /></svg>
            <div style={{ marginTop: 40, fontFamily: FONT, fontSize: 52, color: '#c0392b', textAlign: 'center', lineHeight: 1.1 }}>No connection</div>
            <svg width={120} height={96} viewBox="0 0 120 96" style={{ marginTop: 26 }}><g fill="none" stroke="#c0392b" strokeWidth={9} strokeLinecap="round"><path d="M 12 38 Q 60 -4 108 38" /><path d="M 32 58 Q 60 36 88 58" /><path d="M 10 10 L 110 90" /></g><circle cx={60} cy={78} r={7} fill="#c0392b" /></svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// --- the room + the app ------------------------------------------------------------------------------------------------------------------
const Room: React.FC<{ t: number }> = ({ t }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f4b57" /><stop offset="1" stopColor="#13303b" /></linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a352b" /><stop offset="1" stopColor="#24170f" /></linearGradient>
      <radialGradient id="lamp"><stop offset="0" stopColor="#ffd9a0" stopOpacity="0.8" /><stop offset="1" stopColor="#ffd9a0" stopOpacity="0" /></radialGradient>
    </defs>
    <g style={{ filter: 'blur(5px)' }}>
      <rect width={W} height={1330} fill="url(#wall)" />
      <path d={`M 0 1330 L ${W} 1330 L ${W} ${H} L 0 ${H} Z`} fill="url(#floor)" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M ${540 + (i - 4) * 40} 1330 L ${540 + (i - 4) * 190} ${H}`} stroke="#2e2019" strokeWidth={4} />)}
      <rect x={90} y={250} width={300} height={420} rx={14} fill="#0b1535" stroke="#0a0c18" strokeWidth={14} /><path d="M 240 250 V 670 M 90 460 H 390" stroke="#0a0c18" strokeWidth={10} />
      <circle cx={320} cy={340} r={30} fill="#fff4cf" />
      {[0, 1, 2].map((i) => <rect key={i} x={760} y={300 + i * 170} width={250} height={14} fill="#0f2229" />)}
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={778 + i * 38} y={218 + (i % 3) * 8 + 0} width={26} height={80 - (i % 3) * 8} fill={['#c9783a', '#8f83dc', '#e8445a', '#5aa9a0', '#e0b060', '#6f7fd0'][i]} />)}
      <ellipse cx={850} cy={680} rx={380} ry={360} fill="url(#lamp)" opacity={0.5 + 0.04 * Math.sin(t * 3)} />
      <rect x={0} y={1330} width={W} height={10} fill="#120d1c" opacity={0.6} />
    </g>
    <rect width={W} height={H} fill="#000" opacity={0.28} />
  </svg>
);

const PW = 640, SRC_H = Math.round((PW * 1748) / 804), CROP = Math.round(SRC_H * 0.11), PH = SRC_H - CROP;
const scr = (p: [number, number]) => ({ x: (p[0] * PW) / 402, y: (p[1] * PW) / 402 - CROP });
const CONFETTI = (() => { const r = rng(99); return Array.from({ length: 46 }, () => ({ a: r() * Math.PI * 2, v: 260 + r() * 520, s: 10 + r() * 14, c: ['#8f83dc', '#ffd75e', '#ff7a8a', '#7be0c3', '#fff'][Math.floor(r() * 5)], rot: r() * 360 })); })();

const AppPhone: React.FC<{ t: number }> = ({ t }) => {
  const a = T.trained, b = T.camp2;
  if (t < a || t >= b) return null;
  const inK = pop(t - a), bump = (t >= T.find && t < MOMENTS.correct) ? easeInOut(clamp((t - T.find) / 0.5)) : 0;
  const shake = wob(t - MOMENTS.miss, 7, 55) * 16;
  const zoom = 1 + 0.07 * bump - 0.07 * easeInOut(clamp((t - MOMENTS.correct) / 0.5)) * (t >= MOMENTS.correct ? 1 : 0);
  const heard = ageOf(t, HEARD.map((n) => n.t));
  const glow = (heard < 0.25 ? 1 - heard / 0.25 : 0) * (t < T.find ? 1 : 0);
  const missFlash = clamp(1 - (t - MOMENTS.miss) / 0.5) * (t >= MOMENTS.miss ? 1 : 0);
  const okAge = t - MOMENTS.correct;
  return (
    <div style={{ position: 'absolute', left: (W - PW) / 2 - 14, top: 100, transform: `translate(${shake}px, ${Math.sin(t * 1.6) * 4}px) scale(${Math.max(0.2, inK) * zoom}) rotate(${Math.sin(t * 0.9) * 0.8}deg)`, transformOrigin: '50% 60%' }}>
      <div style={{ width: PW + 28, height: PH + 28, borderRadius: 84, background: INK, padding: 14, boxShadow: `0 0 ${40 + glow * 70}px ${glow * 18}px rgba(143,131,220,${0.25 + glow * 0.5}), 0 30px 70px rgba(0,0,0,0.55)`, boxSizing: 'border-box' }}>
        <div style={{ position: 'relative', width: PW, height: PH, borderRadius: 66, overflow: 'hidden', background: '#171826' }}>
          {APP.map((s) => (
            <Sequence key={s.id} from={Math.round(s.at * 30)} durationInFrames={Math.max(1, Math.round(s.dur * 30))} layout="none">
              <div style={{ position: 'absolute', left: 0, top: -CROP, width: PW, height: SRC_H }}>
                <OffthreadVideo src={staticFile(`camp/app-take${s.clip}.mp4`)} startFrom={Math.round(s.from * 30)} playbackRate={s.rate} muted style={{ width: PW, height: SRC_H }} />
              </div>
            </Sequence>
          ))}
          {/* the island + miss flash */}
          <div style={{ position: 'absolute', left: PW / 2 - 78, top: 12, width: 156, height: 42, borderRadius: 21, background: '#000' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 66, boxShadow: `inset 0 0 90px 24px rgba(255,70,90,${missFlash * 0.75})` }} />
          {/* taps: a ripple and a note chip per tap */}
          {TAPS.map((n, i) => {
            const age = t - n.t;
            if (age < 0 || age > 0.8) return null;
            const p = scr(n.pt as [number, number]);
            return (
              <React.Fragment key={i}>
                <div style={{ position: 'absolute', left: p.x - 60 - age * 70, top: p.y - 60 - age * 70, width: 120 + age * 140, height: 120 + age * 140, borderRadius: '50%', border: `${6 - age * 5}px solid #fff`, opacity: clamp(1 - age / 0.5), boxShadow: `0 0 24px ${PURPLE}` }} />
                <div style={{ position: 'absolute', left: p.x - 46, top: p.y - 120 - age * 150, width: 92, height: 54, borderRadius: 27, background: PURPLE, border: `5px solid ${INK}`, color: INK, fontFamily: FONT, fontSize: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.6 + 0.5 * easeOut(age / 0.15)})`, opacity: clamp(1 - (age - 0.3) / 0.5) }}>{n.name}</div>
              </React.Fragment>
            );
          })}
          {/* "Correct": confetti from the result card */}
          {okAge >= 0 && okAge < 1.4 && CONFETTI.map((c, i) => {
            const x = PW / 2 + Math.cos(c.a) * c.v * okAge * 0.7, y = 300 + Math.sin(c.a) * c.v * okAge * 0.5 + 420 * okAge * okAge;
            return <div key={i} style={{ position: 'absolute', left: x, top: y, width: c.s, height: c.s * 0.55, background: c.c, border: `2px solid ${INK}`, transform: `rotate(${c.rot + okAge * 540}deg)`, opacity: clamp(1.4 - okAge) }} />;
          })}
          <HomeFx t={t} />
        </div>
      </div>
    </div>
  );
};

/** On the Home screen after: "+30 XP" flies off the rank card; seven days tick on a sheet that slides up. */
const HomeFx: React.FC<{ t: number }> = ({ t }) => {
  const a = T.later;
  if (t < a) return null;
  const age = t - a, sheet = easeOut(clamp((age - 0.05) / 0.3));
  return (
    <>
      <div style={{ position: 'absolute', left: 392, top: 640 - easeOut(age / 0.7) * 90, fontFamily: FONT, fontSize: 64, color: '#fff', WebkitTextStroke: `10px ${INK}`, paintOrder: 'stroke fill', opacity: clamp(1 - (age - 0.7) / 0.4) * clamp(age / 0.05), transform: `scale(${pop(age)})` }}>+30 XP</div>
      <div style={{ position: 'absolute', left: 30, right: 30, bottom: 40 - (1 - sheet) * 400, height: 230, borderRadius: 44, background: 'rgba(18,13,28,0.94)', border: `6px solid ${PURPLE}`, padding: '22px 22px', boxSizing: 'border-box' }}>
        <div style={{ fontFamily: FONT, fontSize: 36, color: '#fff', letterSpacing: 2 }}>YOUR WEEK</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const on = age >= 0.25 + i * 0.15, k = pop(age - (0.25 + i * 0.15));
            return <div key={i} style={{ width: 70, textAlign: 'center' }}>
              <div style={{ height: 70, borderRadius: 35, background: on ? PURPLE : '#2b2740', border: `5px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, transform: `scale(${on ? k : 1})` }}>{on ? '🔥' : ''}</div>
              <div style={{ fontFamily: FONT, fontSize: 26, color: on ? '#fff' : '#8d86a8', marginTop: 8 }}>{i + 1}</div>
            </div>;
          })}
        </div>
      </div>
    </>
  );
};

/** Tab Guy peeks over the bottom edge and reacts to what the app says. */
const Peek: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.trained || t >= T.camp2) return null;
  let mood: Mood = 'neutral';
  if (t >= MOMENTS.miss) mood = 'worry';
  if (t >= T.hear) mood = 'focus';
  if (t >= T.find) mood = 'focus';
  if (t >= MOMENTS.correct) mood = 'awe';
  if (t >= T.later) mood = 'grin';
  const rise = easeOut(clamp((t - T.trained - 0.25) / 0.3));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
      <defs><filter id="ink2" x="-8%" y="-8%" width="116%" height="116%"><feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d" /><feFlood floodColor={INK} /><feComposite in2="d" operator="in" result="o" /><feMerge><feMergeNode in="o" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <g filter="url(#ink2)"><Person x={540} y={2110 - rise * 150} scale={1.15} t={t} seed={3} skin={SKIN} shirt="#3b4a7a" hair="beanie" hairColor="#3a2a22" accent="#e8445a" mood={mood}
        look={t < MOMENTS.correct ? [0, -0.9] : [0, -0.2]} head={{ y: Math.sin(t * 3) * 2, rot: Math.sin(t * 1.7) * 2 }} extras={<Glasses />} /></g>
    </svg>
  );
};

// --- cards + captions --------------------------------------------------------------------------------------------------------------------
const DayCard: React.FC<{ t: number }> = ({ t }) => {
  const a = T.day, b = T.trained;
  if (t < a || t >= b) return null;
  const age = t - a, out = clamp((b - t) / 0.12);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2b1f56,#120d28)', alignItems: 'center', justifyContent: 'center', clipPath: `inset(0 ${(1 - easeOut(age / 0.18)) * 100}% 0 0)`, opacity: out }}>
      <div style={{ fontFamily: FONT, fontSize: 250, color: '#fff', WebkitTextStroke: `22px ${INK}`, paintOrder: 'stroke fill', transform: `scale(${pop(age - 0.08)}) rotate(-4deg)` }}>DAY 1</div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ t: number }> = ({ t }) => {
  if ((t >= T.day && t < T.trained) || t >= T.card) return null;
  const i = LINES.findIndex((l, k) => t >= l.at && t < l.at + lineLen(k) + 0.18);
  if (i < 0) return null;
  const words = LINES[i].say.split(' '), total = words.reduce((s, w) => s + w.length + 2, 0), len = lineLen(i) * 0.96;
  let acc = 0, idx = 0;
  const starts = words.map((w) => { const s = (acc / total) * len; acc += w.length + 2; return s; });
  starts.forEach((s, k) => { if (t - LINES[i].at >= s) idx = k; });
  const age = t - LINES[i].at - starts[idx];
  const friend = LINES[i].who === 'friend';
  const word = words[idx].replace(/[.,]/g, (m) => (m === '.' ? '' : m));
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: t >= T.trained && t < T.camp2 ? 1440 : 1440, textAlign: 'center', pointerEvents: 'none' }}>
      <span style={{ display: 'inline-block', fontFamily: FONT, fontSize: 150, lineHeight: 1, color: friend ? '#ffd75e' : '#fff', WebkitTextStroke: `20px ${INK}`, paintOrder: 'stroke fill', textTransform: 'uppercase', transform: `scale(${Math.max(0.4, pop(age))}) rotate(${((idx % 3) - 1) * 2}deg)`, filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.35))' }}>{word}</span>
    </div>
  );
};

const EndCard: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.card) return null;
  const age = t - T.card, lines = ['No tabs.', 'No signal.', 'Just ears.'];
  return (
    <AbsoluteFill style={{ background: `rgba(10,6,24,${0.78 * clamp(age / 0.25)})`, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        {lines.map((l, k) => {
          const at = 0.05 + k * 0.7;
          return <div key={k} style={{ fontFamily: FONT, fontSize: k === 2 ? 190 : 150, lineHeight: 1.08, color: k === 2 ? '#c8bffd' : '#fff', WebkitTextStroke: `20px ${INK}`, paintOrder: 'stroke fill', transform: `scale(${Math.max(0, pop(age - at))}) rotate(${(k - 1) * 3}deg)`, opacity: age >= at ? 1 : 0 }}>{l}</div>;
        })}
        <div style={{ marginTop: 70, fontFamily: FONT, fontSize: 52, color: '#fff', WebkitTextStroke: `10px ${INK}`, paintOrder: 'stroke fill', opacity: clamp((age - 1.9) / 0.3) }}>Ear Warrior · link in profile</div>
      </div>
    </AbsoluteFill>
  );
};

export const CampNoSignal: React.FC = () => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const inRoom = t >= T.day && t < T.camp2;
  return (
    <AbsoluteFill style={{ background: '#05030c', overflow: 'hidden' }}>
      {inRoom ? <Room t={t} /> : <CampWorld t={t} />}
      <NoSignalPhone t={t} />
      <Peek t={t} />
      <AppPhone t={t} />
      <DayCard t={t} />
      <Captions t={t} />
      <EndCard t={t} />
      <Audio src={staticFile('camp.wav')} />
    </AbsoluteFill>
  );
};
