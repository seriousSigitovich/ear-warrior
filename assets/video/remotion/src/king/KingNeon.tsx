// "97% of guitarists can't play this by ear" — #56's neon highway (src/neon/Stage.tsx), 10.5 s, 1080×1920, 60 fps, cut to hook · the
// melody once · your turn: no countdown, no separate answer. The comets fly down their strings and land on their frets, unnumbered, and
// stay lit; after the last note the camera cranes over to the top-down tab view. A pure function of the frame; every time comes from
// ../../king/story.mjs, which also lays the soundtrack.
//   0–2.4 hook · 2.4–6.6 hear the melody · 6.6–10.5 crane over the board, your turn, comment the notes
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { N, FONT, rgba } from '../neon/theme';
import { type Pose, makeCam, aim, lerpPose, v3 } from '../neon/cam';
import { Stage, type Hit, noteX } from '../neon/Stage';
import { POP, SNAP, SOFT, kick, lin, ramp, springAt, type SpringCfg } from '../ten/motion';
import { lerp, clamp } from '../util';
import { T, STEP, HEARD, HOOK_NOTE } from '../../king/story.mjs';

const CRANE: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };       // the over-the-top move, as #56: fast, one visible overshoot

// --- the camera ------------------------------------------------------------------------------------------------------------------------
const pose = (pos: [number, number, number], target: [number, number, number], f: number, roll = 0): Pose => ({ pos, ...aim(pos, target), roll, f });
const HOOK_AT: [number, number, number] = [noteX(HOOK_NOTE.fret), 0.2, HOOK_NOTE.string - 2.5];
const P_HOOK = pose([1.4, 1.5, -4.1], HOOK_AT, 900, 0.1);                // low and close, on the impact
const P_ROAD = pose([-6.2, 4.6, 0], [4, 0, 0], 1050);                      // down the neck towards the nut; frets 0–4 mid-frame
const P_TOP: Pose = { pos: [2.05, 14.6, 1.2], yaw: -Math.PI / 2, pitch: -Math.PI / 2, roll: 0, f: 1150 };   // straight down, a tab

function cameraAt(t: number, hits: Hit[]): Pose {
  let p = lerpPose(P_HOOK, P_ROAD, springAt(t, 0.22, SOFT));               // hold on the hit, then pull back to reveal the road
  // after the last note: a short lean back (anticipation), then the crane over the top
  const pre = Math.sin(Math.PI * clamp((t - T.hold) / 0.22)) * (t < T.hold + 0.22 ? 1 : 0);
  p = lerpPose(p, P_TOP, springAt(t, T.hold + 0.2, CRANE));
  p = { ...p, pos: v3.add(p.pos, [-0.6 * pre, 0.25 * pre, 0]) };
  // never still: a slow drift while on the road
  const road = 1 - clamp((t - T.hold - 0.2) / 0.4);
  p = { ...p, yaw: p.yaw + road * 0.025 * Math.sin(t * 0.7), pos: v3.add(p.pos, [0, road * 0.12 * Math.sin(t * 0.9), road * 0.28 * Math.sin(t * 0.45)]) };
  // secondary action: each landing nudges the camera forward
  const c = makeCam(p);
  let push = 0;
  for (const h of hits) { const a = t - h.land; if (a >= 0 && a < 0.5) push += (h.big ? 0.5 : 0.18) * kick(a, 10); }
  return { ...p, pos: v3.add(p.pos, v3.mul(c.fw, push)) };
}

/** The board's notes, unnumbered, on their own string and fret; they stay to the end. A note landing on a lit spot replaces the older one. */
const HITS: Hit[] = [
  { id: 'hook', string: HOOK_NOTE.string, fret: HOOK_NOTE.fret, land: 0, from: 'lane', label: '', gone: 1.55, big: true },
  ...HEARD.map((n, i): Hit => {
    const next = HEARD.slice(i + 1).find((m) => m.string === n.string && m.fret === n.fret);
    return { id: `h${i}`, string: n.string, fret: n.fret, land: n.t, from: 'lane', label: '', gone: next ? next.t - 0.06 : undefined, hotFor: STEP };
  }),
];

// --- type ------------------------------------------------------------------------------------------------------------------------------
type Seg = { text: string; color?: string };
/** Kinetic type with an RGB split, as #56: each letter springs up with an overshoot, its red and cyan ghosts snapping together as it lands. */
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

/** "note n of 13" while listening. */
const Pips: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const show = springAt(t, T.listen + 0.15, SNAP) * (1 - ramp(t, T.hold, T.hold + 0.25));
  if (show < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 16, opacity: show, transform: `translateY(${(1 - show) * 30}px)` }}>
      {HEARD.map((n) => {
        const p = springAt(t, n.t, POP);
        return <div key={n.order} style={{ width: 22, height: 22, borderRadius: 99, border: `3px solid ${rgba(N.lime, 0.55)}`, background: rgba(N.lime, Math.min(1, p)), transform: `scale(${1 + 0.45 * Math.min(1, p) * kick(t - n.t, 6)})`, boxShadow: p > 0.1 ? `0 0 ${20 * Math.min(1, p)}px ${rgba(N.lime, 0.8)}` : 'none' }} />;
      })}
    </div>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const KingNeon: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = makeCam(cameraAt(t, HITS));
  const lit = HITS.filter((h) => h.id !== 'hook' && t >= h.land && (h.gone === undefined || t < h.gone)).map((h) => h.fret);

  // glitch: the opening hit and "your turn"
  const glitch = Math.max(0.5 * kick(t, 9) * (t < 0.25 ? 1 : 0), t >= T.cta && t < T.cta + 0.4 ? 0.45 * kick(t - T.cta, 9) : 0);
  const flash = 0.25 * kick(t, 14) + 0.18 * kick(t - T.cta, 12);
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
        <Stage t={t} cam={cam} hits={HITS} waves={[T.sweep]} fretLit={lit} names={ramp(t, T.hold + 0.5, T.hold + 0.9)} scroll={1.2 * t} urgency={0} />

        {/* scrims behind the text so it reads over the road */}
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(5,1,12,0.6) 0%, rgba(5,1,12,0.0) 40%, rgba(5,1,12,0.0) 72%, rgba(5,1,12,0.5) 100%)' }} />

        {/* scene 1 · the hook */}
        <Chip t={t} at={-0.1} y={230} text="ONE LISTEN · NO TABS" outAt={2.2} />
        <Type t={t} at={-0.14} y={430} size={78} lines={[[{ text: '97%', color: N.lime }, { text: ' OF GUITARISTS' }]]} outAt={2.2} glitch={glitch} />
        <Type t={t} at={0.2} y={600} size={124} lines={[[{ text: 'CAN’T PLAY THIS' }], [{ text: 'BY ' }, { text: 'EAR', color: N.lime }]]} outAt={2.2} glitch={glitch} stagger={0.018} />

        {/* scene 2 · hear the melody, once */}
        <Type t={t} at={T.listen + 0.08} y={300} size={96} lines={[[{ text: 'LISTEN ' }, { text: 'ONCE', color: N.lime }]]} outAt={T.hold} />
        <Pips t={t} y={420} />

        {/* scene 3 · your turn */}
        <Type t={t} at={T.cta} y={330} size={150} lines={[[{ text: 'YOUR ' }, { text: 'TURN', color: N.lime }]]} stagger={0.02} glitch={glitch} />
        <Type t={t} at={T.sub} y={470} size={40} weight={700} tracking={0.12} lines={[[{ text: 'NO TABS. JUST YOUR EARS.', color: N.dim }]]} stagger={0.012} rise={0.5} glow="#000" />
        <Type t={t} at={T.comment} y={1600} size={64} lines={[[{ text: 'COMMENT THE NOTES ' }, { text: '↓', color: N.lime }]]} stagger={0.016} tracking={-0.005} />
      </AbsoluteFill>

      {/* light: the flashes, the closing sweep, vignette and grain */}
      <AbsoluteFill style={{ background: '#fff', opacity: flash, mixBlendMode: 'screen' }} />
      {t >= T.sweep && t < T.sweep + 0.6 && (
        <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
          <div style={{ position: 'absolute', top: -200, bottom: -200, left: sweepX, width: 240, transform: 'skewX(-18deg)', background: `linear-gradient(90deg, transparent, ${rgba(N.lime, 0.22)}, rgba(255,255,255,0.3), ${rgba(N.lime, 0.22)}, transparent)` }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 48%, transparent 55%, rgba(0,0,0,0.6) 100%)' }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.18 }}>
        <filter id="grainK" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={1 + (Math.floor(frame / 2) % 24)} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1080" height="1920" filter="url(#grainK)" />
      </svg>
      {!silent && <Audio src={staticFile('king-neon.wav')} />}
    </AbsoluteFill>
  );
};
