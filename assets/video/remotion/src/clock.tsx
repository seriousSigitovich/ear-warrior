// A clock the picture can run through. The pain cut plays the 60 s timeline faster in places and jumps over the rest; every component that
// reads the frame (springs, captions, wipes) goes through `useCurrentFrame` from here, so it sees the 60 s timeline's frame, not the cut's.
// Without a <ClockProvider> this is Remotion's own useCurrentFrame / Sequence, so the other compositions are untouched.
import React, { createContext, useContext } from 'react';
import { Sequence, useCurrentFrame as useRemotionFrame } from 'remotion';

interface Clock { warp: (frame: number) => number; base: number; fx: boolean }
const ClockContext = createContext<Clock | null>(null);

/** `warp` maps the composition's frame to the frame of the timeline being played. */
export const ClockProvider: React.FC<{ warp: (frame: number) => number; fx?: boolean; children: React.ReactNode }> = ({ warp, fx = false, children }) => (
  <ClockContext.Provider value={{ warp, base: 0, fx }}>{children}</ClockContext.Provider>
);

/** True inside the short cut, which gets the extra effects (camera hits, grade, word-by-word captions…); the 60 s sketch stays as it was. */
export function useFx(): boolean {
  return !!useContext(ClockContext)?.fx;
}

export function useCurrentFrame(): number {
  const real = useRemotionFrame();
  const clock = useContext(ClockContext);
  return clock ? clock.warp(real) - clock.base : real;
}

/** Remotion's <Sequence>, but measured on the warped clock: children see frame 0 at `from` and nothing renders outside the window. */
export const Seq: React.FC<{ from: number; durationInFrames: number; children: React.ReactNode }> = ({ from, durationInFrames, children }) => {
  const clock = useContext(ClockContext);
  const frame = useCurrentFrame();
  if (!clock) return <Sequence from={from} durationInFrames={durationInFrames}>{children}</Sequence>;
  if (frame < from || frame >= from + durationInFrames) return null;
  return <ClockContext.Provider value={{ ...clock, base: clock.base + from }}>{children}</ClockContext.Provider>;
};
