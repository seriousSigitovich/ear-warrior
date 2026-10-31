// "Can you play this by ear?" — the minimal Winter cut, 20 s, 1080×1920, 60 fps. Same five scenes as #55 (src/ten/TenSecond.tsx), stripped to
// the bone: one flat dark-purple ground, hairline strings, white dots, thin type, nothing else — no glow, grain, shake, flash or particles.
// A pure function of the frame; every time comes from ../../winter/story.mjs, which also lays the soundtrack.
//   0–2 hook · 2–5.7 hear the melody · 5.7–12.7 find the notes (7 → 0) · 12.7–16.9 time's up + the answer · 16.9–20 comment call to action
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FB, fretX, noteX, stringY } from '../ten/geometry';
import { SOFT, kick, ramp, springAt, type SpringCfg } from '../ten/motion';
import { easeOut, lerp } from '../util';
import { T, HEARD, ANSWER, HOOK_NOTE, COUNT_FROM, remaining, type TimedNote } from '../../winter/story.mjs';

const W = {
  bg: '#1A0D2E',
  ink: '#F4F0FA',
  dim: 'rgba(244,240,250,0.46)',
  hair: 'rgba(244,240,250,0.16)',
};
const FONT = '"Inter", -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const CALM: SpringCfg = { damping: 18, stiffness: 160, mass: 0.8 };     // a hint of overshoot, never a bounce
const BOARD_X = 540 - FB.W / 2;
const DOT = 22;

/** In at `at` (fade + small rise), out over 0.25 s from `outAt`. */
const presence = (t: number, at: number, outAt?: number) => springAt(t, at, CALM) * (outAt === undefined ? 1 : 1 - ramp(t, outAt, outAt + 0.25));

/** A line of thin type: fades in while rising 18 px, leaves by fading. */
const Line: React.FC<{ t: number; at: number; outAt?: number; y: number; size: number; weight?: number; tracking?: number; color?: string; children: React.ReactNode }> = ({ t, at, outAt, y, size, weight = 300, tracking = -0.01, color = W.ink, children }) => {
  const p = presence(t, at, outAt);
  if (p < 0.005) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, transform: `translateY(-50%) translateY(${(1 - Math.min(1, p)) * 18}px)`, opacity: Math.min(1, p), textAlign: 'center', fontFamily: FONT, fontWeight: weight, fontSize: size, letterSpacing: `${tracking}em`, lineHeight: 1.12, color, whiteSpace: 'pre' }}>
      {children}
    </div>
  );
};
const Caps: React.FC<{ t: number; at: number; outAt?: number; y: number; text: string }> = ({ t, at, outAt, y, text }) => (
  <Line t={t} at={at} outAt={outAt} y={y} size={30} weight={500} tracking={0.32} color={W.dim}>{text}</Line>
);

/** One lit spot: a white dot with its order number, and a single hairline ring that opens when it sounds. */
const Dot: React.FC<{ t: number; n: TimedNote; fade: number }> = ({ t, n, fade }) => {
  const age = t - n.t, s = springAt(t, n.t, CALM) * fade;
  if (age < 0 || s < 0.01) return null;
  const ring = age / 0.7;
  return (
    <g transform={`translate(${noteX(n.fret)} ${stringY(n.string)})`} opacity={Math.min(1, fade * 1.4)}>
      {ring < 1 && <circle r={DOT + 46 * easeOut(ring)} fill="none" stroke={W.ink} strokeWidth={1.5} opacity={0.6 * (1 - ring)} />}
      <g transform={`scale(${s})`}>
        <circle r={DOT} fill={W.ink} />
        <text textAnchor="middle" dominantBaseline="central" y={1} fontFamily={FONT} fontWeight={600} fontSize={22} fill={W.bg}>{n.order + 1}</text>
      </g>
    </g>
  );
};

/** The neck reduced to lines: six strings, seven frets, a nut. A plucked string trembles once and settles. */
const Neck: React.FC<{ t: number; dots: { n: TimedNote; fade: number }[]; plucks: { string: number; fret: number; age: number }[] }> = ({ t, dots, plucks }) => (
  <svg width={FB.W} height={FB.H + 60} viewBox={`0 0 ${FB.W} ${FB.H + 60}`} style={{ overflow: 'visible', display: 'block' }}>
    {Array.from({ length: FB.frets }, (_, i) => i + 1).map((f) => <line key={f} x1={fretX(f)} x2={fretX(f)} y1={stringY(5)} y2={stringY(0)} stroke={W.hair} strokeWidth={1.5} />)}
    <line x1={fretX(0)} x2={fretX(0)} y1={stringY(5) - 1} y2={stringY(0) + 1} stroke={W.dim} strokeWidth={4} />
    {Array.from({ length: 6 }, (_, s) => {
      const p = plucks.filter((v) => v.string === s && v.age >= 0 && v.age < 0.9).sort((a, b) => a.age - b.age)[0];
      const y = stringY(s), w = 1 + (5 - s) * 0.22;
      if (!p) return <line key={s} x1={fretX(0)} x2={FB.W} y1={y} y2={y} stroke={W.dim} strokeWidth={w} />;
      const a = fretX(p.fret), amp = 5 * Math.exp(-p.age * 6) * Math.cos(p.age * 2 * Math.PI * 11);
      return (
        <g key={s}>
          <line x1={fretX(0)} x2={a} y1={y} y2={y} stroke={W.dim} strokeWidth={w} />
          <path d={`M${a} ${y} Q${(a + FB.W) / 2} ${y + 2 * amp} ${FB.W} ${y}`} fill="none" stroke={W.ink} strokeWidth={w + 0.5} opacity={0.55 + 0.45 * Math.exp(-p.age * 3)} />
        </g>
      );
    })}
    {[3, 5, 7].map((f) => <text key={f} x={(fretX(f - 1) + fretX(f)) / 2} y={FB.H + 30} textAnchor="middle" fontFamily={FONT} fontWeight={400} fontSize={24} fill={W.dim}>{f}</text>)}
    {dots.map(({ n, fade }) => <Dot key={`${n.t}`} t={t} n={n} fade={fade} />)}
  </svg>
);

/** Eight small dots under the neck while listening: each fills as its note sounds. */
const Pips: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const p = presence(t, T.listen + 0.2, T.clearAt - 0.1);
  if (p < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 22, opacity: Math.min(1, p) }}>
      {HEARD.map((n) => <div key={n.order} style={{ width: 12, height: 12, borderRadius: 99, border: `1.5px solid ${W.dim}`, background: t >= n.t ? W.ink : 'transparent' }} />)}
    </div>
  );
};

/** The answer spelled out under the neck: each name turns from dim to white as it plays. */
const Names: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const p = presence(t, T.reveal + 0.55, T.cta - 0.1);
  if (p < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 30, opacity: Math.min(1, p), fontFamily: FONT, fontWeight: 400, fontSize: 38, letterSpacing: '0.02em' }}>
      {ANSWER.map((n) => <span key={n.order} style={{ color: t >= n.t ? W.ink : W.hair }}>{n.name.replace(/\d+$/, '')}</span>)}
    </div>
  );
};

/** 7 → 0: one thin numeral and one hairline that drains under it. */
const Count: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const p = presence(t, T.challenge);
  if (p < 0.01 || t >= T.reveal) return null;                       // a hard cut on the time's-up hit
  const left = remaining(t), num = Math.min(COUNT_FROM, Math.ceil(left - 1e-6));
  const tick = t >= T.challenge + 1 ? kick(t - Math.floor(t - T.challenge) - T.challenge, 9) : 0;   // a breath on every whole second
  const len = 520;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, opacity: Math.min(1, p) }}>
      <div style={{ textAlign: 'center', transform: `translateY(-50%) scale(${1 + 0.03 * tick})`, fontFamily: FONT, fontWeight: 200, fontSize: 340, lineHeight: 1, color: W.ink, fontVariantNumeric: 'tabular-nums' }}>{left <= 0 ? 0 : num}</div>
      <div style={{ position: 'absolute', left: 540 - len / 2, top: 210, width: len, height: 2, background: W.hair }}>
        <div style={{ width: `${(left / COUNT_FROM) * 100}%`, height: '100%', background: W.ink }} />
      </div>
    </div>
  );
};

/** The three answers as hairline pills. */
const Chips: React.FC<{ t: number; y: number }> = ({ t, y }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 20 }}>
    {['8/8', 'almost', 'try again'].map((c, i) => {
      const p = presence(t, T.chips[i]);
      return <div key={c} style={{ padding: '18px 38px', borderRadius: 999, border: `1.5px solid ${W.dim}`, fontFamily: FONT, fontWeight: 400, fontSize: 38, color: W.ink, opacity: Math.min(1, p), transform: `translateY(${(1 - Math.min(1, p)) * 18}px)` }}>{c}</div>;
    })}
  </div>
);

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const TenWinter: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // the neck: fades up under the hook, settles in the middle, rises for the call to action; breathes 2 px so it is never dead still
  const boardY = lerp(lerp(1220, 1040, springAt(t, T.listen - 0.15, SOFT)), 760, springAt(t, T.cta, SOFT)) + 2 * Math.sin(t * 1.75);
  const boardIn = springAt(t, 0.1, CALM);

  const dots = [
    ...HEARD.map((n) => ({ n, fade: 1 - ramp(t, T.clearAt, T.clearAt + 0.3) })),
    ...ANSWER.map((n) => ({ n, fade: 1 })),
  ].filter((d) => t >= d.n.t);
  // repeated spots: only the latest dot on a spot is drawn, so its number is the one that just sounded
  const latest = dots.filter((d, i) => !dots.slice(i + 1).some((e) => e.n.string === d.n.string && e.n.fret === d.n.fret));
  const plucks = [{ ...HOOK_NOTE, t: 0 }, ...HEARD, ...ANSWER].map((n) => ({ string: n.string, fret: n.fret, age: t - n.t }));

  return (
    <AbsoluteFill style={{ background: W.bg, fontFamily: FONT }}>
      <div style={{ position: 'absolute', left: BOARD_X, top: boardY - FB.H / 2, width: FB.W, height: FB.H, opacity: Math.min(1, boardIn) }}>
        <Neck t={t} dots={latest} plucks={plucks} />
      </div>

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.3} outAt={1.75} y={560} text="VIVALDI — WINTER" />
      <Line t={t} at={-0.3} outAt={1.75} y={720} size={92}>{'Can you play this\nby ear?'}</Line>

      {/* scene 2 · hear it */}
      <Caps t={t} at={T.listen + 0.1} outAt={T.clearAt - 0.1} y={760} text="LISTEN" />
      <Pips t={t} y={boardY + 300} />

      {/* scene 3 · find the notes */}
      <Caps t={t} at={T.challenge + 0.05} outAt={T.reveal - 0.2} y={300} text="NOW FIND THE NOTES" />
      <Count t={t} y={560} />
      <Line t={t} at={T.challenge + 0.5} outAt={T.reveal - 0.2} y={boardY + 320} size={36} weight={400} color={W.dim}>No tabs. Just your ears.</Line>

      {/* scene 4 · time's up, the answer */}
      <Line t={t} at={T.reveal} outAt={T.reveal + 0.6} y={560} size={110}>Time’s up</Line>
      <Caps t={t} at={T.reveal + 0.6} outAt={T.cta - 0.1} y={560} text="THE ANSWER" />
      <Names t={t} y={boardY + 290} />

      {/* scene 5 · comment */}
      <Line t={t} at={T.q} y={1130} size={104}>Did you get it?</Line>
      <Line t={t} at={T.comment} y={1270} size={40} weight={400} color={W.dim}>Comment your score ↓</Line>
      <Chips t={t} y={1370} />

      {!silent && <Audio src={staticFile('ten-winter.wav')} />}
    </AbsoluteFill>
  );
};

/** The cover (Instagram Reel cover, YouTube thumbnail): the hook on its own, the bare neck, eight empty pips. No dots — it would give the answer away.
 *  Everything sits inside the central 1080×1350 so the 4:5 grid crop keeps it. */
export const WinterCover: React.FC = () => (
  <AbsoluteFill style={{ background: W.bg, fontFamily: FONT }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 440, textAlign: 'center', fontWeight: 500, fontSize: 36, letterSpacing: '0.32em', color: W.dim }}>VIVALDI — WINTER</div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 530, textAlign: 'center', fontWeight: 300, fontSize: 132, lineHeight: 1.1, letterSpacing: '-0.015em', color: W.ink, whiteSpace: 'pre' }}>{'Can you play\nthis by ear?'}</div>
    <div style={{ position: 'absolute', left: BOARD_X, top: 1130 - FB.H / 2, width: FB.W, height: FB.H }}>
      <Neck t={0} dots={[]} plucks={[]} />
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1420, display: 'flex', justifyContent: 'center', gap: 22 }}>
      {HEARD.map((n) => <div key={n.order} style={{ width: 14, height: 14, borderRadius: 99, border: `1.5px solid ${W.dim}` }} />)}
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1490, textAlign: 'center', fontWeight: 400, fontSize: 42, color: W.dim }}>8 notes · 7 seconds · no tabs</div>
  </AbsoluteFill>
);
