import React from 'react';
import { K, FONT } from './theme';
import { POP, springAt, ramp } from './motion';

export type Seg = { text: string; color?: string };

/**
 * Kinetic typography: each letter springs up from below with a slight overshoot, staggered across the line, then settles.
 * `lines` = rows of coloured segments. `t` is the global time; the block enters at `at` and (optionally) leaves between `outAt` and `outAt + 0.22`.
 */
export const Kinetic: React.FC<{
  t: number; at: number; lines: Seg[][]; size: number; y: number; weight?: number; tracking?: number; lineGap?: number;
  stagger?: number; outAt?: number; outDir?: -1 | 1; align?: 'center'; glow?: boolean; rise?: number;
}> = ({ t, at, lines, size, y, weight = 900, tracking = -0.02, lineGap = 1.04, stagger = 0.022, outAt, outDir = -1, glow, rise = 0.9 }) => {
  const out = outAt === undefined ? 0 : ramp(t, outAt, outAt + 0.22);
  if (t < at - 0.01 || out >= 1) return null;
  let idx = 0;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: y, transform: `translateY(-50%) translateY(${outDir * 70 * out}px)`, opacity: 1 - out,
      textAlign: 'center', fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: lineGap, letterSpacing: `${tracking}em`, color: K.white,
      whiteSpace: 'nowrap',
    }}>
      {lines.map((line, li) => (
        <div key={li}>
          {line.map((seg, si) => (
            <span key={si} style={{ color: seg.color ?? K.white, textShadow: glow && seg.color === K.lime ? '0 0 38px rgba(198,255,77,0.45)' : undefined }}>
              {Array.from(seg.text).map((ch, ci) => {
                const p = springAt(t, at + (idx++) * stagger, POP);
                const o = Math.min(1, p * 4);
                return (
                  <span key={ci} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: o, transform: `translateY(${(1 - p) * size * rise}px) scale(${0.55 + 0.45 * p})`, transformOrigin: '50% 80%' }}>{ch}</span>
                );
              })}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
