import React from 'react';
import { AbsoluteFill } from 'remotion';
import { K, rgba } from './theme';
import { rng } from '../util';

const DUST = (() => { const r = rng(7); return Array.from({ length: 26 }, () => ({ x: r() * 1080, y: r() * 1920, s: 1.5 + r() * 3, sp: 6 + r() * 14, ph: r() * 6.28 })); })();

/** Near-black ground, a slow atmospheric glow, a few motes of dust, vignette and film grain. `pulse` (0..1) lifts the glow on beats. */
export const Background: React.FC<{ t: number; frame: number; pulse: number; glowY: number }> = ({ t, frame, pulse, glowY }) => (
  <AbsoluteFill style={{ background: K.bg, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(900px 780px at ${540 + 80 * Math.sin(t * 0.5)}px ${glowY}px, ${rgba(K.lime, 0.075 + 0.07 * pulse)}, transparent 70%)` }} />
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(1100px 900px at ${300 + 140 * Math.cos(t * 0.37)}px 1750px, rgba(150,90,255,0.13), transparent 70%)` }} />
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {DUST.map((d, i) => (
        <circle key={i} cx={(d.x + d.sp * t * 0.6) % 1080} cy={(d.y - d.sp * t + 1920 * 4) % 1920} r={d.s} fill="#fff" opacity={0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.3 + d.ph))} />
      ))}
    </svg>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0,0,0,0.55) 100%)' }} />
    {/* grain: fixed turbulence, re-seeded every 2nd frame (30 fps film grain), deterministic */}
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.2 }}>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={1 + (Math.floor(frame / 2) % 24)} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1080" height="1920" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);
