import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

export type Dir = 'left' | 'up';
/** Length of every scene change, in frames (0.27 s at 60 fps). */
export const MOVE_FRAMES = 16;
const ease = Easing.bezier(0.76, 0, 0.18, 1);
const VEC: Record<Dir, [number, number]> = { left: [1080, 0], up: [0, 1920] };

/**
 * A scene that travels instead of blinking. The cut is a push: the outgoing scene slides off in `outDir` while the next one slides in
 * from the opposite edge, both on the same curve. Timing is unchanged — the incoming scene's frame 0 is still the cut, so its first note
 * lands while it moves; the outgoing scene keeps playing (its Sequence is MOVE_FRAMES longer) and leaves at `outAt`.
 */
export const Move: React.FC<{ children: React.ReactNode; inDir?: Dir; outDir?: Dir; outAt?: number }> = ({ children, inDir, outDir, outAt = 0 }) => {
  const f = useCurrentFrame();
  let x = 0, y = 0, blur = 0;
  if (inDir) {
    const p = ease(interpolate(f, [0, MOVE_FRAMES], [0, 1], { extrapolateRight: 'clamp' }));
    x += VEC[inDir][0] * (1 - p); y += VEC[inDir][1] * (1 - p);
    blur = Math.max(blur, Math.sin(Math.PI * p));
  }
  if (outDir) {
    const q = ease(interpolate(f, [outAt, outAt + MOVE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    x -= VEC[outDir][0] * q; y -= VEC[outDir][1] * q;
    blur = Math.max(blur, Math.sin(Math.PI * q));
  }
  blur *= 7; // a little blur at peak speed sells the motion
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};
