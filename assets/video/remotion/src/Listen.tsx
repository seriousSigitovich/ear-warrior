// Scene 1 (0–2 s): "Hear it once." The question as a sound contour — each note an orb, height = pitch, a playhead sweeping across,
// rings off every onset and an equalizer underneath. No fretboard yet: the viewer only hears and sees the shape.
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { Tune } from '../tune.mjs';
import { C, alpha } from './theme';
import { clamp, easeOut } from './util';
import { Headline } from './Headline';

const X_A = 120, X_B = 960, SPAN = 2.0, Y_LO = 1390, Y_HI = 600;
const xOf = (t: number) => X_A + (t / SPAN) * (X_B - X_A);

export const Listen: React.FC<{ tune: Tune }> = ({ tune }) => {
  const LISTEN = tune.notes.filter((n) => n.phase === 'listen');
  // pitch axis fits the tune: one semitone of headroom each side, never tighter than 6 semitones
  let MIDI_LO = Math.min(...LISTEN.map((n) => n.midi)) - 1, MIDI_HI = Math.max(...LISTEN.map((n) => n.midi)) + 1;
  if (MIDI_HI - MIDI_LO < 6) { const pad = (6 - (MIDI_HI - MIDI_LO)) / 2; MIDI_LO -= pad; MIDI_HI += pad; }
  const yOf = (m: number) => Y_LO + ((m - MIDI_LO) / (MIDI_HI - MIDI_LO)) * (Y_HI - Y_LO);
  const semitones = Array.from({ length: Math.floor(MIDI_HI - MIDI_LO) + 1 }, (_, i) => Math.ceil(MIDI_LO) + i).filter((m) => m <= MIDI_HI);
  const ticks = Array.from({ length: Math.floor(SPAN / tune.beat) + 1 }, (_, i) => i * tune.beat);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const played = LISTEN.filter((n) => n.t <= t);
  const energy = LISTEN.reduce((m, n) => (n.t <= t ? Math.max(m, Math.exp(-(t - n.t) * 7) * (n.dur > 0.3 ? 1 : 0.75)) : m), 0);

  return (
    <>
      <Headline lines={tune.copy.listen} instant />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="g1" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="14" /></filter>
          <linearGradient id="ph" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={C.accent3} stopOpacity="0" />
            <stop offset="0.5" stopColor={C.accent4} stopOpacity="0.95" />
            <stop offset="1" stopColor={C.accent3} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* piano-roll grid: a line per semitone, beat ticks that flash */}
        {semitones.map((m) => (
          <line key={m} x1={X_A - 40} x2={X_B + 40} y1={yOf(m)} y2={yOf(m)} stroke={alpha(C.text, 0.06)} strokeWidth={2} />
        ))}
        {ticks.map((b) => (
          <line key={b} x1={xOf(b)} x2={xOf(b)} y1={Y_HI - 40} y2={Y_LO + 40} stroke={alpha(C.text, 0.05 + 0.2 * Math.exp(-Math.abs(t - b) * 9))} strokeWidth={2} />
        ))}
        {/* contour line */}
        {played.slice(1).map((n, i) => {
          const a = LISTEN[i];
          const k = clamp((t - n.t) / 0.07);
          const x1 = xOf(a.t), y1 = yOf(a.midi), x2 = x1 + (xOf(n.t) - x1) * k, y2 = y1 + (yOf(n.midi) - y1) * k;
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={alpha(C.accent, 0.9)} strokeWidth={10} strokeLinecap="round" filter="url(#g1)" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.accent4} strokeWidth={4} strokeLinecap="round" />
            </g>
          );
        })}
        {/* rings + orbs */}
        {played.map((n, i) => {
          const a = t - n.t;
          const x = xOf(n.t), y = yOf(n.midi);
          const big = n.dur > 0.3;
          const pop = spring({ frame: frame - Math.round(n.t * fps), fps, config: { damping: 9, stiffness: 300 } });
          const r = (big ? 36 : 21) * (0.5 + 0.5 * pop);
          const ringP = clamp(a / 0.7);
          const latest = i === played.length - 1;
          return (
            <g key={i}>
              {ringP < 1 && <circle cx={x} cy={y} r={40 + (big ? 420 : 300) * easeOut(ringP)} fill="none" stroke={alpha(C.accent3, 0.4 * (1 - ringP))} strokeWidth={big ? 5 : 3} />}
              <circle cx={x} cy={y} r={r * 2.1} fill={alpha(C.accent, latest ? 0.75 : 0.28)} filter="url(#g1)" />
              <circle cx={x} cy={y} r={r} fill={latest ? C.accent4 : C.accent3} />
              <circle cx={x} cy={y} r={r * 0.45} fill="#fff" opacity={latest ? 0.9 : 0.5} />
            </g>
          );
        })}
        {/* playhead */}
        <rect x={xOf(t) - 70} y={Y_HI - 60} width={140} height={Y_LO - Y_HI + 120} fill={alpha(C.accent, 0.1)} filter="url(#g1)" />
        <rect x={xOf(t) - 2} y={Y_HI - 60} width={4} height={Y_LO - Y_HI + 120} fill="url(#ph)" />
        {/* equalizer */}
        {Array.from({ length: 30 }, (_, i) => {
          const wob = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + frame * 0.21) * Math.cos(i * 0.6 + frame * 0.09));
          const h = 14 + 150 * energy * wob + 10 * Math.abs(Math.sin(i + frame * 0.1));
          const x = 90 + i * 31.5;
          return <rect key={i} x={x} y={1640 - h / 2} width={16} height={h} rx={8} fill={i % 3 === 0 ? C.accent3 : C.accent} opacity={0.55 + 0.4 * energy} />;
        })}
      </svg>
    </>
  );
};
