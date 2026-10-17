import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion';
import { Background } from './Background';
import { Listen } from './Listen';
import { NeckTour } from './NeckTour';
import { Answer } from './Answer';
import { Result } from './Result';
import { Wipe } from './Wipe';
import type { Tune } from '../tune.mjs';

const S = 120; // 2 s at 60 fps
// The incoming scene lands with a small zoom-out so every cut has weight.
const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, 16], [1.08, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return <AbsoluteFill style={{ transform: `scale(${k})`, transformOrigin: '50% 55%' }}>{children}</AbsoluteFill>;
};

export const TuneVideo: React.FC<Tune> = (tune) => (
  <AbsoluteFill>
    <Audio src={staticFile(tune.audio)} />
    <Background beat={tune.beat} brand={tune.copy.brand} />
    <Sequence from={0} durationInFrames={S}><Listen tune={tune} /></Sequence>
    <Sequence from={S} durationInFrames={S}><Punch><NeckTour tune={tune} /></Punch></Sequence>
    <Sequence from={2 * S} durationInFrames={S}><Punch><Answer tune={tune} /></Punch></Sequence>
    <Sequence from={3 * S} durationInFrames={S / 2}><Result tune={tune} /></Sequence>
    <Wipe at={S} />
    <Wipe at={2 * S} />
    <Wipe at={3 * S} />
  </AbsoluteFill>
);
