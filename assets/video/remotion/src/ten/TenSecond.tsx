// "Can you play this by ear?" — 18 s, 1080×1920, 60 fps. A pure function of the frame: every position, glow and number is computed from `t`
// and the shared timeline (../../ten/story.mjs), which also lays the soundtrack — so what you hear is what is lit.
//   0–2 hook · 2–5 hear the melody · 5–12 find the notes (7 → 0) · 12–15 time's up + the answer · 15–18 comment call to action
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { K, FONT, rgba } from './theme';
import { FB } from './geometry';
import { Fretboard, type Marker, type Vibe } from './Fretboard';
import { Countdown } from './Countdown';
import { Kinetic } from './Kinetic';
import { Background } from './Background';
import { POP, SNAP, SOFT, kick, lin, ramp, springAt } from './motion';
import { easeInOut, lerp } from '../util';
import { T, STEP, HEARD, ANSWER, HOOK_NOTE, TICKS } from '../../ten/story.mjs';

const BOARD_X = 540 - FB.W / 2;                               // 108: the board spans exactly the central 80 %
const easeIn = (x: number) => Math.min(1, Math.max(0, x)) ** 2;

// --- small pieces ---------------------------------------------------------------------------------------------------------------------
/** The pill labels ("10-SECOND CHALLENGE", "THE ANSWER"): a dot, tracked caps, a hairline lime border. */
const Chip: React.FC<{ t: number; at: number; y: number; text: string; outAt?: number; size?: number }> = ({ t, at, y, text, outAt, size = 34 }) => {
  const p = springAt(t, at, SNAP), out = outAt === undefined ? 0 : ramp(t, outAt, outAt + 0.22);
  if (t < at - 0.2 || out >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', opacity: Math.min(1, p * 3) * (1 - out), transform: `translateY(${(1 - p) * -40 - out * 50}px) scale(${0.9 + 0.1 * p})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: `${size * 0.42}px ${size * 0.9}px`, borderRadius: 999, border: `2px solid ${rgba(K.lime, 0.7)}`, background: rgba(K.lime, 0.07), fontFamily: FONT, fontWeight: 800, fontSize: size, letterSpacing: '0.16em', color: K.lime, boxShadow: `0 0 36px ${rgba(K.lime, 0.14)}` }}>
        <span style={{ width: size * 0.34, height: size * 0.34, borderRadius: 99, background: K.lime, boxShadow: `0 0 14px ${K.lime}` }} />
        {text}
      </div>
    </div>
  );
};

/** One of the five "note n of 5" pips under the board while listening. */
const Pips: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const show = springAt(t, T.listen + 0.15, SNAP) * (1 - ramp(t, T.clearAt - 0.05, T.clearAt + 0.2));
  if (show < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 26, opacity: show, transform: `translateY(${(1 - show) * 30}px)` }}>
      {HEARD.map((n) => {
        const p = springAt(t, n.t, POP);
        return <div key={n.order} style={{ width: 30, height: 30, borderRadius: 99, border: `3px solid ${rgba(K.lime, 0.5)}`, background: rgba(K.lime, p), transform: `scale(${1 + 0.35 * p * kick(t - n.t, 6)})`, boxShadow: p > 0.1 ? `0 0 ${18 * p}px ${rgba(K.lime, 0.7)}` : 'none' }} />;
      })}
    </div>
  );
};

/** Note names under the board in the reveal: each lights up as its note plays, so the answer reads as a sequence. */
const NameRow: React.FC<{ t: number }> = ({ t }) => {
  const show = springAt(t, T.reveal + 0.5, SNAP) * (1 - ramp(t, T.cta, T.cta + 0.25));
  if (show < 0.01) return null;
  return (
    <div style={{ position: 'absolute', left: 0, top: FB.H + 96, width: FB.W, display: 'flex', justifyContent: 'center', gap: 14, opacity: show }}>
      {ANSWER.map((n) => {
        const lit = t >= n.t, p = springAt(t, n.t, POP);
        return (
          <div key={n.order} style={{ width: 104, height: 60, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 32, letterSpacing: '0.02em', border: `2px solid ${lit ? K.lime : 'rgba(255,255,255,0.18)'}`, background: lit ? K.lime : 'transparent', color: lit ? '#0b1204' : 'rgba(255,255,255,0.4)', transform: `scale(${lit ? 0.9 + 0.1 * p + 0.1 * kick(t - n.t, 8) : 1})`, boxShadow: lit ? `0 0 ${24 * kick(t - n.t, 3)}px ${rgba(K.lime, 0.7)}` : 'none' }}>{n.name}</div>
        );
      })}
    </div>
  );
};

/** The three answer options: they pop in one by one, then take turns breathing so the row feels alive without moving. */
const Chips: React.FC<{ t: number; y: number }> = ({ t, y }) => {
  const items = [{ text: '5/5', w: 190 }, { text: 'ALMOST', w: 290 }, { text: 'TRY AGAIN', w: 360 }];
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 22, transform: 'translateY(-50%)' }}>
      {items.map((c, i) => {
        const p = springAt(t, T.chips[i], POP);
        const flash = kick(t - (T.sweep + 0.08 * i), 6);                       // the closing sweep lights each pill in turn
        const breathe = t > T.sweep + 0.5 ? 0.5 + 0.5 * Math.sin((t - T.sweep) * 2.4 - i * 1.1) : 0;
        return (
          <div key={c.text} style={{ width: c.w, height: 92, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 44, letterSpacing: '0.03em', color: flash > 0.3 ? K.lime : K.white, opacity: Math.min(1, p * 3), border: `3px solid ${rgba(K.lime, 0.28 + 0.6 * flash + 0.14 * breathe)}`, background: rgba(K.lime, 0.05 + 0.1 * flash), transform: `translateY(${(1 - p) * 60}px) scale(${(0.6 + 0.4 * p) * (1 + 0.05 * flash + 0.012 * breathe)})`, boxShadow: `0 0 ${34 * flash}px ${rgba(K.lime, 0.5)}` }}>{c.text}</div>
        );
      })}
    </div>
  );
};

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const TenSecond: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // --- the board's path through the film: snap in (hook) → centre (listen/find/answer) → lifts to make room (CTA)
  const toCentre = ramp(t, T.listen - 0.1, T.listen + 0.5);
  const lift = springAt(t, T.cta, SOFT);
  const snap = springAt(t, 0, SNAP);
  const boardY = lerp(lerp(1210, 1090, toCentre), 700, lift);
  const boardScale = (0.78 + 0.22 * snap) * lerp(1, 0.94, lift);
  const tilt = (1 - snap) * 24;                                                    // rotateX: it flips up into place on the first frames
  const beatNote = [...HEARD, ...ANSWER].reduce((a, n) => (t >= n.t ? Math.min(a, t - n.t) : a), 9);
  const boardKick = 1 + 0.012 * kick(beatNote, 10);

  // --- impact at 12.0: a small camera shake
  const shakeAge = t - T.reveal;
  const shakeX = 16 * Math.exp(-shakeAge * 9) * Math.cos(shakeAge * 70) * (shakeAge >= 0 ? 1 : 0);
  const shakeY = 12 * Math.exp(-shakeAge * 9) * Math.sin(shakeAge * 83) * (shakeAge >= 0 ? 1 : 0);

  // --- what is lit on the neck
  const markers: Marker[] = [];
  const hookOut = easeIn((t - 1.55) / 0.22);
  if (hookOut < 1) markers.push({ id: 'hook', string: HOOK_NOTE.string, fret: HOOK_NOTE.fret, label: '', scale: (1 + 0.32 * kick(t, 7)) * (1 - hookOut), age: Math.max(t, 0.0001), hot: t < 1.4 });
  HEARD.forEach((n) => {
    const clear = easeIn((t - (T.clearAt + n.order * 0.035)) / 0.2);
    if (t >= n.t && clear < 1) markers.push({ id: `h${n.order}`, string: n.string, fret: n.fret, label: String(n.order + 1), scale: springAt(t, n.t, POP) * (1 - clear), age: t - n.t, hot: t - n.t < STEP });
  });
  ANSWER.forEach((n) => {
    if (t >= n.t) markers.push({ id: `a${n.order}`, string: n.string, fret: n.fret, label: String(n.order + 1), scale: springAt(t, n.t, POP) * (1 + (t > T.sweep ? 0.025 * Math.sin((t - T.sweep) * 3 - n.order * 0.8) : 0)), age: t - n.t, hot: t - n.t < STEP });
  });
  const vibes: Vibe[] = [
    { string: HOOK_NOTE.string, fret: HOOK_NOTE.fret, age: t },
    ...HEARD.map((n) => ({ string: n.string, fret: n.fret, age: t - n.t })),
    ...ANSWER.map((n) => ({ string: n.string, fret: n.fret, age: t - n.t })),
  ];
  const fretLit = Array.from(new Set(markers.filter((m) => m.id !== 'hook' && m.scale > 0.4).map((m) => m.fret)));

  // --- ambient pulse for the glow: a heartbeat in the countdown, a hit at 12.0, a flare on every note
  const sinceTick = t - Math.floor(t);
  const pulse = Math.max(t >= T.challenge + 1 && t < T.reveal ? 0.55 * kick(sinceTick, 7) : 0, kick(t - T.reveal, 6), 0.7 * kick(beatNote, 6));

  // --- scene-3 countdown pieces
  const boom = lin(t, T.reveal, T.reveal + 0.22);
  const flash = 0.3 * kick(t - T.reveal, 13) * (t >= T.reveal ? 1 : 0);
  const sweepX = lerp(-500, 1700, lin(t, T.sweep, T.sweep + 0.55));

  return (
    <AbsoluteFill style={{ background: K.bg, fontFamily: FONT }}>
      <Background t={t} frame={frame} pulse={pulse} glowY={boardY} />
      <AbsoluteFill style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}>

        {/* ── the neck: one persistent object; it flips in, settles, and later lifts ─────────────────────────────────────────────── */}
        <div style={{ position: 'absolute', left: BOARD_X, top: boardY - FB.H / 2, width: FB.W, height: FB.H, transform: `perspective(1600px) rotateX(${tilt}deg) scale(${boardScale * boardKick})`, transformOrigin: '50% 50%', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.55))' }}>
          <Fretboard markers={markers} vibes={vibes} fretLit={fretLit} />
          <NameRow t={t} />
        </div>

        {/* ── scene 1 · the hook ───────────────────────────────────────────────────────────────────────────────────────────────── */}
        <Chip t={t} at={-0.1} y={290} text="10-SECOND CHALLENGE" outAt={1.78} />
        <Kinetic t={t} at={-0.14} y={600} size={108} lines={[[{ text: 'CAN YOU PLAY' }], [{ text: 'THIS ' }, { text: 'BY EAR?', color: K.lime }]]} outAt={1.78} glow />

        {/* ── scene 2 · hear the melody ────────────────────────────────────────────────────────────────────────────────────────── */}
        <Kinetic t={t} at={T.listen + 0.08} y={600} size={92} lines={[[{ text: 'LISTEN ' }, { text: 'CLOSELY', color: K.lime }]]} outAt={T.clearAt - 0.1} glow />
        <Pips t={t} y={boardY + 270} />

        {/* ── scene 3 · find the notes ─────────────────────────────────────────────────────────────────────────────────────────── */}
        <Kinetic t={t} at={T.challenge + 0.02} y={236} size={74} lines={[[{ text: 'NOW FIND THE ' }, { text: 'NOTES', color: K.lime }]]} outAt={T.reveal - 0.2} stagger={0.016} />
        {t >= T.challenge - 0.1 && t < T.reveal + 0.5 && <Countdown t={t} cy={540} appear={T.challenge} boom={boom} />}
        <Kinetic t={t} at={T.challenge + 0.45} y={boardY + 300} size={40} weight={700} tracking={0.1} lines={[[{ text: 'NO TABS. JUST YOUR EARS.', color: K.dim }]]} outAt={T.reveal - 0.2} stagger={0.012} rise={0.5} />

        {/* ── scene 4 · time's up, the answer ──────────────────────────────────────────────────────────────────────────────────── */}
        <Kinetic t={t} at={T.reveal + 0.02} y={540} size={134} lines={[[{ text: "TIME’S UP" }]]} outAt={T.reveal + 0.62} stagger={0.012} rise={1.1} glow />
        <Chip t={t} at={T.reveal + 0.55} y={290} text="THE ANSWER" />

        {/* ── scene 5 · comment call to action ─────────────────────────────────────────────────────────────────────────────────── */}
        <Kinetic t={t} at={T.q} y={1110} size={150} lines={[[{ text: 'DID YOU' }], [{ text: 'GET ' }, { text: 'IT?', color: K.lime }]]} glow stagger={0.02} />
        <Kinetic t={t} at={T.comment} y={1392} size={58} lines={[[{ text: 'COMMENT YOUR SCORE ' }, { text: '↓', color: K.lime }]]} stagger={0.016} tracking={-0.005} />
        <Chips t={t} y={1540} />
      </AbsoluteFill>

      {/* the white pulse on time's up, and the closing light sweep */}
      <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
      {t >= T.sweep && t < T.sweep + 0.6 && (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
          <div style={{ position: 'absolute', top: -200, bottom: -200, left: sweepX, width: 240, transform: 'skewX(-18deg)', background: `linear-gradient(90deg, transparent, ${rgba(K.lime, 0.22)}, rgba(255,255,255,0.28), ${rgba(K.lime, 0.22)}, transparent)` }} />
        </AbsoluteFill>
      )}
      {!silent && <Audio src={staticFile('ten-second.wav')} />}
    </AbsoluteFill>
  );
};
