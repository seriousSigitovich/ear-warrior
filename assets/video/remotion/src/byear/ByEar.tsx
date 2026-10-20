// "By ear" — 5 s. He listens (hand cupped to the ear), the room goes quiet, then he works the phrase out on the guitar: one wrong note,
// a held beat, the fix, and a strummed chord that lands it.  Timeline: ../../by-ear/story.mjs (also drives the soundtrack).
//
// Everything below is a pure function of the time `t`, so any frame can be rendered alone. The motion is built from a handful of classic
// animation principles — each one is tagged where it is used:
//   ANTICIPATION  a small move the wrong way before the real one (crouch before the jump, lean back before the first note)
//   SQUASH/STRETCH  the body flattens on impact and stretches in flight, volume kept (sx ≈ 1 + 0.8·(1 − sy))
//   FOLLOW-THROUGH  the head is the same motion as the body, but late: lean(t − 0.09) − lean(t)
//   OVERSHOOT     springs and damped cosines (`wob`) go past the target and settle, instead of easing to a stop
//   HOLD          the beat after the wrong note: everything freezes, the sweat drop slides, nothing else moves
//   SECONDARY     speaker cone, sound waves, flying notes, ear ring, camera push + shake, light beams — they sell the main action
import React from 'react';
import { AbsoluteFill, Audio, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, alpha } from '../theme';
import { clamp, easeInOut, easeOut, lerp } from '../util';
import { T, HEARD, ATTEMPTS, FPS } from '../../by-ear/story.mjs';
import { Person, type Mood, type V } from '../pain/Person';
import { RoomBg, RoomFront } from '../pain/Rooms';
import { Bubble, Floaters, MusicNote, Caption } from '../pain/Items';

const TAB = { skin: '#f0c3a0', shirt: '#7a74d6', hair: 'short', hairColor: '#3a2a22' } as const;
const S = 1.35, PX = 540, PY = 1400;                      // the person, in scene space
const FEET = 1500;                                        // squash is anchored here, under the sofa edge
const SPEAKER = { x: 800, y: 888, w: 112, h: 112 };       // on a little wall shelf under the window: clear of his raised elbow
const WAVE_FROM = { x: SPEAKER.x - 6, y: SPEAKER.y + 60 };
const EAR = { x: 628, y: 1058 };                          // his right ear in scene space
const HOLE = { x: 555, y: 1430 };                         // the guitar's sound hole

const SNAP = { damping: 13, stiffness: 190, mass: 0.8 };
const BOUNCY = { damping: 8, stiffness: 170, mass: 0.8 };
const SOFT = { damping: 12, stiffness: 150, mass: 0.8 };

// --- tiny motion vocabulary -------------------------------------------------------------------------------------------------------------
/** Exponential decay from 1 at `age` = 0 (an impact that fades). 0 before the hit. */
const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
/** Damped cosine: starts at 1, swings through zero and the other way, dies out (overshoot). 0 before the hit. */
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
/** 0 → 1 → 0 parabola over [a, a+d]: a jump's height. */
const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
/** Ramp 0 → 1 over [a, b] that CUTS to 0 at b: the wind-up, dropped the instant the real move starts. */
const pre = (t: number, a: number, b: number) => (t < a || t >= b ? 0 : easeInOut((t - a) / (b - a)));
const smooth = (a: number, b: number, t: number) => easeInOut((t - a) / (b - a));
/** Piecewise keyframes with ease-in-out between them. */
function kf(t: number, pts: [number, number][]): number {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return lerp(va, vb, easeInOut((t - a) / (b - a))); }
  return pts[pts.length - 1][1];
}

const heardAge = (t: number) => { let a = Infinity; for (const n of HEARD) if (t >= n.t) a = t - n.t; return t < T.earDown ? a : Infinity; };

// --- the body, as functions of time -----------------------------------------------------------------------------------------------------
/** Lean in degrees. */
const lean = (t: number) =>
  1.4 * Math.sin((t * 2 * Math.PI) / 3.4)                  // idle sway
  - 3.5 * pre(t, T.earDown, T.play)                        // ANTICIPATION: sit back before the first note…
  + 2.4 * wob(t - T.play, 6, 20)                           // …then lunge in and settle (OVERSHOOT)
  - 6.5 * kick(t - T.miss, 7)                              // the wrong note: recoil
  + 3 * wob(t - T.fix, 6, 24)                              // the right one: a little pop forward
  - 7 * pre(t, T.chord - 0.2, T.chord)                     // ANTICIPATION: wind back before the strum
  + 5 * wob(t - T.chord, 5, 18);

/** Vertical offset in px (+ = down). */
const bobY = (t: number) =>
  2.2 * Math.sin((t * 2 * Math.PI) / 3.6)                  // breathing: he is never perfectly still
  + 3 * kick(heardAge(t), 9)                               // the body sinks a hair with every heard note
  + ATTEMPTS.reduce((s, n) => s + 5 * kick(t - n.t, 10), 0)
  + 14 * pre(t, T.chord - 0.2, T.chord)                    // ANTICIPATION: crouch
  - 70 * hump(t, T.chord, 0.45);                           // the jump

/** Vertical scale (SQUASH & STRETCH). */
const squashY = (t: number) =>
  1
  - 0.035 * pre(t, T.earDown, T.play)
  - ATTEMPTS.reduce((s, n) => s + 0.03 * kick(t - n.t, 12), 0)
  - 0.08 * pre(t, T.chord - 0.2, T.chord)                  // flatten in the crouch
  + 0.07 * hump(t, T.chord, 0.45)                          // stretch in the air
  - 0.09 * wob(t - (T.chord + 0.45), 9, 38);               // flatten on landing, wobble out

// --- the hands --------------------------------------------------------------------------------------------------------------------------
const fretU = (f: number) => 0.22 + f * 0.05;
/** Fretting-hand position, sliding to the next note's fret through the second half of the gap; and the pick stroke's phase. */
function handFor(t: number) {
  let i = -1;
  for (let k = 0; k < ATTEMPTS.length; k++) { if (ATTEMPTS[k].t <= t) i = k; else break; }
  if (i < 0) return { u: fretU(ATTEMPTS[0].f), strum: 1 };
  const n = ATTEMPTS[i], nx = ATTEMPTS[i + 1];
  let u = fretU(n.f);
  if (nx) { const gap = nx.t - n.t, k = clamp((t - (n.t + gap * 0.5)) / (gap * 0.45)); u += (fretU(nx.f) - u) * k * k * (3 - 2 * k); }
  return { u, strum: (t - n.t) / 0.2 };
}

function moodAt(t: number): Mood {
  if (t < 0.12) return 'neutral';
  if (t < T.earDown) return 'zen';                         // eyes closed: all ears
  if (t < T.miss) return 'focus';
  if (t < T.fix) return 'cringe';
  if (t < 3.6) return 'awe';                               // "oh!"
  if (t < T.chord) return 'happy';
  return 'love';
}
function lookAt(t: number): V {
  if (t < T.earDown) return [1, -0.1];
  if (t < T.miss) return [-0.5, 0.8];                      // at the fretboard
  if (t < T.fix) return [0.5, -0.7];                       // eyes up: thinking
  if (t < T.chord) return [-0.3, 0.6];
  return [0, 0.1];
}

// --- scene pieces -----------------------------------------------------------------------------------------------------------------------
const Speaker: React.FC<{ pulse: number; glow: number }> = ({ pulse, glow }) => (
  <g transform={`translate(${SPEAKER.x} ${SPEAKER.y})`}>
    <rect x={0} y={0} width={SPEAKER.w} height={SPEAKER.h} rx={22} fill="#14122c" stroke="#2f2a5f" strokeWidth={4} />
    <circle cx={SPEAKER.w / 2} cy={28} r={10} fill="#2a2650" />
    <circle cx={SPEAKER.w / 2} cy={72} r={(26 + 6 * pulse)} fill="#2a2650" stroke={alpha(C.accent3, 0.25 + 0.6 * glow)} strokeWidth={4} />
    <circle cx={SPEAKER.w / 2} cy={72} r={(11 + 3 * pulse)} fill="#1b1838" />
    <circle cx={SPEAKER.w - 16} cy={12} r={4} fill={C.accent3} opacity={0.4 + 0.6 * glow} />
    <rect x={-18} y={SPEAKER.h} width={SPEAKER.w + 36} height={14} rx={5} fill="#3b3a63" />
  </g>
);

/** Two arcs of sound per heard note, spreading toward his ear. */
const Waves: React.FC<{ t: number }> = ({ t }) => {
  const base = Math.atan2(EAR.y - WAVE_FROM.y, EAR.x - WAVE_FROM.x);
  return (
    <g fill="none" strokeLinecap="round">
      {HEARD.map((n, i) => {
        const age = t - n.t;
        if (age < 0 || age > 0.75) return null;
        return [0, 1].map((k) => {
          const r = 60 + age * 520 - k * 55;
          if (r < 20) return null;
          const a0 = base - 0.55, a1 = base + 0.55;
          const d = `M ${WAVE_FROM.x + r * Math.cos(a0)} ${WAVE_FROM.y + r * Math.sin(a0)} A ${r} ${r} 0 0 0 ${WAVE_FROM.x + r * Math.cos(a1)} ${WAVE_FROM.y + r * Math.sin(a1)}`;
          return <path key={`${i}-${k}`} d={d} stroke={C.accent3} strokeWidth={10 - k * 3} opacity={(1 - age / 0.75) * (k ? 0.5 : 0.85)} />;
        });
      })}
    </g>
  );
};

/** A note flies from the speaker into his ear; a ring blooms on arrival. */
const Arrivals: React.FC<{ t: number }> = ({ t }) => (
  <g>
    {HEARD.map((n, i) => {
      const age = t - n.t - 0.05;
      if (age < 0 || age > 0.9) return null;
      const u = easeOut(clamp(age / 0.55));
      const x = lerp(WAVE_FROM.x - 20, EAR.x + 14, u), y = lerp(WAVE_FROM.y - 30, EAR.y - 6, u) - 70 * Math.sin(Math.PI * u);
      const ring = clamp((age - 0.5) / 0.4);
      return (
        <g key={i}>
          {age < 0.6 && <MusicNote x={x} y={y} s={1.15 - 0.4 * u} o={1 - clamp((age - 0.45) / 0.15)} rot={-12 + 24 * u} color={i % 2 ? C.accent3 : C.accent4} />}
          {ring > 0 && ring < 1 && <circle cx={EAR.x} cy={EAR.y} r={30 + ring * 80} fill="none" stroke={C.accent3} strokeWidth={8 * (1 - ring)} opacity={0.8 * (1 - ring)} />}
        </g>
      );
    })}
  </g>
);

/** Progress pips: heard (outlined), played back (filled), the miss (red shake), and the finale wave. */
const Pips: React.FC<{ t: number; sp: (at: number, cfg?: typeof SNAP) => number }> = ({ t, sp }) => (
  <g>
    {HEARD.map((h, i) => {
      const x = 540 + (i - 2.5) * 100, y0 = 332;
      const ok = ATTEMPTS.find((a) => a.ok && a.idx === i)!.t;
      const heard = t >= h.t, filled = t >= ok;
      const missing = i === 2 && t >= T.miss && t < T.fix;
      const appear = sp(0.06 + i * 0.04, BOUNCY);
      const pop = filled ? 1 + 0.55 * kick(t - ok, 8) : heard ? 1 + 0.35 * kick(t - h.t, 7) : 1;
      const dx = missing ? 7 * Math.sin((t - T.miss) * 70) * kick(t - T.miss, 5) : 0;
      const dy = -24 * hump(t, T.chord + i * 0.05, 0.4);
      const stroke = missing ? '#ff7a8d' : filled ? C.accent4 : heard ? C.accent3 : alpha(C.n500, 0.7);
      const fill = missing ? alpha('#ff7a8d', 0.3) : filled ? C.accent3 : heard ? alpha(C.accent3, 0.3) : alpha(C.accent, 0.12);
      return <circle key={i} cx={x + dx} cy={y0 + dy} r={24} fill={fill} stroke={stroke} strokeWidth={5} transform={`translate(${x} ${y0}) scale(${appear * pop}) translate(${-x} ${-y0})`} opacity={clamp(appear * 2)} />;
    })}
  </g>
);

// ===================================================================================================================================
export const ByEar: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sp = (at: number, cfg = SNAP) => spring({ frame: frame - at * fps, fps, config: cfg });

  // OVERSHOOT: the hand rises on one spring and drops on another; the difference is 1 while he listens, and wobbles at both ends.
  const ear = sp(0.12, SOFT) - sp(T.earDown, SNAP);
  const age = heardAge(t);

  // FOLLOW-THROUGH: the head is the body's motion, late. Plus its own beats: nod on every heard note, a quizzical tilt in the hold, a snap at "oh!".
  const holdTilt = smooth(T.miss + 0.08, T.miss + 0.28, t) * (1 - smooth(T.fix - 0.04, T.fix + 0.1, t));
  const headRot = 9 * ear + (lean(t - 0.09) - lean(t)) * 1.1 - 5 * kick(t - T.miss, 5) + 7 * holdTilt - 8 * wob(t - T.fix, 7, 26) - 9 * wob(t - T.chord, 5, 16);
  const headY = 7 * kick(age, 8) + (bobY(t - 0.08) - bobY(t)) * 0.8 + 4 * kick(t - T.miss, 6);

  const hand = handFor(t);
  const chord = t >= T.chord;
  const nearNote = ATTEMPTS.some((n) => n.ok && t >= n.t && t < n.t + 0.2) || (chord && t < T.chord + 0.6);
  const inHold = t >= T.miss && t < T.fix;
  const sweat = t >= T.miss + 0.02 && t < T.fix + 0.2 ? (t - T.miss - 0.02) / 0.55 : 0;

  const sy = squashY(t), sx = 1 + (1 - sy) * 0.8;

  // camera: slow push toward the listener, back off to play, a nudge in on the miss, a punch on the chord (+ shake on both)
  const zoomBase = kf(t, [[0, 1], [T.listen, 1], [T.earDown, 1.075], [T.play, 1.04], [T.miss, 1.04], [T.miss + 0.07, 1.07], [T.fix, 1.07], [T.fix + 0.2, 1.03], [T.chord - 0.2, 1.04]]);
  const zoom = t < T.chord ? zoomBase : 1.04 + 0.1 * sp(T.chord, BOUNCY) - 0.025 * smooth(T.chord + 0.6, 5, t);
  const shx = 8 * kick(t - T.miss, 9) * Math.sin(t * 95) + 7 * kick(t - T.chord, 8) * Math.cos(t * 88);
  const shy = 6 * kick(t - T.miss, 9) * Math.cos(t * 83) + 6 * kick(t - T.chord, 8) * Math.sin(t * 79);

  // the world goes quiet while he listens, comes back as he starts to play
  const dim = 0.34 * smooth(0.05, 0.4, t) * (1 - smooth(T.earDown, T.play, t));

  // finale lights (screen-blended, over the scene)
  const fin = clamp((t - T.chord) / 0.5);
  const flash = 0.5 * kick(t - T.chord, 6);
  const ringAge = t - T.chord;

  const pulse = kick(age, 10);
  const speakerGlow = clamp(age < 0.5 ? 1 - age * 2 : 0);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {!silent && <Audio src={staticFile('by-ear.wav')} />}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(${shx} ${shy}) translate(560 1120) scale(${zoom}) translate(-560 -1120)`}>
          <RoomBg t={t} />
          {dim > 0.01 && <rect width={1080} height={1920} fill="#07070f" opacity={dim} />}
          <Speaker pulse={pulse} glow={speakerGlow} />
          <Waves t={t} />
          <g transform={`translate(${PX} ${FEET}) scale(${sx} ${sy}) translate(${-PX} ${-FEET})`}>
            <Person
              x={PX} y={PY} scale={S} t={t} seed={2} {...TAB}
              mood={moodAt(t)} look={lookAt(t)} sweat={Math.min(1, sweat)}
              bob={bobY(t)} lean={lean(t)} head={{ rot: headRot, y: headY }}
              guitar={{ u: hand.u, strum: chord ? (t - T.chord) / 0.28 : hand.strum, jitter: inHold ? 4 : 0, glow: nearNote ? 1 : 0, ear }}
            />
          </g>
          <RoomFront />
          <Arrivals t={t} />

          {/* every played note pops out of the sound hole; the wrong one is red and drops */}
          {ATTEMPTS.map((n, i) => {
            const a = t - n.t;
            if (a < 0 || a > 0.9) return null;
            const u = easeOut(a / 0.9);
            return n.ok
              ? <MusicNote key={i} x={HOLE.x + Math.sin(i * 2.3) * 70 + 30 * u} y={HOLE.y - 40 - 240 * u} s={0.9 + 0.3 * kick(a, 8)} o={1 - u * u} rot={Math.sin(i) * 16} color={C.accent3} />
              : <MusicNote key={i} x={HOLE.x + 10} y={HOLE.y - 60 - 60 * Math.sin(Math.PI * clamp(a / 0.5)) + 90 * u * u} s={1.05} o={1 - u} rot={20 * u} color="#ff7a8d" />;
          })}

          <Bubble cx={330} cy={870} lines={['hm…']} tx={470} ty={1000} p={t >= T.miss + 0.06 && t < T.fix ? sp(T.miss + 0.06) : 0} size={70} />
          <Bubble cx={330} cy={870} lines={['oh!']} tx={470} ty={1000} p={t >= T.fix && t < T.fix + 0.5 ? sp(T.fix, BOUNCY) : 0} size={78} fill="#ecebff" />

          {/* finale: shock ring from the strings, a burst of notes and hearts */}
          {ringAge > 0 && ringAge < 0.55 && <circle cx={HOLE.x} cy={HOLE.y} r={40 + ringAge * 1400} fill="none" stroke={C.accent4} strokeWidth={22 * (1 - ringAge / 0.55)} opacity={0.75 * (1 - ringAge / 0.55)} />}
          <Floaters t={t} t0={T.chord + 0.02} t1={5} cx={540} cy={1230} spread={300} every={0.07} kind="mix" rise={600} size={1.25} />
        </g>

        {/* HUD: not in the camera group, so it stays put */}
        <Pips t={t} sp={sp} />
        {t >= T.chord + 0.05 && (
          <g transform={`translate(540 520) scale(${sp(T.chord + 0.05, BOUNCY)})`}>
            <circle r={58} fill={C.accent3} stroke={C.bg} strokeWidth={8} />
            <path d="M -22 2 L -7 17 L 23 -14" fill="none" stroke={C.bg} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>

      {/* light: a warm bloom on the chord, then two moving party beams */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', background: `radial-gradient(ellipse 800px 800px at 52% 70%, rgba(255,190,120,${flash + 0.16 * fin}) 0%, transparent 70%)` }} />
        {fin > 0.01 && [0, 1].map((i) => (
          <div key={i} style={{ position: 'absolute', left: i ? 600 + 100 * Math.sin(t * 2.3 + 1) : -120 + 100 * Math.sin(t * 1.9), top: 400, width: 560, height: 1100, mixBlendMode: 'screen', transform: `rotate(${i ? -14 : 14}deg)`,
            background: `radial-gradient(closest-side, ${i ? 'rgba(90,220,255,' : 'rgba(255,90,170,'}${0.3 * fin}) 0%, transparent 100%)` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 85% 70% at 50% 62%, transparent 45%, rgba(6,5,18,${0.35 * (1 - fin) + 0.18}) 100%)` }} />
      </div>

      <Caption lines={['Listen.']} from={0.2} to={T.earDown + 0.15} top={150} size={110} />
      <Caption lines={['Now *play it back.*']} from={T.earDown + 0.15} to={T.chord - 0.1} top={150} size={96} />
      <Caption lines={['*Nailed it.*']} from={T.chord + 0.05} to={5.5} top={150} size={110} />
    </AbsoluteFill>
  );
};
void FPS;
