// "Warrior" films — pixel-art guitarist (sprites cut from the character sheet's "play guitar (standing)" row, public/warrior/f03…f16.png) chugs
// an E-minor rock riff on a rooftop stage at sunset, a lead lick joins in bar 2, he winds up during a snare roll and lands a big E chord with a jump.
// Timeline: ../../warrior/story.mjs (also drives the soundtrack). Two cuts from one scene: `Warrior` (5 s test cartoon) and `WarriorRoot`
// (7 s "jam night — find the root" challenge: the same film plus a caption and a call to comment).
//
// Everything is a pure function of the time `t`. Motion principles (README "Animation principles"), tagged where used:
//   ANTICIPATION  lean back + crouch during the snare roll, cut at the chord      SQUASH/STRETCH  anchored at the feet, volume kept
//   OVERSHOOT     damped cosines (`wob`) on every hit and on the landing           HOLD            after the landing the sprite freezes
//   SECONDARY     amp cone, light beams, sound rings, flying notes, sparks, camera push + shake, flash
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, easeOut, rng } from '../util';
import { RIFF, ROOT, type Story } from '../../warrior/story.mjs';
import { storyFromTake } from '../../warrior/take.mjs';
import takeJson from '../../warrior/take.json';

const SPRITE = 16;                            // screen px per sprite pixel (the background pixel is 8)
const FRAMES = ['03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'];
const CX = 600, FEET = 1580;                  // the guitarist's feet (bottom centre of the sprite), screen px
const SW = 40 * SPRITE, SH = 52 * SPRITE;
// the animated cut of the sheet (dyn): walk / run / play-standing / jump rows, 48×60 canvas with the ground line 3 px above the bottom edge
const NEW = { w: 48, h: 60, pad: 3, n: { walk: 17, run: 16, play: 16, jump: 6 } as const };
type SetName = keyof typeof NEW.n;
const sprite = (set: SetName, i: number) => `warrior/${set}_${String(i % NEW.n[set]).padStart(2, '0')}.png`;
const MONO = 'Menlo, "SF Mono", "Courier New", monospace';

// --- tiny motion vocabulary (same as src/byear/ByEar.tsx) ------------------------------------------------------------------------------
const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
const pre = (t: number, a: number, b: number) => (t < a || t >= b ? 0 : easeInOut((t - a) / (b - a)));
/** Seconds since the most recent event of a sorted list (Infinity before the first). */
const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };

// --- the stage (does not depend on the story, except the cone that pumps with the kick) -------------------------------------------------
const SKY = ['#120c2a', '#1b1140', '#2a1858', '#40206c', '#5e2a7a', '#8a3a86', '#b84e86', '#e0687a', '#f28a6a', '#ffb070'];
const GROUND = 165;                                                         // floor top, background pixels

type Bld = { x: number; w: number; h: number; col: string; win: { x: number; y: number; k: number }[] };
function skyline(seed: number, hMin: number, hMax: number, col: string, wMin: number, wMax: number, winCol = true): Bld[] {
  const r = rng(seed), out: Bld[] = [];
  let x = -2;
  while (x < 137) {
    const w = Math.round(wMin + r() * (wMax - wMin)), h = Math.round(hMin + r() * (hMax - hMin));
    const win: Bld['win'] = [];
    if (winCol) for (let yy = GROUND - h + 3; yy < GROUND - 3; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 4) if (r() < 0.42) win.push({ x: xx, y: yy, k: Math.floor(r() * 5) });
    out.push({ x, w, h, col, win });
    x += w + (r() < 0.3 ? 1 : 0);
  }
  return out;
}
const BACK = skyline(11, 24, 58, '#2c1b4c', 9, 16, false);
const FRONT = skyline(23, 14, 42, '#170f2c', 8, 13);
const STARS = (() => { const r = rng(5); return Array.from({ length: 46 }, () => ({ x: Math.floor(r() * 135), y: Math.floor(r() * 90), ph: r() * 6.28 })); })();

const Stage: React.FC<{ t: number; cone: number }> = ({ t, cone }) => {
  const sunY = 142 + 0.9 * t;                                              // the sun sinks a hair over the film
  const sun: React.ReactNode[] = [];
  for (let dy = -30; dy <= 0; dy++) {
    const half = Math.round(Math.sqrt(900 - dy * dy));
    sun.push(<rect key={dy} x={68 - half} y={sunY + dy} width={half * 2} height={1} fill={dy > -10 ? '#ffd590' : '#ffc07a'} />);
  }
  return (
    <svg width={1080} height={1920} viewBox="0 0 135 240" shapeRendering="crispEdges" style={{ position: 'absolute', inset: 0 }}>
      {SKY.map((c, i) => <rect key={i} x={0} y={i * 15} width={135} height={15 + (i === SKY.length - 1 ? 30 : 0)} fill={c} />)}
      {STARS.map((s, i) => (Math.sin(t * 3 + s.ph) > -0.2 ? <rect key={i} x={s.x} y={s.y} width={1} height={1} fill="#fff4d6" opacity={0.9} /> : null))}
      {sun}
      {BACK.map((b, i) => <rect key={i} x={b.x} y={GROUND - b.h} width={b.w} height={b.h + 4} fill={b.col} />)}
      {FRONT.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={GROUND - b.h} width={b.w} height={b.h + 4} fill={b.col} />
          {b.win.map((w, j) => (Math.floor(t * 2 + w.k) % 6 === 0 ? null : <rect key={j} x={w.x} y={w.y} width={2} height={2} fill={w.k % 2 ? '#ffd23a' : '#ff9a5a'} />))}
        </g>
      ))}
      {/* the stage: a plank floor with a bright lip */}
      <rect x={0} y={GROUND} width={135} height={75} fill="#2a2040" />
      <rect x={0} y={GROUND} width={135} height={2} fill="#6a4a8a" />
      <rect x={0} y={GROUND + 2} width={135} height={1} fill="#3a2a55" />
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 12 + 4} y={GROUND + 3} width={1} height={72} fill="#352a52" />)}
      {[GROUND + 14, GROUND + 30, GROUND + 50].map((y) => <rect key={y} x={0} y={y} width={135} height={1} fill="#30244a" />)}
      {/* amp stack on the left, its cones pump with the kick (SECONDARY) */}
      <rect x={4} y={150} width={26} height={44} fill="#100d17" />
      <rect x={4} y={150} width={26} height={2} fill="#d9a84a" />
      <rect x={6} y={154} width={22} height={38} fill="#26213a" />
      {[165, 183].map((cy) => {
        const r = 6 + (cone > 0.5 ? 1 : 0);
        const dots: React.ReactNode[] = [];
        for (let dy = -r; dy <= r; dy++) { const half = Math.round(Math.sqrt(r * r - dy * dy)); dots.push(<rect key={dy} x={17 - half} y={cy + dy} width={half * 2} height={1} fill="#0c0a12" />); }
        return <g key={cy}>{dots}<rect x={16} y={cy - 1} width={2} height={2} fill="#5a5470" /></g>;
      })}
      <rect x={8} y={156} width={2} height={2} fill="#ff4a5a" /><rect x={12} y={156} width={2} height={2} fill="#b5abfc" />
    </svg>
  );
};

// --- flying notes (SECONDARY) -------------------------------------------------------------------------------------------------------------
const NOTE = ['..####', '..#..##', '..#...#', '..#', '..#', '###', '###'];
const Note: React.FC<{ x: number; y: number; s: number; rot: number; op: number; col: string }> = ({ x, y, s, rot, op, col }) => (
  <svg width={7 * s} height={7 * s} viewBox="0 0 7 7" shapeRendering="crispEdges" style={{ position: 'absolute', left: x, top: y, opacity: op, transform: `rotate(${rot}deg)` }}>
    {NOTE.flatMap((row, yy) => [...row].map((ch, xx) => (ch === '#' ? <rect key={`${xx}-${yy}`} x={xx} y={yy} width={1} height={1} fill={col} /> : null)))}
  </svg>
);
const COLS = ['#ffd23a', '#ff9ac2', '#8ee8ff', '#b5abfc'];
const GUITAR = { x: CX + 28, y: FEET - 352 };                              // where the pick hand is, roughly, before bobbing
const SPARKS = (() => { const r = rng(77); return Array.from({ length: 28 }, () => ({ a: -Math.PI * (0.1 + r() * 0.8), v: 500 + r() * 900, s: 12 + Math.round(r() * 2) * 4, c: COLS[Math.floor(r() * 4)] })); })();

// --- the "find the root" challenge layer ------------------------------------------------------------------------------------------------
const OUTLINE: React.CSSProperties = { fontFamily: MONO, fontWeight: 800, WebkitTextStroke: '10px #0b0716', paintOrder: 'stroke fill', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' };

type Ask = { ask: [string, string]; answer: [string, string] };     // [plain, highlighted] before the hit / after it
const ASK_ROOT: Ask = { ask: ['FIND THE ', 'ROOT'], answer: ['ROOT ', 'NOTE?'] };
const ASK_KEY: Ask = { ask: ['FIND THE ', 'KEY'], answer: ['WHAT ', 'KEY?'] };

/** Text that floats letter by letter (dyn cut). `amp` px, `speed` rad/s, `lag` rad per letter. */
const Wavy: React.FC<{ text: string; t: number; amp: number; speed: number; lag?: number; color?: string }> = ({ text, t, amp, speed, lag = 0.55, color }) => (
  <>{[...text].map((ch, i) => <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', color, transform: `translateY(${amp * Math.sin(t * speed - i * lag)}px)` }}>{ch}</span>)}</>
);

const Challenge: React.FC<{ t: number; st: Story; q: Ask; dyn?: boolean }> = ({ t, st, q, dyn }) => {
  const hit = t - st.T.chord;
  const beatPunch = dyn && st.BEATS && t < st.T.fillAt ? 0.05 * kick(ageOf(t, st.BEATS), 11) : 0;
  const pop = 1 + 0.07 * wob(t + 0.35, 7, 22) + beatPunch;                              // the caption springs in from before frame 0, so frame 0 already shows it
  const swap = hit >= 0;
  const cta = easeOut((hit - 0.25) / 0.35), ctaPop = 1 + 0.06 * wob(hit - 0.25, 8, 26);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 232, transform: `scale(${pop}) rotate(${dyn ? 1.6 * Math.sin(t * 2.3) : 0}deg)`, transformOrigin: '50% 40%' }}>
        <div style={{ ...OUTLINE, fontSize: 62, letterSpacing: 12, color: '#ffd23a' }}>{dyn ? <Wavy text="JAM NIGHT." t={t} amp={6} speed={6} /> : 'JAM NIGHT.'}</div>
        {!swap ? (
          <div style={{ ...OUTLINE, fontSize: 106, marginTop: 6, color: '#ffffff' }}>{dyn ? <><Wavy text={q.ask[0]} t={t} amp={7} speed={5} lag={0.5} /><Wavy text={q.ask[1]} t={t - 0.4} amp={7} speed={5} lag={0.5} color="#ff9ac2" /></> : <>{q.ask[0]}<span style={{ color: '#ff9ac2' }}>{q.ask[1]}</span></>}</div>
        ) : (
          <div style={{ ...OUTLINE, fontSize: 122, marginTop: 6, color: '#ffffff', transform: `scale(${1 + 0.16 * kick(hit, 7) * Math.cos(hit * 28)})` }}>{dyn ? <><Wavy text={q.answer[0]} t={hit} amp={16 * Math.min(1, hit * 3)} speed={9} lag={0.7} /><Wavy text={q.answer[1]} t={hit - 0.3} amp={16 * Math.min(1, hit * 3)} speed={9} lag={0.7} color="#ff9ac2" /></> : <>{q.answer[0]}<span style={{ color: '#ff9ac2' }}>{q.answer[1]}</span></>}</div>
        )}
      </div>
      {swap ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 470, opacity: cta, transform: `scale(${ctaPop}) translateY(${(1 - cta) * 30}px)` }}>
          <div style={{ ...OUTLINE, fontSize: 70, color: '#8ee8ff' }}>COMMENT IT ↓</div>
          <div style={{ ...OUTLINE, fontSize: 40, marginTop: 28, WebkitTextStroke: '8px #0b0716', letterSpacing: 4, color: '#d2cefd' }}>earwarrior.app</div>
        </div>
      ) : null}
    </>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export function makeWarrior(st: Story, wav: string, challenge: Ask | null, dyn = false): React.FC {
  const { T, CHUGS, LEAD, KICKS } = st;
  // dyn (the "find the key" cut): everything also moves with the beat grid — travel across the stage, per-beat hops, a flip on the hit, crowd, equalizer, sweeping beams
  const BEAT = st.BEAT ?? 0.5, T0 = st.T0 ?? 0;
  const BEATS = st.BEATS ?? CHUGS.filter((c) => c.big).map((c) => c.t);
  const DOWNS = BEATS.filter((_, i) => i % 4 === 0), BARS = DOWNS.slice(1);
  // Choreography (all legs, no sliding hops): he walks in from the right, plays, runs left, plays, runs right, plays, runs back to the middle, crouches, jumps.
  const A = 330, LEFT = -190, RIGHT = 190;
  const WALKS = [
    { a: T0, d: 2 * BEAT, from: A, to: 0, set: 'walk' as SetName },
    { a: T0 + 3 * BEAT, d: 1.2 * BEAT, from: 0, to: LEFT, set: 'run' as SetName },
    { a: T0 + 6 * BEAT, d: 1.6 * BEAT, from: LEFT, to: RIGHT, set: 'run' as SetName },
    { a: T0 + 9 * BEAT, d: 1.4 * BEAT, from: RIGHT, to: 0, set: 'run' as SetName },
  ];
  const ease = (u: number) => 0.7 * u + 0.3 * easeInOut(u);                    // nearly constant speed, soft start and stop
  const choreo = (t: number) => {
    for (const w of WALKS) {
      if (t >= w.a && t < w.a + w.d) return { x: w.from + (w.to - w.from) * ease((t - w.a) / w.d), moving: true, set: w.set, a: w.a, face: w.to < w.from ? -1 : 1 };
    }
    const done = WALKS.filter((w) => t >= w.a + w.d);
    const x = done.length ? done[done.length - 1].to : A;
    // standing: at the left spot he faces the middle (right), at the right spot he faces it (left)
    return { x, moving: false, set: 'play' as SetName, a: 0, face: x < -100 ? 1 : x > 100 ? -1 : 1 };
  };
  const S2 = WALKS[2].a;
  const CHUG_T = CHUGS.map((c) => c.t), BIG_T = CHUGS.filter((c) => c.big).map((c) => c.t), LEAD_T = LEAD.map((n) => n.t);
  const LAND = T.chord + 0.45;
  const NOTE_EVENTS = [...(dyn ? BEATS.map((t, i) => ({ t, k: i % 6 })) : LEAD_T.map((t, i) => ({ t, k: i % 6 }))), ...[0, 1, 2, 3].map((k) => ({ t: T.chord + k * 0.03, k: k + 6 }))];

  const bodyAt = (t: number) => {
    const chug = kick(ageOf(t, CHUG_T), 15), big = kick(ageOf(t, BIG_T), 11);
    const ant = pre(t, T.fillAt, T.chord);                                  // ANTICIPATION: wind up through the snare roll
    const air = hump(t, T.chord, 0.45);
    const land = t >= LAND ? t - LAND : -1;
    const lean =
      1.2 * Math.sin((t * 2 * Math.PI) / 3.2)                                // idle sway
      + 2.4 * big + 0.8 * chug                                               // head-bang: nod into every downbeat…
      - 1.4 * wob(ageOf(t, BIG_T), 9, 26) * (t < T.fillAt ? 1 : 0)           // …and rebound (OVERSHOOT)
      - 7 * ant                                                              // lean back before the hit
      + 6 * wob(t - T.chord, 6, 22)                                          // lunge forward and settle
      + 3 * wob(land, 7, 30);
    const dy =
      3 * Math.sin((t * 2 * Math.PI) / 3.6)                                  // breathing — never perfectly still
      + 9 * chug + 8 * big
      + 30 * ant                                                             // crouch
      - 300 * air;                                                           // the jump
    const sy =
      1 - 0.035 * chug - 0.03 * big
      - 0.1 * ant                                                            // SQUASH in the crouch
      + 0.09 * air                                                           // STRETCH in the air
      - 0.11 * wob(land, 9, 38);                                             // squash on landing, wobble out
    if (!dyn) return { lean, dy, sy, sx: 1 + 0.8 * (1 - sy), air, px: 0, flip: 0, face: 1 };
    const c = choreo(t);
    const live = t < T.fillAt ? 1 : 0, still = live * (c.moving ? 0 : 1);
    const hop = still * (22 * hump(ageOf(t, BEATS), 0, 0.3) + 30 * hump(ageOf(t, DOWNS), 0, 0.38));       // while he stands: a hop on every beat, a bigger one on the downbeat
    const banging = live * (c.moving ? 2.5 : 5) * Math.sin(((t - T0) / BEAT) * Math.PI);                    // head-bang twice a beat
    return { lean: lean + banging, dy: dy - hop, sy: sy - 0.03 * live * kick(ageOf(t, BEATS), 14), sx: 1 + 0.8 * (1 - sy), air, px: c.x, flip: 0, face: c.face };
  };

  /** A 12 fps loop, one extra step on every chug so the hands move with the riff; frozen in the hold. */
  /** which animation frame to show (dyn): walk/run cycles while moving, the playing loop (one extra step on every chug) while standing, the sheet's crouch → jump → land at the hit. */
  const poseAt = (t: number): { set: SetName; i: number } => {
    if (t >= T.chord + 0.02) return { set: 'jump', i: t >= LAND ? 5 : 1 + Math.min(3, Math.floor(((t - T.chord) / 0.45) * 4)) };
    if (t >= T.fillAt) return { set: 'jump', i: 0 };
    const c = choreo(t);
    if (c.moving) return { set: c.set, i: Math.floor((t - c.a) * (c.set === 'walk' ? 20 : 26)) };
    return { set: 'play', i: Math.floor(t * 16) + CHUG_T.filter((x) => x <= t).length };
  };
  const spriteIndex = (t: number) => (t >= T.chord + 0.02 ? 5 : (Math.floor(t * (dyn ? 16 : 12)) + CHUG_T.filter((x) => x <= t).length) % FRAMES.length);

  const Beams: React.FC<{ t: number }> = ({ t }) => {
    const a = 0.1 + 0.14 * kick(ageOf(t, KICKS), 9) + 0.5 * kick(t - T.chord, 7);
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
        <polygon points="200,0 280,0 760,1500 470,1500" fill="#b5abfc" opacity={a * 0.6} />
        <polygon points="820,0 900,0 800,1500 480,1500" fill="#ff9ac2" opacity={a * 0.5} />
      </svg>
    );
  };
  /** dyn: four spots that sweep the sky, change colour every bar, strobe in the snare roll and blow out on the hit. */
  const BeamsDyn: React.FC<{ t: number }> = ({ t }) => {
    const ant = pre(t, T.fillAt, T.chord);
    const base = 0.1 + 0.2 * kick(ageOf(t, BEATS), 8) + 0.5 * kick(t - T.chord, 7) + ant * (0.15 + 0.3 * (Math.floor(t * 16) % 2));
    const bar = Math.max(0, BARS.filter((b) => b <= t).length);
    const pal = [['#b5abfc', '#ff9ac2'], ['#8ee8ff', '#ffd23a'], ['#ff9ac2', '#8ee8ff'], ['#ffd23a', '#b5abfc']][bar % 4];
    const spots = [{ ox: 140, c: pal[0], ph: 0 }, { ox: 400, c: pal[1], ph: 1.6 }, { ox: 680, c: pal[0], ph: 3.1 }, { ox: 940, c: pal[1], ph: 4.7 }];
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
        {spots.map((sp, i) => {
          const tx = 540 + 380 * Math.sin(t * 1.5 + sp.ph) + (sp.ox - 540) * 0.3;
          return <polygon key={i} points={`${sp.ox - 40},0 ${sp.ox + 40},0 ${tx + 130},1500 ${tx - 130},1500`} fill={sp.c} opacity={base * 0.55} />;
        })}
      </svg>
    );
  };
  /** dyn: slow clouds drifting through the sunset (parallax). */
  const Clouds: React.FC<{ t: number }> = ({ t }) => (
    <svg width={1080} height={1920} viewBox="0 0 135 240" shapeRendering="crispEdges" style={{ position: 'absolute', inset: 0 }}>
      {[{ y: 62, v: 3.5, x: 20, w: 26 }, { y: 96, v: 6, x: 90, w: 34 }, { y: 120, v: 2.2, x: 50, w: 22 }].map((c, i) => {
        const x = ((c.x + c.v * t + 40) % 215) - 40;
        return <g key={i} fill="#ffb0c8" opacity={0.28}><rect x={x} y={c.y} width={c.w} height={3} /><rect x={x + 4} y={c.y - 3} width={c.w - 12} height={3} /><rect x={x + 9} y={c.y - 6} width={c.w - 20} height={3} /></g>;
      })}
    </svg>
  );
  /** dyn: a row of equalizer bars on the horizon that jump with every drum hit. */
  const Equalizer: React.FC<{ t: number }> = ({ t }) => {
    const hit = kick(ageOf(t, KICKS), 7), beat = kick(ageOf(t, BEATS), 9);
    const boom = kick(t - T.chord, 4);
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
        {Array.from({ length: 27 }, (_, i) => {
          const h = 16 + (60 + 70 * (0.5 + 0.5 * Math.sin(t * (4 + (i % 5)) + i * 1.3))) * (0.25 + 0.5 * hit + 0.35 * beat) + 380 * boom * (0.5 + 0.5 * Math.sin(i * 2.1));
          return <rect key={i} x={i * 40} y={1320 - h} width={32} height={h} fill={['#ff9ac2', '#b5abfc', '#8ee8ff'][i % 3]} opacity={0.5} />;
        })}
      </svg>
    );
  };
  /** dyn: the audience in front of the stage — heads bob on every beat, hands go up through bar 3 and everyone jumps on the hit. */
  const CROWD = Array.from({ length: 13 }, (_, i) => ({ x: 6 + i * 83 + ((i * 37) % 22), y: 1790 + ((i * 53) % 46), ph: (i * 0.37) % 1, hand: i % 3 }));
  const Crowd: React.FC<{ t: number }> = ({ t }) => {
    const excite = t < S2 ? 0.15 : t < T.fillAt ? 0.55 : 1;
    return (
      <svg width={1080} height={1920} shapeRendering="crispEdges" style={{ position: 'absolute', inset: 0 }}>
        {CROWD.map((c, i) => {
          const bob = 30 * excite * hump(ageOf(t - c.ph * 0.1, BEATS), 0, 0.28) + 190 * hump(t, T.chord + c.ph * 0.18, 0.5);
          const up = excite * (0.5 + 0.5 * Math.sin(t * 8 + i * 1.7));
          const x = c.x + 18 * Math.sin(t * 1.4 + i), y = c.y - bob;
          const arm = (side: number) => <rect x={x + 38 * side - (side < 0 ? 16 : 0)} y={y + 44 - 70 * up * (c.hand === 0 ? 1 : 0.7)} width={16} height={70 + 20 * up} fill="#0b0716" stroke="#241447" strokeWidth={3} />;
          return (
            <g key={i}>
              {arm(-1)}{arm(1)}
              <rect x={x - 14} y={y} width={56} height={56} fill="#0b0716" stroke="#241447" strokeWidth={3} />
              <rect x={x - 34} y={y + 60} width={96} height={200} fill="#0b0716" stroke="#241447" strokeWidth={3} />
              {c.hand === 1 ? <rect x={x - 14} y={y - 8} width={56} height={14} fill="#241447" /> : null}
            </g>
          );
        })}
      </svg>
    );
  };
  /** dyn: lines rushing out from him through the snare roll (ANTICIPATION). */
  const SpeedLines: React.FC<{ t: number; px: number }> = ({ t, px }) => {
    const a = pre(t, T.fillAt - 0.1, T.chord);
    if (a <= 0) return null;
    const r = rng(300 + Math.floor(t * 30));
    return (
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 30 }, (_, i) => {
          const ang = (i / 30) * Math.PI * 2 + r() * 0.1, r0 = 330 + r() * 120, r1 = r0 + (160 + 520 * a) * (0.5 + r());
          return <line key={i} x1={CX + px + Math.cos(ang) * r0} y1={FEET - 300 + Math.sin(ang) * r0} x2={CX + px + Math.cos(ang) * r1} y2={FEET - 300 + Math.sin(ang) * r1} stroke="#ffffff" strokeWidth={4 + 6 * r()} opacity={0.55 * a} />;
        })}
      </svg>
    );
  };
  /** dyn: after the hit, pixel fireworks in the sky and confetti raining down. */
  const FW = [{ x: 250, y: 560, d: 0.05 }, { x: 830, y: 500, d: 0.2 }, { x: 540, y: 760, d: 0.35 }];
  const CONFETTI = (() => { const r = rng(909); return Array.from({ length: 70 }, () => ({ x: r() * 1080, d: r() * 0.5, v: 420 + r() * 520, sw: 20 + r() * 50, s: 12 + Math.round(r() * 2) * 4, c: COLS[Math.floor(r() * 4)], sp: 3 + r() * 6 })); })();
  const Party: React.FC<{ t: number }> = ({ t }) => {
    const age = t - T.chord;
    if (age < 0) return null;
    return (
      <>
        {FW.map((f, k) => {
          const a = age - f.d;
          if (a < 0 || a > 1.1) return null;
          return Array.from({ length: 16 }, (_, i) => {
            const ang = (i / 16) * Math.PI * 2, rad = 250 * easeOut(a / 0.7);
            return <div key={`${k}-${i}`} style={{ position: 'absolute', left: f.x + Math.cos(ang) * rad, top: f.y + Math.sin(ang) * rad + 200 * a * a, width: 22, height: 22, background: COLS[(i + k) % 4], opacity: clamp(1.2 - a / 0.9) }} />;
          });
        })}
        {CONFETTI.map((c, i) => {
          const a = age - c.d;
          if (a < 0) return null;
          return <div key={i} style={{ position: 'absolute', left: c.x + c.sw * Math.sin(a * 4 + i), top: -40 + c.v * a, width: c.s, height: c.s * 0.6, background: c.c, transform: `rotate(${a * c.sp * 90}deg)` }} />;
        })}
      </>
    );
  };

  const Notes: React.FC<{ t: number; px: number }> = ({ t, px }) => (
    <>
      {NOTE_EVENTS.map((e, i) => {
        const age = t - e.t;
        if (age < 0 || age > 1.6) return null;
        const r = rng(100 + e.k * 7), dir = (r() - 0.5) * 2;
        const x = GUITAR.x + px + dir * 200 * age + 40 * Math.sin(age * 5 + e.k) + (e.k >= 6 ? (e.k - 7.5) * 90 * age : 160 * age);
        const y = GUITAR.y - 80 - 460 * age + 120 * age * age;
        return <Note key={i} x={x} y={y} s={e.k >= 6 ? 9 : 7} rot={dir * 18 * Math.sin(age * 6)} op={clamp(1.5 - age) * clamp(age * 14)} col={COLS[e.k % 4]} />;
      })}
    </>
  );
  const Rings: React.FC<{ t: number; px: number }> = ({ t, px }) => (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {BIG_T.concat([T.chord]).map((s, i) => {
        const age = t - s;
        if (age < 0 || age > 0.45) return null;
        const big = s === T.chord;
        return <circle key={i} cx={big ? CX + px : 150} cy={big ? FEET - 320 : 1300} r={(big ? 140 : 40) + age * (big ? 1500 : 520)} fill="none" stroke={big ? '#ffffff' : '#b5abfc'} strokeWidth={big ? 14 : 8} opacity={(1 - age / 0.45) * (big ? 0.8 : 0.5)} />;
      })}
    </svg>
  );
  const Sparks: React.FC<{ t: number; px: number }> = ({ t, px }) => {
    const age = t - T.chord;
    if (age < 0 || age > 1.4) return null;
    return (
      <>
        {SPARKS.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: CX + px + Math.cos(p.a) * p.v * age, top: FEET - 380 + Math.sin(p.a) * p.v * age + 1500 * age * age, width: p.s, height: p.s, background: p.c, opacity: clamp(1.3 - age) }} />
        ))}
      </>
    );
  };

  return function Warrior() {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = frame / fps;
    const b = bodyAt(t);
    const idx = spriteIndex(t), pose = poseAt(t);

    const ant = pre(t, T.fillAt, T.chord);
    const beatAge = ageOf(t, BEATS), downAge = ageOf(t, DOWNS), barAge = ageOf(t, BARS);
    const push = 1 + (dyn ? 0.1 : 0.045) * easeInOut((t - (T.chord - 1.95)) / 1.9) + 0.07 * kick(t - T.chord, 6)       // camera push in, then a punch on the hit
      + (dyn ? 0.016 * kick(beatAge, 12) + 0.03 * kick(downAge, 9) : 0);                                              // …and it pulses with every beat
    const shake = kick(t - T.chord, 7), shakeSmall = kick(ageOf(t, BIG_T), 16);
    const camX = 16 * shake * Math.cos((t - T.chord) * 70) + 3 * shakeSmall * Math.cos(t * 90) + (dyn ? 16 * Math.sin(t * 0.9) - 0.22 * b.px : 0);
    const camY = 12 * shake * Math.sin((t - T.chord) * 83) + 6 * kick(ageOf(t, KICKS), 18) + (dyn ? 10 * Math.sin(t * 1.3) : 0);
    const camRot = dyn ? 1.1 * Math.sin(t * 0.8) + (t < T.fillAt ? 2.4 * wob(barAge, 5, 14) : 0) + ant * 3.5 * Math.sin(t * 38) + 3.2 * wob(t - T.chord, 3.2, 9) : 0;
    const roll = t >= T.fillAt && t < T.chord ? (2 + 6 * (t - T.fillAt)) * Math.sin(t * 160) : 0;              // the snare roll rattles the body
    const tint = dyn ? ['#ff5ea8', '#7a6cff', '#3ad0ff'][Math.max(0, BARS.filter((x) => x <= t).length) % 3] : '#000';

    return (
      <AbsoluteFill style={{ background: '#120c2a', overflow: 'hidden' }}>
        <Audio src={staticFile(wav)} volume={(f) => clamp((st.DURATION - f / fps) / 0.35)} />
        <AbsoluteFill style={{ transform: `translate(${camX}px, ${camY}px) rotate(${camRot}deg) scale(${push})`, transformOrigin: `${CX}px ${FEET - 300}px` }}>
          <Stage t={t} cone={kick(ageOf(t, KICKS), 14)} />
          {dyn ? <><Clouds t={t} /><BeamsDyn t={t} /><Equalizer t={t} /></> : <Beams t={t} />}
          {/* contact shadow: shrinks while he is in the air */}
          <div style={{ position: 'absolute', left: CX + b.px - 200 * (1 - b.air * 0.7), top: FEET - 18, width: 400 * (1 - b.air * 0.7), height: 32, background: '#000', opacity: 0.45 * (1 - b.air * 0.6) }} />
          <div style={{ position: 'absolute', left: CX - (dyn ? NEW.w : 40) * SPRITE / 2, top: FEET - (dyn ? NEW.h - NEW.pad : 52) * SPRITE, width: (dyn ? NEW.w : 40) * SPRITE, height: (dyn ? NEW.h : 52) * SPRITE, transformOrigin: `50% ${dyn ? ((NEW.h - NEW.pad) / NEW.h) * 100 : 100}%`, transform: `translate(${roll + b.px}px, ${b.dy}px) rotate(${b.lean}deg) scale(${b.sx * b.face}, ${b.sy})`, filter: 'drop-shadow(-6px -2px 0 rgba(255,176,122,0.55)) drop-shadow(6px 0 0 rgba(181,171,252,0.4))' }}>
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 62%', transform: `rotate(${b.flip}deg)` }}>
              {dyn ? (
                <Img src={staticFile(sprite(pose.set, pose.i))} style={{ position: 'absolute', inset: 0, width: NEW.w * SPRITE, height: NEW.h * SPRITE, imageRendering: 'pixelated' }} />
              ) : FRAMES.map((f, i) => (
                <Img key={f} src={staticFile(`warrior/f${f}.png`)} style={{ position: 'absolute', inset: 0, width: SW, height: SH, imageRendering: 'pixelated', visibility: i === idx ? 'visible' : 'hidden' }} />
              ))}
            </div>
          </div>
          {dyn ? <SpeedLines t={t} px={b.px} /> : null}
          <Rings t={t} px={b.px} />
          <Notes t={t} px={b.px} />
          <Sparks t={t} px={b.px} />
          {dyn ? <><Party t={t} /><Crowd t={t} /></> : null}
        </AbsoluteFill>
        {dyn ? <AbsoluteFill style={{ background: tint, opacity: 0.1 * kick(beatAge, 10) + 0.16 * kick(downAge, 8), mixBlendMode: 'screen', pointerEvents: 'none' }} /> : null}
        <AbsoluteFill style={{ background: '#fff', opacity: 0.55 * kick(t - T.chord, 14), pointerEvents: 'none' }} />
        {/* drum-roll vignette that closes in before the hit */}
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 55%, transparent 40%, rgba(10,6,24,0.7) 100%)', opacity: 0.8 * pre(t, T.fillAt - 0.4, T.chord) + 0.25, pointerEvents: 'none' }} />
        {challenge ? <Challenge t={t} st={st} q={challenge} dyn={dyn} /> : null}
      </AbsoluteFill>
    );
  };
}

export const Warrior = makeWarrior(RIFF, 'warrior-riff.wav', null);
export const WarriorRoot = makeWarrior(ROOT, 'warrior-root.wav', ASK_ROOT);

// "Find the key" cut: the timeline comes from the author's own recording (render-warrior.mjs --take=<file> → warrior/take.json + public/warrior-take.wav).
export const WARRIOR_KEY_STORY = storyFromTake(takeJson);
export const WarriorKey = makeWarrior(WARRIOR_KEY_STORY, 'warrior-take.wav', ASK_KEY, true);
