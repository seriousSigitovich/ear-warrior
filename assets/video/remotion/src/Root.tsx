import React from 'react';
import { Composition } from 'remotion';
import { FPS, DURATION_SEC, resolveTune } from '../tune.mjs';
import { TuneVideo } from './TuneVideo';
import { Cover } from './Cover';
import { PainVideo, PainCut } from './pain/PainVideo';
import { CUT_DURATION } from '../pain/cut.mjs';
import { ByEar } from './byear/ByEar';
import { Thumb, ThumbVertical } from './pain/Thumb';
import preview from '../tunes/turkish-march.json';

// `render.mjs` overrides these props with the resolved tune it was asked for; this one is only what Remotion Studio opens with.
export const Root: React.FC = () => (
  <>
  <Composition
    id="Tune"
    component={TuneVideo}
    durationInFrames={Math.round(FPS * DURATION_SEC)}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={resolveTune(preview)}
  />
  <Composition id="Cover" component={Cover} durationInFrames={1} fps={FPS} width={1080} height={1920} defaultProps={resolveTune(preview)} />
  <Composition id="Pain" component={PainVideo} durationInFrames={3600} fps={FPS} width={1080} height={1920} />
  <Composition id="PainCut" component={PainCut} durationInFrames={Math.round(CUT_DURATION * FPS)} fps={FPS} width={1080} height={1920} />
  <Composition id="ByEar" component={ByEar} durationInFrames={300} fps={60} width={1080} height={1920} />
  <Composition id="PainThumb" component={Thumb} durationInFrames={1} fps={FPS} width={1280} height={720} />
  <Composition id="PainCoverIG" component={ThumbVertical} durationInFrames={1} fps={FPS} width={1080} height={1920} />
  </>
);
