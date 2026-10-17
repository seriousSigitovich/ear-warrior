import React from 'react';
import { Composition } from 'remotion';
import { FPS, DURATION_SEC, resolveTune } from '../tune.mjs';
import { TuneVideo } from './TuneVideo';
import preview from '../tunes/turkish-march.json';

// `render.mjs` overrides these props with the resolved tune it was asked for; this one is only what Remotion Studio opens with.
export const Root: React.FC = () => (
  <Composition
    id="Tune"
    component={TuneVideo}
    durationInFrames={Math.round(FPS * DURATION_SEC)}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={resolveTune(preview)}
  />
);
