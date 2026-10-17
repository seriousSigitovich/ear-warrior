import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, alpha, FONT } from './theme';
import { rng } from './util';

const rand = rng(7);
const DUST = Array.from({ length: 52 }, () => ({ x: rand() * 1080, y: rand() * 1920, v: 30 + rand() * 90, r: 1.5 + rand() * 3.5, ph: rand() * 6.28 }));

/** Persistent layer: drifting glow, beat pulse + expanding beat rings, rising dust, wordmark. */
export const Background: React.FC<{ beat: number; brand: string }> = ({ beat: BEAT, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const beatPhase = (t % BEAT) / BEAT;
  const pulse = Math.exp(-beatPhase * 6);
  const blobs = [
    { x: 0.2 + 0.12 * Math.sin(t * 0.9), y: 0.2 + 0.08 * Math.cos(t * 0.7), r: 1000, c: C.accent, o: 0.3 },
    { x: 0.88 + 0.08 * Math.cos(t * 0.8), y: 0.55 + 0.1 * Math.sin(t * 0.6), r: 900, c: C.deep, o: 0.4 },
    { x: 0.4 + 0.1 * Math.sin(t * 0.5 + 2), y: 0.95 + 0.04 * Math.cos(t), r: 1000, c: C.accent2, o: 0.2 },
  ];
  const ringIdx = Math.floor(t / BEAT);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x * 1080 - b.r / 2,
            top: b.y * 1920 - b.r / 2,
            width: b.r,
            height: b.r,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${b.c} 0%, transparent 62%)`,
            opacity: b.o * (1 + 0.45 * pulse),
          }}
        />
      ))}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {[ringIdx, ringIdx - 1].map((k) => {
          const p = (t - k * BEAT) / (BEAT * 1.8);
          if (p < 0 || p > 1) return null;
          return <circle key={k} cx={540} cy={1000} r={160 + 760 * (1 - Math.pow(1 - p, 2))} fill="none" stroke={alpha(C.accent3, 0.16 * (1 - p))} strokeWidth={3} />;
        })}
        {DUST.map((d, i) => {
          const y = (((d.y - t * d.v) % 2000) + 2000) % 2000 - 40;
          return <circle key={i} cx={d.x + Math.sin(t * 0.8 + d.ph) * 16} cy={y} r={d.r} fill={alpha(C.accent4, 0.14 + 0.2 * Math.abs(Math.sin(t * 1.6 + d.ph)))} />;
        })}
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(6,7,14,0.6) 100%)' }} />
      <div
        style={{
          position: 'absolute', top: 92, left: 0, right: 0, textAlign: 'center',
          fontFamily: FONT, fontSize: 32, fontWeight: 600, letterSpacing: 12, color: alpha(C.text, 0.5),
        }}
      >
        {brand}
      </div>
    </AbsoluteFill>
  );
};
