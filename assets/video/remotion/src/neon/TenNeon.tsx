// "Can you play this by ear?" — the neon cut, 20 s, 1080×1920, 60 fps. Same five scenes as #55 (src/ten/TenSecond.tsx), new picture: the neck
// is a 3-D highway on a night road (src/neon/Stage.tsx), notes fly down their strings as comets and land on their sound, the countdown slams
// numerals in from depth, and on "time's up" the camera cranes over to a top-down tab view for the answer. A pure function of the frame;
// every time comes from ../../neon/story.mjs, which also lays the soundtrack.
//   0–2 hook · 2–5.7 hear the melody · 5.7–12.7 find the notes (7 → 0) · 12.7–16.9 time's up + the answer · 16.9–20 comment call to action
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { N, FONT, rgba } from './theme';
import { type Pose, makeCam, aim, lerpPose, v3 } from './cam';
import { Stage, type Hit, noteX } from './Stage';
import { POP, SNAP, SOFT, kick, lin, ramp, springAt, type SpringCfg } from '../ten/motion';
import { lerp, clamp } from '../util';
import { T, STEP, HEARD, ANSWER, HOOK_NOTE, TICKS, COUNT_FROM, remaining, type TimedNote } from '../../neon/story.mjs';

const CRANE: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };       // the over-the-top move: fast, one visible overshoot

// --- the camera ------------------------------------------------------------------------------------------------------------------------
const pose = (pos: [number, number, number], target: [number, number, number], f: number, roll = 0): Pose => ({ pos, ...aim(pos, target), roll, f });
const HOOK_AT: [number, number, number] = [noteX(HOOK_NOTE.fret), 0.2, HOOK_NOTE.string - 2.5];
const P_HOOK = pose([1.4, 1.5, -4.1], HOOK_AT, 900, 0.1);                // low and close, on the impact
const P_ROAD = pose([-3, 3.6, 0], [5, 0, 0], 950);                         // down the neck towards the nut; frets 0–3 mid-frame
const P_PUSH = pose([-1.6, 3.3, 0], [5.4, 0, 0], 980);                     // the countdown creeps in
const P_TOP: Pose = { pos: [2.05, 13.9, 1.2], yaw: -Math.PI / 2, pitch: -Math.PI / 2, roll: 0, f: 1150 };   // straight down, a tab
const P_CTA: Pose = { pos: [2.05, 15.5, -4.3], yaw: -Math.PI / 2, pitch: -Math.PI / 2, roll: 0, f: 1150 };

function cameraAt(t: number, hits: Hit[]): Pose {
  let p: Pose;
  if (t < T.challenge) p = lerpPose(P_HOOK, P_ROAD, springAt(t, 0.22, SOFT));             // hold on the hit, then pull back to reveal the road
  else if (t < T.reveal + 0.1) p = lerpPose(P_ROAD, P_PUSH, ramp(t, T.challenge, T.reveal));
  else {
    // after the hold: a short lean back (anticipation), then the crane over the top
    const pre = Math.sin(Math.PI * clamp((t - (T.reveal + 0.1)) / 0.22)) * (t < T.reveal + 0.32 ? 1 : 0);
    const k = springAt(t, T.reveal + 0.3, CRANE);
    p = lerpPose(P_PUSH, P_TOP, k);
    p = { ...p, pos: v3.add(p.pos, [-0.6 * pre, 0.25 * pre, 0]) };
    if (t > T.cta) p = lerpPose(p, P_CTA, springAt(t, T.cta, SOFT));
  }
  // never still: a slow drift while on the road
  const road = 1 - clamp((t - T.reveal - 0.3) / 0.4);
  p = { ...p, yaw: p.yaw + road * 0.025 * Math.sin(t * 0.7), pos: v3.add(p.pos, [0, road * 0.12 * Math.sin(t * 0.9), road * 0.28 * Math.sin(t * 0.45)]) };
  // secondary action: each landing nudges the camera, the countdown trembles in its last three seconds, "time's up" shakes it
  const c = makeCam(p);
  let push = 0;
  for (const h of hits) { const a = t - h.land; if (a >= 0 && a < 0.5) push += (h.big ? 0.5 : 0.18) * kick(a, 10); }
  const urg = t > T.reveal - 3 && t < T.reveal ? (t - (T.reveal - 3)) / 3 : 0;
  const sa = t - T.reveal, shake = sa >= 0 ? Math.exp(-sa * 8) : 0;
  return {
    ...p,
    pos: v3.add(p.pos, v3.mul(c.fw, push)),
    roll: p.roll + 0.006 * urg * Math.sin(t * 47) + 0.05 * shake * Math.cos(sa * 64),
    yaw: p.yaw + 0.004 * urg * Math.sin(t * 39 + 1) + 0.025 * shake * Math.sin(sa * 71),
  };
}

/** Distance the floor grid has rolled towards the camera: ~1.2 u/s, accelerating through the countdown, easing after it. */
function scrollAt(t: number) {
  const a = Math.min(t, T.challenge), b = clamp(t - T.challenge, 0, T.reveal - T.challenge), c = Math.max(0, t - T.reveal), D = T.reveal - T.challenge;
  return 1.2 * a + 1.2 * b + (7 * b ** 3) / (3 * D * D) + 0.8 * c;
}

/** The board's notes. A note that lands on a spot already lit replaces the older one there. */
function buildHits(): Hit[] {
  const list = (notes: TimedNote[], from: Hit['from'], prefix: string, clearAt?: number): Hit[] => notes.map((n, i) => {
    const next = notes.slice(i + 1).find((m) => m.string === n.string && m.fret === n.fret);
    const gone = Math.min(next ? next.t - 0.06 : Infinity, clearAt === undefined ? Infinity : clearAt + i * 0.025);
    return { id: `${prefix}${i}`, string: n.string, fret: n.fret, land: n.t, from, label: String(i + 1), gone: Number.isFinite(gone) ? gone : undefined, hotFor: STEP };
  });
  return [
    { id: 'hook', string: HOOK_NOTE.string, fret: HOOK_NOTE.fret, land: 0, from: 'lane', label: '', gone: 1.55, big: true },
    ...list(HEARD, 'lane', 'h', T.clearAt),
    ...list(ANSWER, 'sky', 'a'),
  ];
}
const HITS = buildHits();

// --- type ------------------------------------------------------------------------------------------------------------------------------
type Seg = { text: string; color?: string };
/**
 * Kinetic type with an RGB split: each letter springs up from below with an overshoot; while it moves its red and cyan ghosts sit apart and
 * snap together as it lands (and jump apart again on a glitch).
 */
const Type: React.FC<{
  t: number; at: number; lines: Seg[][]; size: number; y: number; weight?: number; tracking?: number; stagger?: number; outAt?: number;
  rise?: number; glitch?: number; glow?: string;
}> = ({ t, at, lines, size, y, weight = 900, tracking = -0.02, stagger = 0.022, outAt, rise = 0.9, glitch = 0, glow }) => {
  const out = outAt === undefined ? 0 : ramp(t, outAt, outAt + 0.22);
  if (t < at - 0.01 || out >= 1) return null;
  let idx = 0;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, transform: `translateY(-50%) translateY(${-70 * out}px) scale(${1 + 0.15 * out})`, opacity: 1 - out, textAlign: 'center', fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: 1.02, letterSpacing: `${tracking}em`, whiteSpace: 'nowrap' }}>
      {lines.map((line, li) => (
        <div key={li}>
          {line.map((seg, si) => (
            <span key={si} style={{ color: seg.color ?? N.white }}>
              {Array.from(seg.text).map((ch, ci) => {
                const p = springAt(t, at + (idx++) * stagger, POP), d = size * (0.12 * (1 - Math.min(1, p)) + 0.05 * glitch);
                const col = seg.color ?? N.white;
                return (
                  <span key={ci} style={{
                    display: 'inline-block', whiteSpace: 'pre', opacity: Math.min(1, p * 4), transformOrigin: '50% 80%',
                    transform: `translateY(${(1 - p) * size * rise}px) scale(${0.55 + 0.45 * p})`,
                    textShadow: `${d}px 0 0 ${rgba(N.pink, 0.8)}, ${-d}px 0 0 ${rgba(N.cyan, 0.75)}, 0 0 ${size * 0.35}px ${rgba(glow ?? (col === N.white ? '#9F7BFF' : col), 0.55)}`,
                  }}>{ch}</span>
                );
              })}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

const Chip: React.FC<{ t: number; at: number; y: number; text: string; outAt?: number }> = ({ t, at, y, text, outAt }) => {
  const p = springAt(t, at, SNAP), out = outAt === undefined ? 0 : ramp(t, outAt, outAt + 0.22);
  if (t < at - 0.2 || out >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 3) * (1 - out), transform: `translateY(${(1 - p) * -40 - out * 50}px) scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 32px', borderRadius: 999, border: `2px solid ${rgba(N.lime, 0.8)}`, background: 'rgba(10,4,20,0.6)', fontFamily: FONT, fontWeight: 800, fontSize: 34, letterSpacing: '0.16em', color: N.lime, boxShadow: `0 0 40px ${rgba(N.lime, 0.25)}, inset 0 0 20px ${rgba(N.lime, 0.12)}` }}>
        <span style={{ width: 12, height: 12, borderRadius: 99, background: N.lime, boxShadow: `0 0 14px ${N.lime}` }} />
        {text}
      </div>
    </div>
  );
};

/** "note n of 10" while listening. */
const Pips: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const show = springAt(t, T.listen + 0.15, SNAP) * (1 - ramp(t, T.clearAt - 0.05, T.clearAt + 0.2));
  if (show < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 18, opacity: show, transform: `translateY(${(1 - show) * 30}px)` }}>
      {HEARD.map((n) => {
        const p = springAt(t, n.t, POP);
        return <div key={n.order} style={{ width: 24, height: 24, borderRadius: 99, border: `3px solid ${rgba(N.lime, 0.55)}`, background: rgba(N.lime, Math.min(1, p)), transform: `scale(${1 + 0.45 * Math.min(1, p) * kick(t - n.t, 6)})`, boxShadow: p > 0.1 ? `0 0 ${20 * Math.min(1, p)}px ${rgba(N.lime, 0.8)}` : 'none' }} />;
      })}
    </div>
  );
};

/** The answer as note names; each lights as it sounds. */
const NameRow: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const show = springAt(t, T.reveal + 0.7, SNAP) * (1 - ramp(t, T.cta, T.cta + 0.25));
  if (show < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 8, opacity: show, transform: `translateY(${(1 - show) * 40}px)` }}>
      {ANSWER.map((n) => {
        const lit = t >= n.t, p = springAt(t, n.t, POP);
        return <div key={n.order} style={{ width: 80, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 27, border: `2px solid ${lit ? N.lime : 'rgba(255,255,255,0.2)'}`, background: lit ? N.lime : 'rgba(10,4,20,0.5)', color: lit ? '#0b1204' : 'rgba(255,255,255,0.42)', transform: `scale(${lit ? 0.9 + 0.1 * p + 0.14 * kick(t - n.t, 8) : 1})`, boxShadow: lit ? `0 0 ${30 * kick(t - n.t, 3)}px ${rgba(N.lime, 0.8)}` : 'none' }}>{n.name}</div>;
      })}
    </div>
  );
};

/** The countdown: a neon dial that drains, and a numeral that slams in from depth on every second (the soundtrack's ticks). */
const Countdown: React.FC<{ t: number; cy: number; glitch: number }> = ({ t, cy, glitch }) => {
  if (t < T.challenge - 0.1 || t > T.reveal + 0.35) return null;
  const left = remaining(t), num = Math.min(COUNT_FROM, Math.ceil(left - 1e-6)), since = (t - T.challenge) - Math.floor(t - T.challenge);
  const urgent = left <= 3, col = urgent ? N.pink : N.lime, frac = left / COUNT_FROM;
  const enter = springAt(t, T.challenge - 0.05, POP), boom = lin(t, T.reveal, T.reveal + 0.25);
  const slam = springAt(t, t - since, SNAP);                                    // this second's numeral: 0 → 1 with overshoot
  const z = 1 + 1.7 * (1 - slam), blur = 14 * Math.max(0, 1 - slam * 1.4), beat = kick(since, 7);
  const R = 205, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'absolute', left: 540 - 300, top: cy - 300, width: 600, height: 600, transform: `scale(${(0.5 + 0.5 * enter) * (1 + boom * 0.6)})`, opacity: Math.min(1, enter * 2) * (1 - boom) }}>
      <svg width={600} height={600} viewBox="-300 -300 600 600" style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: `drop-shadow(0 0 ${14 + 20 * beat}px ${rgba(col, 0.75)})` }}>
        <circle r={R + 52 + 26 * beat} fill="none" stroke={rgba(col, 0.1 + 0.4 * beat)} strokeWidth={3} />
        <g transform={`rotate(${t * 40})`}><circle r={R + 30} fill="none" stroke={rgba(N.white, 0.18)} strokeWidth={3} strokeDasharray="4 22" /></g>
        <circle r={R} fill="rgba(10,4,22,0.55)" stroke="rgba(255,255,255,0.1)" strokeWidth={18} />
        <circle r={R} fill="none" stroke={col} strokeWidth={18} strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 280, letterSpacing: '-0.04em', color: urgent ? N.pink : N.white, fontVariantNumeric: 'tabular-nums', transform: `scale(${z})`, opacity: Math.min(1, slam * 3), filter: blur > 0.3 ? `blur(${blur}px)` : undefined, textShadow: `${10 * (1 - slam) + 8 * glitch}px 0 0 ${rgba(N.pink, 0.85)}, ${-10 * (1 - slam) - 8 * glitch}px 0 0 ${rgba(N.cyan, 0.8)}, 0 0 60px ${rgba(col, 0.6)}` }}>
        {left <= 0 ? 0 : num}
      </div>
    </div>
  );
};

const CtaChips: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const items = [{ text: '10/10', w: 220 }, { text: 'ALMOST', w: 290 }, { text: 'TRY AGAIN', w: 360 }];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 20, transform: 'translateY(-50%)' }}>
      {items.map((c, i) => {
        const p = springAt(t, T.chips[i], POP), flash = kick(t - (T.sweep + 0.08 * i), 6), breathe = t > T.sweep + 0.5 ? 0.5 + 0.5 * Math.sin((t - T.sweep) * 2.4 - i * 1.1) : 0;
        return <div key={c.text} style={{ width: c.w, height: 92, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 44, letterSpacing: '0.03em', color: flash > 0.3 ? N.lime : N.white, opacity: Math.min(1, p * 3), border: `3px solid ${rgba(N.lime, 0.35 + 0.6 * flash + 0.14 * breathe)}`, background: 'rgba(10,4,22,0.65)', transform: `translateY(${(1 - p) * 60}px) scale(${(0.6 + 0.4 * p) * (1 + 0.05 * flash + 0.012 * breathe)})`, boxShadow: `0 0 ${18 + 34 * flash}px ${rgba(N.lime, 0.35 + 0.3 * flash)}` }}>{c.text}</div>;
      })}
    </div>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const TenNeon: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = makeCam(cameraAt(t, HITS));

  const lit = HITS.filter((h) => h.id !== 'hook' && t >= h.land && (h.gone === undefined || t < h.gone)).map((h) => h.fret);
  // glitch: the opening hit, a flick on every countdown second, the big one on "time's up"
  const sinceTick = TICKS.reduce((a, k) => (t >= k ? Math.min(a, t - k) : a), 9);
  const glitch = Math.max(0.5 * kick(t, 9) * (t < 0.25 ? 1 : 0), t > T.challenge + 0.5 && t < T.reveal ? 0.35 * kick(sinceTick, 30) : 0, t >= T.reveal ? kick(t - T.reveal, 7) * (t < T.reveal + 0.5 ? 1 : 0) : 0);
  const urgent = t > T.reveal - 3 && t < T.reveal ? 1 : 0;
  const flash = (t >= T.reveal ? 0.55 * kick(t - T.reveal, 12) : 0) + 0.25 * kick(t, 14);
  const edge = urgent * kick(sinceTick, 5);
  const sweepX = lerp(-500, 1700, lin(t, T.sweep, T.sweep + 0.55));

  return (
    <AbsoluteFill style={{ background: N.bg, fontFamily: FONT, overflow: 'hidden' }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="glitch" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0004 0.03" numOctaves={1} seed={1 + (Math.floor(frame / 2) % 50)} result="n" />
          <feComponentTransfer in="n" result="bands"><feFuncR type="discrete" tableValues="0.2 0.5 0.5 0.8 0.5 0.35 0.5" /><feFuncG type="linear" slope={0} intercept={0.5} /></feComponentTransfer>
          <feDisplacementMap in="SourceGraphic" in2="bands" scale={140 * glitch} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r0" />
          <feOffset in="r0" dx={18 * glitch} result="r" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b0" />
          <feOffset in="b0" dx={-18 * glitch} result="b" />
          <feBlend in="r" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b" mode="screen" />
        </filter>
      </svg>

      <AbsoluteFill style={{ filter: glitch > 0.03 ? 'url(#glitch)' : undefined }}>
        <Stage t={t} cam={cam} hits={HITS} waves={TICKS} fretLit={lit} names={ramp(t, T.reveal + 0.6, T.reveal + 1)} scroll={scrollAt(t)} urgency={urgent} />

        {/* scrim behind the upper text so it reads over the road */}
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,1,12,0.55) 0%, rgba(5,1,12,0.0) 42%)' }} />

        {/* scene 1 · the hook */}
        <Chip t={t} at={-0.1} y={210} text="10-SECOND CHALLENGE" outAt={1.78} />
        <Type t={t} at={-0.14} y={500} size={112} lines={[[{ text: 'CAN YOU PLAY' }], [{ text: 'THIS ' }, { text: 'BY EAR?', color: N.lime }]]} outAt={1.78} glitch={glitch} />

        {/* scene 2 · hear the melody */}
        <Type t={t} at={T.listen + 0.08} y={330} size={96} lines={[[{ text: 'LISTEN ' }, { text: 'CLOSELY', color: N.lime }]]} outAt={T.clearAt - 0.1} />
        <Pips t={t} y={455} />

        {/* scene 3 · find the notes */}
        <Type t={t} at={T.challenge + 0.02} y={170} size={74} lines={[[{ text: 'NOW FIND THE ' }, { text: 'NOTES', color: N.lime }]]} outAt={T.reveal - 0.2} stagger={0.016} glitch={glitch} />
        <Countdown t={t} cy={500} glitch={glitch} />
        <Type t={t} at={T.challenge + 0.45} y={840} size={38} weight={700} tracking={0.12} lines={[[{ text: 'NO TABS. JUST YOUR EARS.', color: N.dim }]]} outAt={T.reveal - 0.2} stagger={0.012} rise={0.5} glow="#000" />

        {/* scene 4 · time's up, the answer */}
        <Type t={t} at={T.reveal + 0.02} y={560} size={150} lines={[[{ text: 'TIME’S UP' }]]} outAt={T.reveal + 0.7} stagger={0.012} rise={1.1} glitch={glitch} glow={N.pink} />
        <Chip t={t} at={T.reveal + 0.6} y={640} text="THE ANSWER" outAt={T.cta - 0.05} />
        <NameRow t={t} y={1440} />

        {/* scene 5 · comment call to action */}
        <Type t={t} at={T.q} y={1110} size={150} lines={[[{ text: 'DID YOU' }], [{ text: 'GET ' }, { text: 'IT?', color: N.lime }]]} stagger={0.02} />
        <Type t={t} at={T.comment} y={1392} size={58} lines={[[{ text: 'COMMENT YOUR SCORE ' }, { text: '↓', color: N.lime }]]} stagger={0.016} tracking={-0.005} />
        <CtaChips t={t} y={1540} />
      </AbsoluteFill>

      {/* light: urgency pulse at the edges, the flashes, the closing sweep, vignette and grain */}
      {edge > 0.01 && <AbsoluteFill style={{ boxShadow: `inset 0 0 ${160 + 120 * edge}px ${rgba(N.pink, 0.55 * edge)}` }} />}
      <AbsoluteFill style={{ background: '#fff', opacity: flash, mixBlendMode: 'screen' }} />
      {t >= T.sweep && t < T.sweep + 0.6 && (
        <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
          <div style={{ position: 'absolute', top: -200, bottom: -200, left: sweepX, width: 240, transform: 'skewX(-18deg)', background: `linear-gradient(90deg, transparent, ${rgba(N.lime, 0.22)}, rgba(255,255,255,0.3), ${rgba(N.lime, 0.22)}, transparent)` }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 48%, transparent 55%, rgba(0,0,0,0.6) 100%)' }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.18 }}>
        <filter id="grainN" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={1 + (Math.floor(frame / 2) % 24)} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1080" height="1920" filter="url(#grainN)" />
      </svg>
      {!silent && <Audio src={staticFile('ten-neon.wav')} />}
    </AbsoluteFill>
  );
};

