import React from 'react';
import { Composition } from 'remotion';
import { FPS, DURATION_SEC, resolveTune } from '../tune.mjs';
import type { Tune } from '../tune.mjs';
import { TuneVideo } from './TuneVideo';
import { Cover } from './Cover';
import { PainVideo, PainCut } from './pain/PainVideo';
import { CUT_DURATION } from '../pain/cut.mjs';
import { ByEar } from './byear/ByEar';
import { Warrior, WarriorRoot, WarriorKey, WARRIOR_KEY_STORY } from './warrior/WarriorScene';
import { TenSecond } from './ten/TenSecond';
import { TenNeon } from './neon/TenNeon';
import { DURATION as NEON_DURATION } from '../neon/story.mjs';
import { TenWinter, WinterCover } from './winter/TenWinter';
import { DURATION as WINTER_DURATION } from '../winter/story.mjs';
import { SpringBounce, SpringCover } from './spring/SpringBounce';
import { DURATION as SPRING_DURATION, FPS as SPRING_FPS } from '../spring/story.mjs';
import { Mozart3D, MozartCover } from './mozart/Mozart3D';
import { DURATION as MOZART_DURATION, FPS as MOZART_FPS } from '../mozart/story.mjs';
import { HumVideo } from './hum/HumVideo';
import { HairProof } from './hum/HairProof';
import { Thumb, ThumbVertical } from './pain/Thumb';
import preview from '../tunes/turkish-march.json';

// `render.mjs` overrides these props with the resolved tune it was asked for; this one is only what Remotion Studio opens with.
export const Root: React.FC = () => (
  <>
  <Composition
    id="Tune"
    component={TuneVideo}
    durationInFrames={Math.round(FPS * DURATION_SEC)}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(FPS * ((props as Tune).durationSec ?? DURATION_SEC)) })}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={resolveTune(preview)}
  />
  <Composition id="Cover" component={Cover} durationInFrames={1} fps={FPS} width={1080} height={1920} defaultProps={resolveTune(preview)} />
  <Composition id="Pain" component={PainVideo} durationInFrames={3600} fps={FPS} width={1080} height={1920} />
  <Composition id="PainCut" component={PainCut} durationInFrames={Math.round(CUT_DURATION * FPS)} fps={FPS} width={1080} height={1920} />
  <Composition id="ByEar" component={ByEar} durationInFrames={300} fps={60} width={1080} height={1920} />
  <Composition id="WarriorRiff" component={Warrior} durationInFrames={300} fps={60} width={1080} height={1920} />
  <Composition id="WarriorRoot" component={WarriorRoot} durationInFrames={420} fps={60} width={1080} height={1920} />
  <Composition id="WarriorKey" component={WarriorKey} durationInFrames={Math.round(WARRIOR_KEY_STORY.DURATION * 60)} fps={60} width={1080} height={1920} />
  <Composition id="TenSecond" component={TenSecond} durationInFrames={1080} fps={60} width={1080} height={1920} />
  <Composition id="TenNeon" component={TenNeon} durationInFrames={NEON_DURATION * 60} fps={60} width={1080} height={1920} />
  <Composition id="TenWinter" component={TenWinter} durationInFrames={WINTER_DURATION * 60} fps={60} width={1080} height={1920} />
  <Composition id="WinterCover" component={WinterCover} durationInFrames={1} fps={60} width={1080} height={1920} />
  <Composition id="SpringBounce" component={SpringBounce} durationInFrames={SPRING_DURATION * SPRING_FPS} fps={SPRING_FPS} width={1080} height={1920} />
  <Composition id="SpringCover" component={SpringCover} durationInFrames={1} fps={SPRING_FPS} width={1080} height={1920} />
  <Composition id="Mozart3D" component={Mozart3D} durationInFrames={Math.round(MOZART_DURATION * MOZART_FPS)} fps={MOZART_FPS} width={1080} height={1920} />
  <Composition id="MozartCover" component={MozartCover} durationInFrames={1} fps={MOZART_FPS} width={1080} height={1920} />
  <Composition id="HumSolo" component={HumVideo} durationInFrames={900} fps={60} width={1080} height={1920} />
  <Composition id="HairProof" component={HairProof} durationInFrames={1} fps={60} width={1800} height={1500} />
  <Composition id="PainThumb" component={Thumb} durationInFrames={1} fps={FPS} width={1280} height={720} />
  <Composition id="PainCoverIG" component={ThumbVertical} durationInFrames={1} fps={FPS} width={1080} height={1920} />
  </>
);
