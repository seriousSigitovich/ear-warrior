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
import { KingNeon } from './king/KingNeon';
import { ToccataMinimal } from './toccata/ToccataMinimal';
import { RisingWood } from './rising/RisingWood';
import { RisingBand } from './rising/RisingBand';
import { DURATION as TOCCATA_DURATION, FPS as TOCCATA_FPS } from '../toccata/story.mjs';
import { SwanMinimal } from './swan/SwanMinimal';
import { BeeMinimal } from './bee/BeeMinimal';
import { DURATION as BEE_DURATION, FPS as BEE_FPS } from '../bee/story.mjs';
import { DURATION as SWAN_DURATION, FPS as SWAN_FPS } from '../swan/story.mjs';
import { NeonRecut } from './recut/NeonRecut';
import { DURATION as RECUT_DURATION } from '../recut/story.mjs';
import { DURATION as KING_DURATION, FPS as KING_FPS } from '../king/story.mjs';
import { TUNES as KING_TUNES } from '../king/tunes.mjs';
import { DURATION as MOZART_DURATION, FPS as MOZART_FPS } from '../mozart/story.mjs';
import { HumVideo } from './hum/HumVideo';
import { JamBlues } from './jam/JamScene';
import { DURATION as JAM_DURATION, FPS as JAM_FPS } from '../jam/story.mjs';
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
  <Composition id="NeonRecut" component={NeonRecut} durationInFrames={Math.round(RECUT_DURATION * 60)} fps={60} width={1080} height={1920} />
  <Composition id="KingNeon" component={KingNeon} durationInFrames={Math.round(KING_DURATION * KING_FPS)} fps={KING_FPS} width={1080} height={1920} />
  {Object.values(KING_TUNES).flatMap((k) => [
    <Composition key={k.id} id={`King-${k.id}`} component={KingNeon} durationInFrames={Math.round(k.DURATION * k.FPS)} fps={k.FPS} width={1080} height={1920} defaultProps={{ tune: k.id }} />,
    <Composition key={`${k.id}-send`} id={`King-${k.id}-send`} component={KingNeon} durationInFrames={Math.round(k.DURATION * k.FPS)} fps={k.FPS} width={1080} height={1920} defaultProps={{ tune: k.id, cta: 'send' as const }} />,
  ])}
  <Composition id="RisingWood" component={RisingWood} durationInFrames={Math.round(KING_TUNES.rising.DURATION * KING_TUNES.rising.FPS)} fps={KING_TUNES.rising.FPS} width={1080} height={1920} />
      <Composition id="RisingBand" component={RisingBand} durationInFrames={Math.round(KING_TUNES.risingBand.DURATION * KING_TUNES.risingBand.FPS)} fps={KING_TUNES.risingBand.FPS} width={1080} height={1920} />
  <Composition id="ToccataMinimal" component={ToccataMinimal} durationInFrames={Math.round(TOCCATA_DURATION * TOCCATA_FPS)} fps={TOCCATA_FPS} width={1080} height={1920} />
  <Composition id="BeeMinimal" component={BeeMinimal} durationInFrames={Math.round(BEE_DURATION * BEE_FPS)} fps={BEE_FPS} width={1080} height={1920} />
  <Composition id="SwanMinimal" component={SwanMinimal} durationInFrames={Math.round(SWAN_DURATION * SWAN_FPS)} fps={SWAN_FPS} width={1080} height={1920} />
  <Composition id="JamBlues" component={JamBlues} durationInFrames={Math.round(JAM_DURATION * JAM_FPS)} fps={JAM_FPS} width={1080} height={1920} />
  <Composition id="HumSolo" component={HumVideo} durationInFrames={900} fps={60} width={1080} height={1920} />
  <Composition id="HairProof" component={HairProof} durationInFrames={1} fps={60} width={1800} height={1500} />
  <Composition id="PainThumb" component={Thumb} durationInFrames={1} fps={FPS} width={1280} height={720} />
  <Composition id="PainCoverIG" component={ThumbVertical} durationInFrames={1} fps={FPS} width={1080} height={1920} />
  </>
);
