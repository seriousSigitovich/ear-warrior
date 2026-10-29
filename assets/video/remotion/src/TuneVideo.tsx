import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Background } from './Background';
import { Listen } from './Listen';
import { NeckTour } from './NeckTour';
import { Answer } from './Answer';
import { Result } from './Result';
import { Move, MOVE_FRAMES as M } from './Move';
import type { Tune } from '../tune.mjs';

const S = 120; // 2 s at 60 fps

// Scene changes are pushes, not flashes: each scene slides off one way while the next slides in (see Move.tsx).
// Sequences of the outgoing scenes run M frames past the cut so they can leave.
export const TuneVideo: React.FC<Tune> = (tune) => (
  <AbsoluteFill>
    <Audio src={staticFile(tune.audio)} />
    <Background beat={tune.beat} brand={tune.copy.brand} />
    <Sequence from={0} durationInFrames={S + M}><Move outDir="left" outAt={S}><Listen tune={tune} /></Move></Sequence>
    <Sequence from={S} durationInFrames={S + M}><Move inDir="left" outDir="up" outAt={S}><NeckTour tune={tune} /></Move></Sequence>
    <Sequence from={2 * S} durationInFrames={S + M}><Move inDir="up" outDir="left" outAt={S}><Answer tune={tune} /></Move></Sequence>
    <Sequence from={3 * S} durationInFrames={Math.round(60 * tune.durationSec) - 3 * S}><Move inDir="left"><Result tune={tune} /></Move></Sequence>
  </AbsoluteFill>
);
