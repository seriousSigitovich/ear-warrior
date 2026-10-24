// "The melody in my head" — 15 s, 11 shots, none longer than 1.8 s. He hums the same climbing motif in a shower, on a bus and in a lift,
// cannot sing the top note at night, gets the idea, and plays it: the bedroom splits open into a stage and the solo starts.
// Timeline: ../../hum/story.mjs (also drives the soundtrack). Everything is a pure function of the time `t`.
// Principles (see README): ANTICIPATION (lean back before the lunge), OVERSHOOT (wob), HOLD (the silence before the solo),
// SECONDARY ACTION (notes flying out of the mouth, camera punch on every cut, beams, crowd), never perfectly still (breathing, sway).
import React from 'react';
import { AbsoluteFill, Audio, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, alpha, FONT } from '../theme';
import { clamp, easeOut, lerp } from '../util';
import { HUM, SOLO, FINAL, SOLO_AT, BEAT, SHOTS, shotAt, T, fret } from '../../hum/story.mjs';
import type { Shot } from '../../hum/story.mjs';
import { Person, ElectricShape, neckPoint, type Mood, type V } from '../pain/Person';
import { Bubble, Floaters, MusicNote, Caption } from '../pain/Items';
import { kick, wob, smooth, kf } from './motion';
import { ShowerBg, ShowerFront, BusBg, BusFront, LiftBg, LiftFront, BedroomBg, BedFront } from './Sets';
import { CliffBg, CliffFront, Rays, WindLines, SUN } from './Cliff';

const OUT = SHOTS[SHOTS.length - 1].t0;                    // the pull-back that ends the film
const HERO = { skin: '#d9a07a', shirt: '#3d4064', hair: 'short', hairColor: '#171420', sleeves: 'short' } as const;
const SNAP = { damping: 13, stiffness: 190, mass: 0.8 };
const BOUNCY = { damping: 8, stiffness: 170, mass: 0.8 };

const humTalk = (t: number) => {
  for (const n of HUM) if (t >= n.t && t < n.t + n.dur) return n.crack ? 0.95 : 0.3 + 0.1 * Math.sin((t - n.t) * 40);
  return 0;
};
const breathe = (t: number, a = 2.4) => a * Math.sin((t * 2 * Math.PI) / 3.4);

/** The hummed notes of one shot, flying out of the mouth; the one that cracks splits in two. */
const HumNotes: React.FC<{ t: number; shot: Shot; mx: number; my: number; dir?: number }> = ({ t, shot, mx, my, dir = 1 }) => (
  <g>
    {HUM.filter((n) => n.t >= shot.t0 && n.t < shot.t1).map((n, i) => {
      const age = t - n.t;
      if (age < 0 || age > 0.6) return null;
      const u = easeOut(age / 0.6);
      const x = mx + dir * (40 + 120 * u) + Math.sin(age * 16) * 9;
      const y = my - 40 - 190 * u - (n.midi - 57) * 9;
      if (n.crack) {
        const f = clamp(age / 0.5);
        return (
          <g key={i}>
            <MusicNote x={x - 34 * f} y={y + 150 * f * f} s={1.6} o={1 - f} rot={-60 * f} color="#ff7a8d" />
            <MusicNote x={x + 34 * f} y={y - 50 * f} s={1.6} o={1 - f} rot={60 * f} color="#ff7a8d" />
          </g>
        );
      }
      return <MusicNote key={i} x={x} y={y} s={1.35 + 0.45 * kick(age, 10)} o={1 - u * u} rot={-10 + 20 * Math.sin(i + age * 8)} color={i % 2 ? C.accent3 : C.accent4} />;
    })}
  </g>
);

/** The tune that will not leave: notes orbiting his head (an earworm). They fade when the voice breaks. */
const Earworm: React.FC<{ t: number; cx: number; cy: number; fade?: number }> = ({ t, cx, cy, fade = 1 }) => {
  if (fade <= 0.01) return null;
  return (
    <g opacity={fade}>
      <ellipse cx={cx} cy={cy - 50} rx={178} ry={58} fill="none" stroke={C.accent3} strokeOpacity={0.22} strokeWidth={5} strokeDasharray="4 22" strokeLinecap="round" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = t * 3.4 + (i * 2 * Math.PI) / 5;
        const x = cx + 178 * Math.cos(a), y = cy - 50 + 58 * Math.sin(a);
        return <MusicNote key={i} x={x} y={y} s={0.95 + 0.25 * Math.sin(a)} o={0.75 + 0.25 * Math.sin(a)} rot={14 * Math.cos(a)} color={i % 2 ? C.accent3 : C.accent4} />;
      })}
    </g>
  );
};

const camStr = (fx: number, fy: number, k: number, rot = 0, ax = 540, ay = 960, sx = 0, sy = 0) =>
  `translate(${ax + sx} ${ay + sy}) rotate(${rot}) scale(${k}) translate(${-fx} ${-fy})`;

// ===================================================================================================================================
// 1 · shower
const Shower: React.FC<{ t: number; shot: Shot }> = ({ t, shot }) => {
  const scrub = Math.sin(t * 23) * 16;
  return (
    <g>
      <ShowerBg t={t} />
      <Person x={500} y={1300} scale={1.6} t={t} seed={3} {...HERO} shirt={HERO.skin} mood="zen" talk={humTalk(t)} bob={breathe(t, 3)} lean={Math.sin(t * 5) * 1.6}
        head={{ rot: Math.sin(t * 9) * 3 }}
        elbowsOut left={[-70 + scrub * 0.5, -346 + Math.abs(scrub) * 0.4]} right={[70 - scrub * 0.5, -346 + Math.abs(scrub) * 0.4]}
        extras={<g fill="#f4f7ff" stroke="#c9d6f2" strokeWidth={3}>
          {[[-44, -318, 27], [0, -344, 33], [44, -318, 27], [-66, -290, 21], [66, -290, 21], [-20, -330, 25], [24, -336, 23]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r * (1 + 0.06 * Math.sin(t * 9 + i))} />)}
        </g>} />
      <ShowerFront t={t} />
      <Earworm t={t} cx={500} cy={881} />
      <HumNotes t={t} shot={shot} mx={500} my={935} />
    </g>
  );
};

// 2 · bus
const Bus: React.FC<{ t: number; shot: Shot }> = ({ t, shot }) => {
  const sway = Math.sin(t * 7) * 6;
  const turn = smooth(T.turn, T.turn + 0.45, t);
  return (
    <g transform={`translate(${sway} 0) rotate(${Math.sin(t * 5) * 0.4} 540 1500)`}>
      <BusBg t={t} />
      <Person x={800} y={1330} scale={1.4} flip t={t} seed={8} skin="#f0c3a0" shirt="#b7678a" hair="bun" hairColor="#d6d6e2" mood={t > T.turn + 0.1 ? 'worry' : 'neutral'}
        look={[1, 0.1]} bob={breathe(t, 2)} head={{ rot: 11 * turn - 6 * wob(t - (T.turn + 0.45), 8, 26), y: -4 * turn }} />
      <Person x={330} y={1340} scale={1.5} t={t} seed={2} {...HERO} mood="zen" talk={humTalk(t)} bob={breathe(t, 3)} lean={Math.sin(t * 7) * 1.2}
        head={{ rot: 4 * Math.sin(t * 6) }}
        extras={<g><path d="M -72 -200 C -72 -140 72 -140 72 -200" fill="none" stroke="#e8445a" strokeWidth={12} strokeLinecap="round" /><rect x={-92} y={-214} width={30} height={50} rx={12} fill="#e8445a" /><rect x={62} y={-214} width={30} height={50} rx={12} fill="#e8445a" /></g>} />
      <BusFront />
      <Earworm t={t} cx={330} cy={947} />
      <HumNotes t={t} shot={shot} mx={330} my={998} />
      <Bubble cx={800} cy={800} lines={['?']} tx={800} ty={900} p={t >= T.turn + 0.5 ? spring({ frame: (t - T.turn - 0.5) * 60, fps: 60, config: BOUNCY }) : 0} size={90} />
    </g>
  );
};

// 3 · lift
const Lift: React.FC<{ t: number; shot: Shot }> = ({ t, shot }) => {
  const ding = t >= T.ding ? 1 : 0, floor = t < T.ding - 0.9 ? 6 : ding ? 8 : 7;
  const broke = t >= T.stop;
  return (
    <g>
      <LiftBg t={t} floor={floor} ding={ding} />
      <Person x={790} y={1340} scale={1.4} flip t={t} seed={9} skin="#f0c3a0" shirt="#e9e9ed" hair="short" hairColor="#2a2a33" mood="bored" look={[1, 0.15]}
        bob={breathe(t, 1.8)} left={[-86, -34]} leftHold="cup" head={{ rot: 10 * smooth(T.stop - 0.7, T.stop - 0.3, t) }} />
      <Person x={340} y={1340} scale={1.45} t={t} seed={2} {...HERO} mood={broke ? 'tense' : 'zen'} look={broke ? [1, 0.1] : [0, 0]} talk={humTalk(t)}
        sweat={broke ? clamp((t - T.stop) / 0.15) : 0} bob={breathe(t, 3) + 4 * kick(t - T.stop, 9)} lean={-5 * kick(t - T.stop, 7) + Math.sin(t * 4)} />
      <LiftFront />
      <Earworm t={t} cx={340} cy={960} fade={broke ? Math.max(0, 1 - (t - T.stop) / 0.12) : 1} />
      <HumNotes t={t} shot={shot} mx={340} my={1009} />
    </g>
  );
};

// 4–5 · bedroom at night: the voice breaks, the idea, the guitar in the corner
const GUITAR_HOME = { x: 190, y: 1190, rot: 84, s: 1.05 };
const GUITAR_LAP = { x: 640, y: 1300 + 14 * 1.4, rot: 36, s: 1.4 };
const guitarAt = (t: number) => {
  const k = smooth(SOLO_AT - 0.2, SOLO_AT, t), e = k * k;
  return { x: lerp(GUITAR_HOME.x, GUITAR_LAP.x, e), y: lerp(GUITAR_HOME.y, GUITAR_LAP.y, e), rot: lerp(GUITAR_HOME.rot, GUITAR_LAP.rot, e), s: lerp(GUITAR_HOME.s, GUITAR_LAP.s, e) };
};
const Bulb: React.FC<{ x: number; y: number; p: number; t: number }> = ({ x, y, p, t }) => {
  if (p <= 0.01) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${p})`}>
      <circle r={150} fill="#ffe27a" opacity={0.25 + 0.1 * Math.sin(t * 40)} />
      {Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + 0.3; return <line key={i} x1={Math.cos(a) * 82} y1={Math.sin(a) * 82} x2={Math.cos(a) * (118 + 14 * Math.sin(t * 30 + i))} y2={Math.sin(a) * (118 + 14 * Math.sin(t * 30 + i))} stroke="#ffe27a" strokeWidth={9} strokeLinecap="round" />; })}
      <circle r={56} fill="#fff3a8" stroke="#ffcf3d" strokeWidth={8} />
      <path d="M -16 20 L -8 -16 L 0 6 L 8 -16 L 16 20" fill="none" stroke="#ffb020" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={-24} y={56} width={48} height={26} rx={8} fill="#9397ab" /><rect x={-18} y={82} width={36} height={14} rx={6} fill="#5a5e78" />
    </g>
  );
};
const Bed: React.FC<{ t: number; shot?: Shot }> = ({ t, shot }) => {
  const nightMood: Mood = t < T.crack - 0.3 ? 'worry' : t < T.crack + 0.4 ? 'cringe' : t < T.bulb ? 'sad' : t < T.grab ? 'awe' : 'grin';
  const reach = smooth(T.grab, T.grab + 0.3, t);
  const g = guitarAt(t);
  const ghosts = t > SOLO_AT - 0.2 && t < SOLO_AT + 0.02 ? [1, 2, 3].map((k) => guitarAt(t - k * 0.025)) : [];
  const idea = t >= T.bulb ? spring({ frame: (t - T.bulb) * 60, fps: 60, config: BOUNCY }) : 0;
  const lungeLean = -9 * smooth(T.grab, T.grab + 0.3, t) + 4 * pre(t, T.grab - 0.15, T.grab);
  return (
    <g>
      <BedroomBg t={t} beam={0.5 + 0.5 * smooth(T.bulb, T.bulb + 0.15, t)} />
      <Person x={640} y={1300} scale={1.4} t={t} seed={2} {...HERO} mood={nightMood} talk={humTalk(t)}
        look={t < T.crack + 0.3 ? [0, -0.2] : [-1, 0.3]} bob={breathe(t, 2.5)}
        lean={lungeLean - 5 * kick(t - T.crack, 6) + breathe(t, 0.8)}
        head={{ rot: -6 * wob(t - T.bulb, 6, 24) - 10 * smooth(T.grab, T.grab + 0.2, t), y: 5 * kick(t - T.crack, 8) }}
        left={[lerp(-96, -380, reach), lerp(40, -70, reach)]} />
      <BedFront />
      {ghosts.map((q, i) => <g key={i} opacity={0.28 / (i + 1)} transform={`translate(${q.x} ${q.y}) rotate(${q.rot}) scale(${q.s})`}><ElectricShape /></g>)}
      <g transform={`translate(${g.x} ${g.y}) rotate(${g.rot}) scale(${g.s})`}><ElectricShape glow={t >= T.bulb ? 1 : 0.2} /></g>
      <Bulb x={600} y={600} p={idea} t={t} />
      {shot && t < T.crack + 0.1 && <Earworm t={t} cx={640} cy={933} fade={clamp((T.crack + 0.1 - t) / 0.1) * clamp((t - 5.5) / 0.1 + 1)} />}
      {shot && <HumNotes t={t} shot={shot} mx={632} my={981} dir={-1} />}
    </g>
  );
};
const pre = (t: number, a: number, b: number) => (t < a || t >= b ? 0 : smooth(a, b, t));

// 6–11 · the ledge above the precipice
const PX = 540, PY = 1230, SS = 1.5;
const sinceBeat = (t: number) => (((t - SOLO_AT) % BEAT) + BEAT) % BEAT;
const finalAge = (t: number) => t - FINAL.t;
const stLean = (t: number) => -3 + 2.4 * Math.sin((2 * Math.PI * (t - SOLO_AT)) / (2 * BEAT)) - 4 * kick(sinceBeat(t), 7) * (t < FINAL.t ? 1 : 0) - 11 * smooth(FINAL.t - 0.12, FINAL.t + 0.3, t) + (t > FINAL.t ? 1.6 * Math.sin(t * 5.6) : 0);
const stBob = (t: number) => 3 * Math.sin((t * 2 * Math.PI) / 3.4) + 9 * kick(sinceBeat(t), 9) * (t < FINAL.t ? 1 : 0) - 16 * smooth(FINAL.t - 0.1, FINAL.t + 0.3, t);
const fretU = (midi: number) => clamp(0.9 - (0.8 * fret(midi)) / 24, 0.1, 0.9);
function handFor(t: number) {
  let i = -1;
  for (let k = 0; k < SOLO.length; k++) { if (SOLO[k].t <= t) i = k; else break; }
  if (i < 0) return { u: fretU(SOLO[0].midi), strum: 1, glow: 0 };
  const n = SOLO[i], nx = SOLO[i + 1];
  let u = n.final ? lerp(fretU(FINAL.from), fretU(FINAL.midi), smooth(FINAL.t, FINAL.t + FINAL.slide, t)) : fretU(n.midi);
  if (nx && !n.final) {
    const gap = nx.t - n.t, nu = nx.final ? fretU(FINAL.from) : fretU(nx.midi), k = clamp((t - (n.t + gap * 0.4)) / (gap * 0.55));
    u += (nu - u) * k * k * (3 - 2 * k);
  }
  const per = n.trem ? BEAT / 8 : BEAT / 4;
  return { u, strum: n.final ? 1 : (t - n.t) / per, glow: t - n.t < per * 0.9 || n.final ? 1 : 0 };
}
const sceneOf = (p: V, t: number): V => {
  const a = (stLean(t) * Math.PI) / 180;
  return [PX + SS * (p[0] * Math.cos(a) - p[1] * Math.sin(a)), PY + stBob(t) + SS * (p[0] * Math.sin(a) + p[1] * Math.cos(a))];
};
const handFocus = (t: number): V => sceneOf(neckPoint((handFor(t - 0.1).u + handFor(t + 0.1).u) / 2), t);

const Cliff: React.FC<{ t: number; shot: Shot }> = ({ t, shot }) => {
  const h = handFor(t);
  const id = shot.id;
  const mood: Mood = id === 'eye' ? 'smug' : id === 'out' ? 'zen' : id === 'wide' || id === 'low' ? 'grin' : 'focus';
  const look: V = id === 'hand' || id === 'side' ? [-0.7, 0.8] : [0, 0.25];
  const fin = clamp(finalAge(t) / 0.4);
  const vib = t >= FINAL.t + FINAL.slide ? 3.5 : 0;
  const wind = 0.9 + 0.08 * Math.sin(t * 1.7) + 0.3 * smooth(FINAL.t - 0.1, FINAL.t + 0.4, t);
  return (
    <g>
      <CliffBg t={t} />
      <Rays t={t} gain={1 + 1.2 * fin} />
      <Person x={PX} y={PY} scale={SS} t={t} seed={2} {...HERO} hair="windy" wind={wind} electric mood={mood} look={look} bob={stBob(t)} lean={stLean(t)}
        head={{ rot: -3 * kick(sinceBeat(t), 6) - 5 * smooth(FINAL.t, FINAL.t + 0.3, t), y: 7 * kick(sinceBeat(t), 8) }}
        guitar={{ u: h.u, strum: h.strum, glow: h.glow, jitter: vib }} />
      <WindLines t={t} wind={wind} />
      <Floaters t={t} t0={FINAL.t + 0.2} t1={15} cx={540} cy={1200} spread={400} every={0.1} kind="note" rise={700} size={1.3} />
      <CliffFront t={t} wind={wind} />
    </g>
  );
};

// ===================================================================================================================================
/** Camera of the pre-solo shots: a slow push-in plus a punch on the cut. */
function camFor(t: number, sh: Shot): { s: string; k: number } {
  const u = t - sh.t0, d = sh.t1 - sh.t0, p = u / d;
  const punch = 1 + 0.07 * kick(u, 14);
  switch (sh.id) {
    case 'shower': return { s: camStr(540, 1000, (1 + 0.09 * p) * punch), k: 1 };
    case 'bus': return { s: camStr(560, 1050, (1 + 0.08 * p) * punch, 0.6 * Math.sin(t * 6)), k: 1 };
    case 'lift': return { s: camStr(560, 1050, (1 + 0.09 * p) * punch), k: 1 };
    case 'night': {
      const sh1 = 12 * kick(t - T.crack, 8) * Math.sin(t * 120), sh2 = 8 * kick(t - T.crack, 8) * Math.cos(t * 97);
      return { s: camStr(640, 960, (1.5 + 0.35 * p) * punch, 0, 540, 960, sh1, sh2), k: 1 };
    }
    case 'idea': {
      const toGuitar = smooth(SOLO_AT - 0.24, SOLO_AT - 0.02, t);
      return { s: camStr(lerp(520, 330, toGuitar), lerp(1060, 1150, toGuitar), (1.12 + 0.28 * toGuitar) * punch, -3 * toGuitar), k: 1 };
    }
    case 'wide': {
      const sx = 16 * kick(u, 7) * Math.sin(t * 95), sy = 11 * kick(u, 7) * Math.cos(t * 83);
      return { s: camStr(560, 1150, (0.74 + 0.12 * easeOut(p)) * punch, 0, 540, 960, sx, sy), k: 1 };
    }
    case 'hand': { const f = handFocus(t); return { s: camStr(f[0], f[1], 2.3 * punch, -5 + 3 * p, 560, 900), k: 1 }; }
    case 'low': return { s: camStr(560, 1180, 1.75 * punch, lerp(-8, 4, p), 540, 860, 6 * Math.sin(t * 40) * kick(u, 3), 0), k: 1 };
    case 'side': { const f = handFocus(t); return { s: camStr(f[0], f[1], 2.1 * punch, lerp(14, 6, p), 540, 980), k: 1 }; }
    case 'eye': {
      const head = sceneOf([0, -262], t);
      return { s: camStr(head[0] + 6, head[1] + 10, 3.5 * punch, 0, 540, 960, 7 * Math.sin(t * 140), 5 * Math.cos(t * 120)), k: 1 };
    }
    default: return { s: camStr(540, 1180, lerp(1.6, 0.58, easeOut(p)) * (1 + 0.04 * kick(u, 10)), lerp(6, 0, p)), k: 1 };
  }
}

export const HumVideo: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const shot = shotAt(t);
  const cam = camFor(t, shot);
  const sp = (at: number, cfg = SNAP) => spring({ frame: frame - at * fps, fps, config: cfg });

  const scene =
    shot.id === 'shower' ? <Shower t={t} shot={shot} /> :
    shot.id === 'bus' ? <Bus t={t} shot={shot} /> :
    shot.id === 'lift' ? <Lift t={t} shot={shot} /> :
    shot.id === 'night' || shot.id === 'idea' ? <Bed t={t} shot={shot} /> :
    <Cliff t={t} shot={shot} />;

  // the bedroom splits open on the first beat of the solo and the stage is behind it
  const open = clamp((t - SOLO_AT) / 0.28), e = open * open;
  const ideaCam = camFor(SOLO_AT - 0.01, SHOTS[4]).s;
  const flashIdea = 0.8 * kick(t - T.bulb, 16) * (t >= T.bulb ? 1 : 0);
  const flashHit = 0.9 * kick(t - SOLO_AT, 12) * (t >= SOLO_AT ? 1 : 0);
  const out = clamp((t - OUT) / 0.9);

  return (
    <AbsoluteFill style={{ background: '#05050c' }}>
      {!silent && <Audio src={staticFile('hum-solo.wav')} />}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <g transform={cam.s}>{scene}</g>

        {t >= SOLO_AT && open < 1 && [-1, 1].map((side) => (
          <g key={side} transform={`translate(${side * 540 * e} 0)`}>
            <clipPath id={`half-${side}`}><rect x={side < 0 ? 0 : 540} y={0} width={540} height={1920} /></clipPath>
            <g clipPath={`url(#half-${side})`}><g transform={ideaCam}><Bed t={SOLO_AT - 0.01} /></g></g>
            <rect x={side < 0 ? 536 : 540} y={0} width={4} height={1920} fill="#fff" opacity={0.6} />
          </g>
        ))}

        {/* speed lines on the fast descent */}
        {shot.id === 'side' && Array.from({ length: 16 }, (_, i) => {
          const x = ((i * 97 + t * 2600) % 1600) - 260, w = 4 + (i % 4) * 3;
          return <line key={i} x1={x} y1={-100} x2={x - 520} y2={2020} stroke="#fff" strokeOpacity={0.1 + 0.05 * (i % 3)} strokeWidth={w} />;
        })}
        {shot.id === 'low' && Array.from({ length: 10 }, (_, i) => {
          const y = ((i * 211 + t * 2200) % 2100) - 100;
          return <line key={i} x1={0} y1={y} x2={1080} y2={y - 260} stroke="#fff" strokeOpacity={0.07} strokeWidth={5 + (i % 3) * 3} />;
        })}

        {/* light: flash on the idea, flash on the crash, a flare for the last note */}
        <rect width={1080} height={1920} fill="#fff" opacity={flashIdea + flashHit} />
        <defs><radialGradient id="flare"><stop offset="0" stopColor="#fff2cf" stopOpacity={0.85} /><stop offset="1" stopColor="#fff2cf" stopOpacity={0} /></radialGradient></defs>
        {out > 0 && <circle cx={540} cy={1000} r={400 + 700 * out} fill="url(#flare)" opacity={0.5 * kick(t - OUT, 3) + 0.15} style={{ mixBlendMode: 'screen' }} />}
        <defs><radialGradient id="vig"><stop offset="0.55" stopColor="#05050c" stopOpacity={0} /><stop offset="1" stopColor="#05050c" stopOpacity={shot.id === 'eye' ? 0.75 : 0.45} /></radialGradient></defs>
        <rect width={1080} height={1920} fill="url(#vig)" />
      </svg>

      <Caption lines={['Stuck melody?', '*Can you play it?*']} from={-0.35} to={SHOTS[1].t0} top={150} size={110} />
      <Caption lines={['*Same melody.*']} from={SHOTS[1].t0} to={SHOTS[2].t0} top={170} size={120} />
      <Caption lines={['Still *stuck.*']} from={SHOTS[2].t0} to={SHOTS[3].t0} top={170} size={120} />
      <Caption lines={['Can’t sing it.']} from={SHOTS[3].t0} to={T.bulb - 0.1} top={170} size={120} />
      <Caption lines={['*Play it.*']} from={T.bulb} to={SOLO_AT + 0.18} top={170} size={132} />
      <Caption lines={['Play what', 'you *hear.*']} from={SHOTS[9].t0} to={15.2} top={140} size={118} />
      {t < SHOTS[4].t0 && (() => {
        const di = SHOTS.findIndex((x) => x.id === shot.id), pop = sp(shot.t0, BOUNCY);
        return (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', fontFamily: FONT }}>
            <div key={di} style={{ display: 'inline-block', padding: '8px 30px', borderRadius: 40, background: alpha(C.accent, 0.3), border: `2px solid ${C.accent3}`, color: C.accent4, fontSize: 40, fontWeight: 700, letterSpacing: 5, transform: `scale(${0.6 + 0.4 * pop})`, opacity: clamp(pop * 2) }}>DAY {di + 1}</div>
          </div>
        );
      })()}
      {t >= OUT && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1530, textAlign: 'center', fontFamily: FONT }}>
          <div style={{ display: 'inline-block', padding: '16px 46px', borderRadius: 60, background: `linear-gradient(90deg, ${C.accent3}, ${C.accent})`, color: C.bg, fontSize: 54, fontWeight: 700, letterSpacing: 0.5, opacity: clamp(sp(OUT) * 1.5), transform: `scale(${0.7 + 0.3 * sp(OUT, BOUNCY)})`, boxShadow: `0 10px 50px ${alpha(C.accent, 0.6)}` }}>earwarrior.app</div>
        </div>
      )}
    </AbsoluteFill>
  );
};
void kf;
