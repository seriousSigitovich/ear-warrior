// "Can you play this by ear?" — the bouncing-ball Spring cut, 10 s, 1080×1920, 120 fps. Winter's minimal look (one flat dark-purple ground,
// white, hairlines, thin type) with more motion: a white ball hops from note to note, its height is the pitch, every landing ripples the
// pitch line it hits. No countdown and no answer — the screen shows the shape of the tune, never its notes.
// A pure function of the frame; every time comes from ../../spring/story.mjs, which also lays the soundtrack.
//   0–2 hook · 2–6 the melody, once · 5.3 pull back to the whole shape · 6.15 it folds into the ball, pops · 6.6–10 your turn
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { POP, SOFT, kick, ramp, springAt, wob } from '../ten/motion';
import { easeOut, lerp, rng } from '../util';
import { W, FONT, Line, Caps, presence } from '../winter/TenWinter';
import { T, NOTES, END, BEAT, type TimedNote } from '../../spring/story.mjs';

const R = 27;                                   // the ball
const SPEED = 240;                              // world px per second of music: the whole tune is 780 px wide
const MID_Y = 1100;                             // the camera's centre line
/** Pitch → the y of its hairline (the ball's contact point). A semitone is 62 px; E4 sits lowest, B4 highest. */
const lineY = (midi: number) => MID_Y - (midi - 67.5) * 62;
const GRID = [64, 65, 66, 67, 68, 69, 70, 71];
const noteX = (n: TimedNote) => (n.t - T.melodyAt) * SPEED;
const X0 = noteX(NOTES[0]), Y0 = lineY(NOTES[0].midi);
const LAST = NOTES[NOTES.length - 1];
const IDLE_END = 1.5;                            // the hook's tempo bounces stop here; the wind-up runs to T.launch
const isBig = (n: TimedNote) => n.beats >= 1;

// --- the ball's flight: one parabola per hop, landing on the exact onset -----------------------------------------------------------------
type Hop = { t0: number; t1: number; x0: number; y0: number; x1: number; y1: number; h: number };
const HOPS: Hop[] = [
  { t0: T.launch, t1: NOTES[0].t, x0: X0, y0: Y0, x1: X0, y1: Y0, h: 520 },                // the count-in hop off the hook
  ...NOTES.slice(1).map((n, i) => {
    const a = NOTES[i];
    return { t0: a.t, t1: n.t, x0: noteX(a), y0: lineY(a.midi), x1: noteX(n), y1: lineY(n.midi), h: 30 + 260 * (n.t - a.t) };
  }),
];
/** The ball's contact point (bottom) in world space. */
function contact(t: number): { x: number; y: number } {
  if (t < IDLE_END) return { x: X0, y: Y0 - 16 * Math.abs(Math.sin((Math.PI * t) / BEAT)) };   // little bounces in tempo under the hook
  if (t < T.launch) return { x: X0, y: Y0 };
  const h = HOPS.find((p) => t >= p.t0 && t < p.t1);
  if (!h) return { x: noteX(LAST), y: lineY(LAST.midi) };
  const u = (t - h.t0) / (h.t1 - h.t0);
  return { x: lerp(h.x0, h.x1, u), y: lerp(h.y0, h.y1, u) - 4 * h.h * u * (1 - u) };
}
/** Every landing, with how hard it squashes. */
const LANDINGS = [
  ...[0, 1, 2, 3].map((k) => ({ t: k * BEAT, sq: 0.14 })),
  ...NOTES.map((n) => ({ t: n.t, sq: isBig(n) ? 0.5 : 0.36 })),
];

/** The ball: stretched along its speed in the air, squashed flat (anchored at the contact point) as it lands, wound up before the launch. */
const Ball: React.FC<{ x: number; y: number; vx: number; vy: number; sq: number; scale: number }> = ({ x, y, vx, vy, sq, scale }) => {
  if (scale < 0.01) return null;
  const r = R * scale;
  if (Math.abs(sq) > 0.03) {
    const ry = r * (1 - sq), rx = r * (1 + 0.7 * sq);
    return <ellipse cx={x} cy={y - ry} rx={rx} ry={ry} fill={W.ink} />;
  }
  const s = 1 + Math.min(0.42, Math.hypot(vx, vy) / 5200), ang = (Math.atan2(vy, vx) * 180) / Math.PI;
  return <ellipse cx={0} cy={0} rx={r * s} ry={r / s} fill={W.ink} transform={`translate(${x} ${y - r}) rotate(${ang})`} />;
};

/** A pitch hairline. Every landing on it sends a damped ripple out both ways and lights the line for a moment. */
const PitchLine: React.FC<{ t: number; midi: number; toScreen: (x: number, y: number) => [number, number]; zoom: number; fade: number }> = ({ t, midi, toScreen, zoom, fade }) => {
  const hits = NOTES.filter((n) => n.midi === midi && t >= n.t && t - n.t < 1.4);
  const idleHits = midi === NOTES[0].midi ? LANDINGS.slice(0, 4).filter((l) => t >= l.t && t - l.t < 1.4).map((l) => ({ t: l.t, x: X0, a: 3 })) : [];
  const all = [...hits.map((n) => ({ t: n.t, x: noteX(n), a: isBig(n) ? 16 : 10 })), ...idleHits];
  const glow = all.reduce((g, h) => Math.max(g, kick(t - h.t, 3.5) * (h.a > 3 ? 1 : 0.3)), 0);
  const [, sy] = toScreen(0, lineY(midi));
  const opacity = (0.13 + 0.36 * glow) * fade;
  if (!all.length) return <line x1={0} x2={1080} y1={sy} y2={sy} stroke={W.ink} strokeWidth={1.5} opacity={opacity} />;
  const pts: string[] = [];
  for (let sx = -12; sx <= 1092; sx += 12) {
    let d = 0;
    for (const h of all) {
      const age = t - h.t, [hx] = toScreen(h.x, 0), dx = Math.abs(sx - hx) / zoom, front = 900 * age;
      if (dx > front) continue;
      d += h.a * Math.exp(-age * 4.5) * Math.exp(-dx / 520) * Math.sin(0.05 * dx - 34 * age) * Math.min(1, (front - dx) / 40);
    }
    pts.push(`${sx},${(sy + d * zoom).toFixed(2)}`);
  }
  return <polyline points={pts.join(' ')} fill="none" stroke={W.ink} strokeWidth={1.5} opacity={opacity} />;
};

/** A few white specks thrown up by a landing, falling under gravity. Seeded per landing, so every render is identical. */
const Specks: React.FC<{ age: number; x: number; y: number; n: number; seed: number; power: number }> = ({ age, x, y, n, seed, power }) => {
  if (age < 0 || age > 0.75) return null;
  const r = rng(seed);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI * (0.15 + 0.7 * r()), v = power * (0.5 + 0.5 * r()), size = 2 + 2.5 * r();
        const px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 0.5 * 2600 * age * age;
        return <circle key={i} cx={px} cy={py} r={size} fill={W.ink} opacity={1 - age / 0.75} />;
      })}
    </>
  );
};

/** The hook, word by word: on screen from frame 0, the words leave one after another (follow-through) as the ball winds up. */
export const Hook: React.FC<{ t: number; top?: number }> = ({ t, top = 660 }) => {
  const lines = ['Can you play this', 'by ear?'];
  let k = 0;
  return (
    <>
      {lines.map((ln, li) => (
        <div key={ln} style={{ position: 'absolute', left: 0, right: 0, top: top + li * 104, transform: 'translateY(-50%)', textAlign: 'center', fontFamily: FONT, fontWeight: 300, fontSize: 92, letterSpacing: '-0.01em', color: W.ink, whiteSpace: 'pre' }}>
          {ln.split(' ').map((w, wi) => {
            const out = ramp(t, 1.4 + 0.035 * k, 1.62 + 0.035 * k++), p = Math.min(1, presence(t, -0.5));
            return <span key={wi} style={{ display: 'inline-block', margin: '0 0.12em', opacity: p * (1 - out), transform: `translateY(${-46 * out + (1 - p) * 18}px)` }}>{w}</span>;
          })}
        </div>
      ))}
    </>
  );
};

/** One small dot per note under the tune: each fills as its note sounds. */
export const Pips: React.FC<{ t: number; y: number; notes: TimedNote[]; from: number; to: number }> = ({ t, y, notes, from, to }) => {
  const p = presence(t, from, to);
  if (p < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 18, opacity: Math.min(1, p) }}>
      {notes.map((n) => {
        const s = 1 + 0.5 * kick(t - n.t, 10);
        return <div key={n.order} style={{ width: 12, height: 12, borderRadius: 99, border: `1.5px solid ${W.dim}`, background: t >= n.t ? W.ink : 'transparent', transform: `scale(${s})` }} />;
      })}
    </div>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const SpringBounce: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // the camera follows the ball a beat behind (follow-through), pushes in a touch while the tune plays, then pulls back to frame the whole shape
  const follow = (s: number) => contact(Math.max(T.melodyAt, s)).x;
  const back = springAt(t, T.pullBack, SOFT);
  const camX = lerp(follow(t - 0.18), noteX(LAST) / 2, back);
  const zoom = lerp(1 + 0.05 * ramp(t, T.melodyAt, END), 0.9, back);
  const shake = NOTES.filter(isBig).reduce((s, n) => s + 7 * wob(t - n.t, 9, 38), 0);   // the two long B4s land with weight
  const toScreen = (x: number, y: number): [number, number] => [540 + (x - camX) * zoom, MID_Y + (y - MID_Y) * zoom + shake];

  // the fold: everything drawn is reeled into the ball, the earliest first; then the ball winds up and pops
  const ballAt = contact(t);
  const reel = (frac: number) => easeOut(ramp(t, T.collapse + 0.22 * frac, T.collapse + 0.22 * frac + 0.2));
  const fold = (x: number, y: number, frac: number): [number, number] => {
    const k = reel(frac);
    return [lerp(x, ballAt.x, k), lerp(y, ballAt.y - R, k)];
  };
  const fracOf = (s: number) => (s - T.melodyAt) / (END - T.melodyAt);

  // the trail: the path the ball's centre took, sampled every frame of the 120, brighter where it is newer
  const trail: { pts: string; op: number }[] = [];
  if (t > T.melodyAt) {
    const stop = Math.min(t, END), step = 1 / 120, chunk = 6;
    const samples: [number, number, number][] = [];
    for (let s = T.melodyAt; s <= stop + 1e-9; s += step) { const c = contact(s); samples.push([...fold(c.x, c.y - R, fracOf(s)), s]); }
    const now = contact(t); if (t > END) samples.push([...fold(now.x, now.y - R, 1), t]);
    for (let i = 0; i < samples.length - 1; i += chunk) {
      const seg = samples.slice(i, i + chunk + 1), age = t - seg[0][2];
      const op = Math.max(0.16 + 0.5 * Math.exp(-age * 1.6), 0.5 * back) * (1 - ramp(t, T.collapse + 0.2, T.flash));
      trail.push({ pts: seg.map(([x, y]) => toScreen(x, y).map((v) => v.toFixed(1)).join(',')).join(' '), op });
    }
  }

  // the ball itself: speed for the stretch, the latest landing for the squash, the wind-up before the launch, the swell and pop at the end
  const dt = 1 / 240, a = contact(t - dt), b = contact(t + dt);
  const vx = ((b.x - a.x) / (2 * dt)) * zoom, vy = ((b.y - a.y) / (2 * dt)) * zoom;
  const land = LANDINGS.filter((l) => t >= l.t).at(-1);
  let sq = land ? land.sq * wob(t - land.t, 16, 40) : 0;
  if (t >= IDLE_END && t < T.launch) sq = 0.32 * ramp(t, IDLE_END, T.launch);                                   // anticipation: crouch…
  const flying = HOPS.some((h) => t > h.t0 + 0.03 && t < h.t1 - 0.03);
  if (flying) sq = 0;                                                                                            // …then all stretch in the air
  const grow = 1 + 0.45 * ramp(t, T.collapse, T.collapse + 0.4) - 0.15 * ramp(t, T.flash - 0.12, T.flash);      // swells as it swallows the shape
  const pop = t < T.flash ? 1 : 0;
  const [bx, by] = toScreen(ballAt.x, ballAt.y);

  // after the pop: one hairline ring sweeps the frame; a new ball bounces in tempo under the call to action
  const ringAge = t - T.flash;
  const ctaBall = springAt(t, T.comment - 0.2, POP);
  const ctaHop = 64 * Math.abs(Math.sin((Math.PI * Math.max(0, t - T.comment)) / BEAT));
  const ctaSq = t > T.comment ? 0.3 * wob(((t - T.comment) % BEAT), 18, 40) * (ctaHop < 10 ? 1 : 0) : 0;
  const gridFade = 1 - 0.7 * ramp(t, T.collapse, T.flash);   // the pitch lines stay on, fainter, under the call to action

  return (
    <AbsoluteFill style={{ background: W.bg, fontFamily: FONT }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        {GRID.map((m) => <PitchLine key={m} t={t} midi={m} toScreen={toScreen} zoom={zoom} fade={gridFade} />)}

        {trail.map((s, i) => <polyline key={i} points={s.pts} fill="none" stroke={W.ink} strokeWidth={2.5 * zoom} strokeLinecap="round" strokeLinejoin="round" opacity={s.op} />)}

        {/* footprints: a short bright dash where each note landed — together they are the tune's contour */}
        {NOTES.filter((n) => t >= n.t).map((n) => {
          const [fx, fy] = fold(noteX(n), lineY(n.midi), n.order / (NOTES.length - 1));
          const [sx, sy] = toScreen(fx, fy), p = springAt(t, n.t, POP) * (1 - ramp(t, T.collapse + 0.2, T.flash - 0.05));
          const w = 22 * p * zoom;
          return <line key={n.order} x1={sx - w / 2} x2={sx + w / 2} y1={sy} y2={sy} stroke={W.ink} strokeWidth={4} strokeLinecap="round" opacity={Math.min(1, p)} />;
        })}

        {/* a ring opens from every landing; the long notes send a second, wider one */}
        {NOTES.filter((n) => t >= n.t && t - n.t < 0.9).flatMap((n) => {
          const [sx, sy] = toScreen(noteX(n), lineY(n.midi) - R);
          return (isBig(n) ? [0, 0.12] : [0]).map((d) => {
            const age = t - n.t - d, u = age / (isBig(n) ? 0.9 : 0.6);
            if (age < 0 || u >= 1) return null;
            return <circle key={`${n.order}-${d}`} cx={sx} cy={sy} r={(R + (isBig(n) ? 190 : 80) * easeOut(u)) * zoom} fill="none" stroke={W.ink} strokeWidth={2} opacity={0.6 * (1 - u)} />;
          });
        })}

        {NOTES.map((n) => {
          const [sx, sy] = toScreen(noteX(n), lineY(n.midi));
          return <Specks key={n.order} age={t - n.t} x={sx} y={sy} n={isBig(n) ? 14 : 5} seed={n.order * 7919 + 13} power={isBig(n) ? 900 : 520} />;
        })}

        {pop > 0 && <Ball x={bx} y={by} vx={vx} vy={vy} sq={sq} scale={zoom * grow} />}

        {/* the pop */}
        {ringAge >= 0 && ringAge < 1.1 && <circle cx={bx} cy={by - R * zoom} r={R * 1.3 + 1500 * easeOut(ringAge / 1.1)} fill="none" stroke={W.ink} strokeWidth={3} opacity={0.8 * (1 - ringAge / 1.1)} />}
        <Specks age={ringAge} x={bx} y={by - R * zoom} n={26} seed={4242} power={1300} />

        {/* your turn: a fresh ball bounces in tempo on its own short line */}
        <line x1={440} x2={640} y1={1300} y2={1300} stroke={W.ink} strokeWidth={1.5} opacity={0.3 * Math.min(1, presence(t, T.comment - 0.3))} />
        <Ball x={540} y={1300 - ctaHop} vx={0} vy={0} sq={ctaSq} scale={ctaBall} />
      </svg>

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.5} outAt={1.35} y={520} text="VIVALDI — SPRING" />
      <Hook t={t} />

      {/* scene 2 · hear it */}
      <Caps t={t} at={T.melodyAt - 0.25} outAt={T.collapse} y={520} text="LISTEN · ONE TIME" />
      <Pips t={t} y={1560} notes={NOTES} from={T.melodyAt - 0.2} to={T.pullBack + 0.25} />

      {/* scene 3 · your turn */}
      <Line t={t} at={T.turn} y={780} size={128}>Your turn.</Line>
      <Line t={t} at={T.sub} y={920} size={42} weight={400} color={W.dim}>No tabs. Just your ears.</Line>
      <Line t={t} at={T.comment} y={1460} size={44} weight={400}>Comment the notes ↓</Line>

      {!silent && <Audio src={staticFile('spring-bounce.wav')} />}
    </AbsoluteFill>
  );
};

/** The cover (Instagram Reel cover, YouTube thumbnail): the hook over the tune's shape — arcs and footprints, no notes.
 *  Everything sits inside the central 1080×1350 so the 4:5 grid crop keeps it. */
export const SpringCover: React.FC = () => {
  const zoom = 0.9, camX = noteX(LAST) / 2, top = 1240;
  const toScreen = (x: number, y: number): [number, number] => [540 + (x - camX) * zoom, top + (y - MID_Y) * zoom];
  const pts: string[] = [];
  for (let s = T.melodyAt; s <= END + 1e-9; s += 1 / 120) { const c = contact(s); pts.push(toScreen(c.x, c.y - R).map((v) => v.toFixed(1)).join(',')); }
  const [bx, by] = toScreen(noteX(LAST), lineY(LAST.midi));
  return (
    <AbsoluteFill style={{ background: W.bg, fontFamily: FONT }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', fontWeight: 500, fontSize: 36, letterSpacing: '0.32em', color: W.dim }}>VIVALDI — SPRING</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 440, textAlign: 'center', fontWeight: 300, fontSize: 132, lineHeight: 1.1, letterSpacing: '-0.015em', color: W.ink, whiteSpace: 'pre' }}>{'Can you play\nthis by ear?'}</div>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        {GRID.map((m) => { const [, y] = toScreen(0, lineY(m)); return <line key={m} x1={0} x2={1080} y1={y} y2={y} stroke={W.ink} strokeWidth={1.5} opacity={0.09} />; })}
        <polyline points={pts.join(' ')} fill="none" stroke={W.ink} strokeWidth={2.5 * zoom} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
        {NOTES.map((n) => { const [x, y] = toScreen(noteX(n), lineY(n.midi)); return <line key={n.order} x1={x - 10} x2={x + 10} y1={y} y2={y} stroke={W.ink} strokeWidth={4} strokeLinecap="round" />; })}
        <circle cx={bx} cy={by - R * zoom} r={R * zoom} fill={W.ink} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1520, textAlign: 'center', fontWeight: 400, fontSize: 42, color: W.dim }}>15 notes · one listen · no tabs</div>
    </AbsoluteFill>
  );
};
