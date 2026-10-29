// Scene 4 (6–7 s): the payoff. 10 / 10, a ring that fills, a burst, the wordmark. Lands on the chord stab at 6.0 s.
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { Tune } from '../tune.mjs';
import { C, alpha, FONT } from './theme';
import { Rich } from './Headline';
import { clamp, easeOut, rng } from './util';

const r = rng(42);
const COLORS = [C.accent3, C.accent4, C.accent, C.warm, '#ffffff'];
const BURST = Array.from({ length: 46 }, () => ({
  a: r() * Math.PI * 2, v: 14 + r() * 26, s: 7 + r() * 14, c: COLORS[Math.floor(r() * COLORS.length)], sq: r() > 0.55, spin: (r() - 0.5) * 0.4,
}));
const CX = 540, CY = 800, R = 250;
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = (m: number) => `${SHARP[m % 12]}${Math.floor(m / 12) - 1}`;

export const Result: React.FC<{ tune: Tune }> = ({ tune }) => {
  const N = tune.listenCount;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fill = easeOut((frame - 3) / 20);
  const n = Math.round(N * fill);
  const circ = 2 * Math.PI * R;
  const pop = spring({ frame: frame - 2, fps, config: { damping: 9, stiffness: 220 } });
  const textIn = spring({ frame: frame - 14, fps, config: { damping: 14, stiffness: 200 } });
  const brandIn = spring({ frame: frame - 24, fps, config: { damping: 15, stiffness: 190 } });
  const check = clamp((frame - 22) / 10);
  const shake = frame < 12 ? Math.sin(frame * 3.1) * 14 * (1 - frame / 12) : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${shake}px, ${-shake * 0.6}px)` }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="g4" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="22" /></filter>
          <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.accent4} />
            <stop offset="1" stopColor={C.accent} />
          </linearGradient>
        </defs>
        {[0, 5, 10].map((d) => {
          const p = clamp((frame - 1 - d) / 22);
          return p > 0 && p < 1 ? <circle key={d} cx={CX} cy={CY} r={R + 520 * easeOut(p)} fill="none" stroke={alpha(C.accent3, 0.5 * (1 - p))} strokeWidth={6 * (1 - p) + 1} /> : null;
        })}
        <circle cx={CX} cy={CY} r={R * 1.5} fill={alpha(C.accent, 0.35 * pop)} filter="url(#g4)" />
        <g transform={`translate(${CX} ${CY}) scale(${0.7 + 0.3 * pop})`}>
          <circle r={R} fill={alpha(C.surface, 0.85)} />
          <circle r={R} fill="none" stroke={alpha(C.text, 0.1)} strokeWidth={26} />
          <circle r={R} fill="none" stroke="url(#arc)" strokeWidth={26} strokeLinecap="round" strokeDasharray={`${circ * fill} ${circ}`} transform="rotate(-90)" />
        </g>
        {BURST.map((b, i) => {
          const f = frame - 3;
          if (f < 0) return null;
          const dist = b.v * (1 - Math.pow(0.9, f)) * 10;
          const x = CX + Math.cos(b.a) * (R + 10 + dist), y = CY + Math.sin(b.a) * (R + 10 + dist) + 0.5 * 0.9 * f * f;
          const o = clamp(1 - (f - 10) / 40);
          return b.sq ? (
            <rect key={i} x={-b.s / 2} y={-b.s / 2} width={b.s} height={b.s} rx={2} fill={b.c} opacity={o} transform={`translate(${x} ${y}) rotate(${f * b.spin * 57})`} />
          ) : (
            <circle key={i} cx={x} cy={y} r={b.s / 2} fill={b.c} opacity={o} />
          );
        })}
        <g transform={`translate(${CX + R * 0.72} ${CY - R * 0.72}) scale(${clamp(check * 1.2)})`}>
          <circle r={58} fill={C.accent3} stroke={C.bg} strokeWidth={8} />
          <path d="M -24 2 L -7 20 L 26 -16" fill="none" stroke={C.bg} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="90" strokeDashoffset={90 * (1 - check)} />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: CY - 135, textAlign: 'center', fontFamily: FONT, color: C.text, transform: `scale(${0.8 + 0.2 * pop})` }}>
        <span style={{ fontSize: 250, fontWeight: 600, letterSpacing: -8, textShadow: `0 0 50px ${alpha(C.accent, 0.7)}` }}>{n}</span>
        <span style={{ fontSize: 96, fontWeight: 500, color: alpha(C.text, 0.5), marginLeft: 6 }}>/{N}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1180, textAlign: 'center', fontFamily: FONT, fontSize: 78, fontWeight: 600, letterSpacing: -2, color: C.text, opacity: clamp(textIn * 1.4), transform: `translateY(${(1 - textIn) * 50}px)` }}>
        <Rich text={tune.copy.result} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1390, textAlign: 'center', fontFamily: FONT, opacity: clamp(brandIn * 1.4), transform: `translateY(${(1 - brandIn) * 40}px)` }}>
        <div style={{ fontSize: 58, fontWeight: 600, letterSpacing: 16, color: C.accent4 }}>{tune.copy.brand}</div>
        <div style={{ marginTop: 18, fontSize: 40, color: alpha(C.text, 0.7) }}>{tune.copy.tagline}</div>
      </div>
      <NoteChips tune={tune} frame={frame} fps={fps} />
    </div>
  );
};

/** The app's per-note result chips (src/components/feedback/NoteResultChips.tsx, status "matched"): accent outline, tinted fill, note name. */
const NoteChips: React.FC<{ tune: Tune; frame: number; fps: number }> = ({ tune, frame, fps }) => {
  const names = tune.notes.filter((n) => n.phase === 'listen').map((n) => noteName(n.midi));
  const head = spring({ frame: frame - 28, fps, config: { damping: 14, stiffness: 200 } });
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 1560, fontFamily: FONT, textAlign: 'center' }}>
      <div style={{ fontSize: 36, color: alpha(C.text, 0.6), opacity: clamp(head * 1.4), marginBottom: 22 }}>{names.length} of {names.length} notes matched</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, maxWidth: 700, margin: '0 auto' }}>
        {names.map((name, i) => {
          const p = spring({ frame: frame - 30 - i * 3, fps, config: { damping: 11, stiffness: 240 } });
          return (
            <div
              key={i}
              style={{
                padding: '12px 30px', borderRadius: 999, border: '2px solid #5d5294', background: alpha(C.accent, 0.08), color: '#e7e5fe',
                fontSize: 36, fontWeight: 500, transform: `scale(${0.6 + 0.4 * p})`, opacity: clamp(p * 1.5),
              }}
            >
              {name}
            </div>
          );
        })}
      </div>
    </div>
  );
};
