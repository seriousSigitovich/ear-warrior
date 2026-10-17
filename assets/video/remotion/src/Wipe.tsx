import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C } from './theme';
import { easeInOut } from './util';

const PH = 2600;
/** A lilac panel that sweeps up the screen; it is fully opaque for ~3 frames around `at`, which is where the scene underneath is swapped. */
export const Wipe: React.FC<{ at: number; half?: number }> = ({ at, half = 9 }) => {
  const frame = useCurrentFrame();
  const p = (frame - (at - half)) / (2 * half);
  if (p <= 0 || p >= 1) return null;
  const top = 1920 - easeInOut(p) * (1920 + PH);
  return (
    <div style={{ position: 'absolute', left: 0, top, width: 1080, height: PH }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.accent4} 0, ${C.accent3} 90px, ${C.accent} 400px, ${C.deep} 100%)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: -60, height: 60, background: `linear-gradient(0deg, ${C.accent4}, transparent)` }} />
    </div>
  );
};
