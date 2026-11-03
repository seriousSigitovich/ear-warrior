// "Can you play it without tabs?" — #71's House of the Rising Sun as a 10 s looping band cut: the mod-suit four-piece (public/mods/, cut
// from rising/sheet.webp by rising/cut-sheet.py) plays the arpeggio from the first frame on a small club stage in the brand's dark purple
// under tungsten light. Then the camera slides down: the band shrinks into the top of the frame and plays on there while #71's rosewood
// neck (src/rising/RisingWood.tsx) rises from below and the notes land on it — the ones heard so far already glowing. On "your turn" the
// band slides away and #71's crane turns the neck into a tab; in the last 0.7 s the band slides back to fill the frame with the hook,
// so the last frame is the first and the loop has no seam (every idle motion below runs in whole cycles of the 10 s).
// A pure function of the frame; the melody and "your turn" times are king/tunes.mjs's `risingBand`, the bars and slides rising/band.mjs.
//   0–DOCK the band, hook · DOCK–LEAVE band on top, notes land on the neck · LEAVE–BACK your turn, which song next · BACK–end the band returns
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { makeCam } from '../neon/cam';
import { kick, ramp, springAt, type SpringCfg } from '../ten/motion';
import { clamp, easeInOut, rng } from '../util';
import { WOOD, Guitar, Line, Caps, Beads, LampRoom, Lens, SCRIM, woodOf } from './RisingWood';
import { S, BAR, BARS, BEATS, HOME, FILL, DOCK, LEAVE, BACK } from '../../rising/band.mjs';
import SPRITES from '../../rising/sprites.json';

const { T, HEARD } = S;
const W = 1080, H = 1920;
const LOOP = S.DURATION;
const NECK_WOOD = woodOf(S, { hook: false, enter: -3 });           // on the road down the neck from the start: it only shows once docked
const SLIDE: SpringCfg = { damping: 17, stiffness: 120, mass: 1 };
/** An idle motion that runs `n` whole cycles per loop, so frame 0 and the last frame agree. */
const cyc = (t: number, n: number, ph = 0) => Math.sin((2 * Math.PI * n * t) / LOOP + ph);

const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };
const idxOf = (t: number, times: number[]) => { let k = -1; for (let i = 0; i < times.length; i++) if (t >= times[i]) k = i; return k; };
const NOTE_T = HEARD.map((n) => n.t);

// --- the band ------------------------------------------------------------------------------------------------------------------------
type Who = 'guitarist' | 'guitarist2' | 'bassist' | 'drummer';
const SP = SPRITES as Record<string, { w: number; h: number; cx: number }>;
/** Feet on the stage (world px) and scale. The guitarist with the red guitar plays the arpeggio, front and centre. */
const SPOT: Record<Who, { x: number; y: number; s: number; flip?: boolean }> = {
  drummer: { x: 560, y: 1240, s: 2.5 },
  guitarist2: { x: 235, y: 1500, s: 2.7 },
  bassist: { x: 850, y: 1500, s: 2.7, flip: true },
  guitarist: { x: 545, y: 1610, s: 3.0 },
};
/** The poses each one cycles through (sheet frame numbers). */
const FRAMES: Record<Who, number[]> = { guitarist: [0, 1, 5], guitarist2: [0, 1, 2], bassist: [0, 1, 2], drummer: [0, 1, 2, 3] };

const Sprite: React.FC<{ who: Who; frame: number; dy?: number; sx?: number; sy?: number; lean?: number }> = ({ who, frame, dy = 0, sx = 1, sy = 1, lean = 0 }) => {
  const { x, y, s, flip } = SPOT[who];
  return (
    <div style={{ position: 'absolute', left: x, top: y + dy, width: 0, height: 0, transform: `rotate(${lean}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`, transformOrigin: '0 0' }}>
      {FRAMES[who].map((n) => {
        const m = SP[`${who}_${n}`];
        return <Img key={n} src={staticFile(`mods/${who}_${n}.png`)} style={{ position: 'absolute', left: -m.cx * s, top: -m.h * s, width: m.w * s, height: m.h * s, imageRendering: 'pixelated', visibility: n === frame ? 'visible' : 'hidden' }} />;
      })}
    </div>
  );
};

// --- the club ------------------------------------------------------------------------------------------------------------------------
const BRICKS = (() => { const r = rng(1964), out: { x: number; y: number; c: string }[] = []; for (let y = 0; y < 1250; y += 34) for (let x = (y / 34) % 2 ? -38 : 0; x < W; x += 76) out.push({ x, y, c: ['#24133A', '#2A1742', '#211135', '#2E1A48'][Math.floor(r() * 4)] }); return out; })();
const PLANKS = Array.from({ length: 12 }, (_, i) => ({ y: 1230 + i * 58, c: i % 2 ? '#3A2116' : '#432719' }));
const BULBS = Array.from({ length: 9 }, (_, i) => ({ x: 70 + i * 117, y: 660 + 38 * Math.sin((i / 8) * Math.PI), ph: i * 1.7 }));
const HEADS = (() => { const r = rng(71); return Array.from({ length: 12 }, (_, i) => ({ x: -20 + i * 100 + r() * 30, y: 1800 + r() * 50, s: 0.9 + r() * 0.3, d: r() * 0.08 })); })();

const Amp: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <rect x={x} y={y} width={210} height={160} rx={8} fill="#E8DCC0" />
    <rect x={x + 10} y={y + 10} width={190} height={34} fill="#5A3A22" />
    <rect x={x + 14} y={y + 52} width={182} height={98} fill="#3B2620" />
    {Array.from({ length: 6 }, (_, i) => <line key={i} x1={x + 14 + i * 32} y1={y + 52} x2={x + 46 + i * 32} y2={y + 150} stroke="#5A3A2E" strokeWidth={3} />)}
    {[0, 1, 2, 3].map((i) => <circle key={i} cx={x + 130 + i * 18} cy={y + 27} r={5} fill="#D9C79F" />)}
  </g>
);

const Club: React.FC<{ t: number; onBeat: number }> = ({ t, onBeat }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    <defs>
      <linearGradient id="wallFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={WOOD.bg} stopOpacity={0.92} /><stop offset="0.55" stopColor={WOOD.bg} stopOpacity={0.35} /><stop offset="1" stopColor={WOOD.bg} stopOpacity={0.1} /></linearGradient>
      <radialGradient id="lampPool" cx="0.5" cy="0.6" r="0.55"><stop offset="0" stopColor={WOOD.ember} stopOpacity={0.42} /><stop offset="0.6" stopColor="#7A3E2A" stopOpacity={0.14} /><stop offset="1" stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
      <linearGradient id="spot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={WOOD.amber} stopOpacity={0.5} /><stop offset="1" stopColor={WOOD.amber} stopOpacity={0} /></linearGradient>
      <linearGradient id="lilacBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={WOOD.lilac} stopOpacity={0.3} /><stop offset="1" stopColor={WOOD.lilac} stopOpacity={0} /></linearGradient>
      <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity={0.15} /><stop offset="1" stopColor={WOOD.bg} stopOpacity={0.85} /></linearGradient>
      <radialGradient id="bulb"><stop offset="0" stopColor="#FFF4DE" /><stop offset="0.3" stopColor={WOOD.amber} stopOpacity={0.8} /><stop offset="1" stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
    </defs>
    <rect x={-600} y={-600} width={W + 1200} height={1850} fill="#1F1030" />
    {BRICKS.map((b, i) => <rect key={i} x={b.x + 2} y={b.y + 2} width={72} height={30} fill={b.c} />)}
    <rect x={-600} y={-600} width={W + 1200} height={1850} fill="url(#wallFade)" />
    <ellipse cx={560} cy={1050} rx={640} ry={520} fill="url(#lampPool)" style={{ mixBlendMode: 'screen' }} />
    {/* a string of tungsten bulbs across the back wall */}
    <path d={`M -20 ${BULBS[0].y - 40} ${BULBS.map((b) => `L ${b.x} ${b.y - 18}`).join(' ')} L 1100 ${BULBS[0].y - 40}`} fill="none" stroke="#0E0716" strokeWidth={4} />
    {BULBS.map((b, i) => { const o = 0.8 + 0.12 * cyc(t, 14, b.ph) * cyc(t, 5, b.ph); return <g key={i}><circle cx={b.x} cy={b.y} r={44} fill="url(#bulb)" opacity={0.55 * o} /><circle cx={b.x} cy={b.y} r={9} fill="#FFF4DE" opacity={o} /></g>; })}
    <Amp x={40} y={1080} /><Amp x={830} y={1080} />
    {/* the floor: warm planks, the drum riser */}
    {PLANKS.map((p, i) => <rect key={i} x={-600} y={p.y} width={W + 1200} height={56} fill={p.c} />)}
    {PLANKS.map((p, i) => <rect key={`l${i}`} x={-600} y={p.y + 56} width={W + 1200} height={2} fill="#1A0B05" />)}
    <rect x={-600} y={1230} width={W + 1200} height={700} fill="url(#floorFade)" />
    <rect x={330} y={1180} width={460} height={70} fill="#2C1810" /><rect x={330} y={1180} width={460} height={8} fill="#6A4128" />
    {/* light: an amber spot on the guitarist, two lilac beams that sway */}
    <polygon points="500,-200 600,-200 820,1660 290,1660" fill="url(#spot)" opacity={0.75 + 0.15 * onBeat} style={{ mixBlendMode: 'screen' }} />
    {[150, 930].map((x, i) => { const sw = 70 * cyc(t, 2, i * 2.4); return <polygon key={x} points={`${x - 25},-200 ${x + 25},-200 ${x + 200 + sw},1560 ${x - 200 + sw},1560`} fill="url(#lilacBeam)" opacity={0.7} style={{ mixBlendMode: 'screen' }} />; })}
  </svg>
);

/** The front row of the crowd: dark heads that nod on the beat. */
const Crowd: React.FC<{ t: number; beatAge: number }> = ({ t, beatAge }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    {HEADS.map((h, i) => {
      const nod = 12 * kick(beatAge - h.d, 7);
      return (
        <g key={i} transform={`translate(${h.x} ${h.y + nod + 3 * cyc(t, 3, i)}) scale(${h.s})`}>
          <ellipse cx={0} cy={0} rx={46} ry={54} fill="#0C0614" />
          <rect x={-82} y={38} width={164} height={260} rx={60} fill="#0C0614" />
        </g>
      );
    })}
  </svg>
);

// --- the camera ----------------------------------------------------------------------------------------------------------------------
/**
 * Where the slides are: 0 the band fills the frame, 1 it is docked at the top over the neck, 2 it has left upwards. Down to the neck at
 * DOCK, away at LEAVE (both springs), back from 2 to 0 over the last 0.7 s, easing out into frame 0.
 */
const slideAt = (t: number) => springAt(t, DOCK, SLIDE) + springAt(t, LEAVE, SLIDE) - 2 * easeInOut(clamp((t - BACK) / (LOOP - BACK)));
/** Docked, the band's 650–1600 px band of picture (drummer's head to the crowd's) fits into the top 150–720 px. */
const DOCK_K = 0.623, DOCK_D = 650;
const PAD = 400;

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const RisingBand: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = makeCam(NECK_WOOD.cameraAt(t));

  // the beat
  const bi = idxOf(t, BEATS), beatAge = ageOf(t, BEATS), noteAge = ageOf(t, NOTE_T), onBeat = kick(beatAge, 7);
  const home = t >= HOME && t < HOME + 0.45, fill = t >= FILL[0];

  // poses: everyone plays from frame 0. The guitarist rocks between two picking poses on the beat and strums big on the home chord; the
  // drummer swaps kick (beat 1) and snare (beat 2), swings on the home cymbal, raises the sticks for the pickup; the bassist digs in on each root
  const gFrame = home ? 5 : bi % 2 ? 1 : 0;
  const dFrame = home ? 2 : fill ? 3 : bi % 2 ? 1 : 0;
  const g2Frame = bi % 2 ? 1 : 0;
  const bFrame = ageOf(t, BARS) < 0.22 ? 2 : bi % 2 ? 1 : 0;
  const breathe = (ph: number) => 3 * cyc(t, 4, ph);
  const squash = (age: number, k: number) => 1 - k * kick(age, 12);
  const sway = (ph: number) => Math.sin((t * Math.PI * 2) / BAR + ph);

  // the slides: the band docks/leaves above, the neck follows below; docked, the neck sits 90 px low to clear the band
  const sl = slideAt(t), sd = clamp(sl), up = clamp(sl - 1);
  const k = 1 + (DOCK_K - 1) * sd, D = DOCK_D * sd + 1000 * up;
  const fadeA = PAD + 1920 - 320 * sd, mask = `linear-gradient(180deg, #000 ${fadeA}px, transparent ${fadeA + 160}px)`;
  const neckY = (1 - sd) * 1344 + 90 * (sd - up);
  const hookO = t < LOOP / 2 ? 1 - easeInOut(clamp((t - 2.2) / 0.3)) : easeInOut(clamp((t - (LOOP - 0.4)) / 0.4));
  const drift = 1.22 + 0.025 * (1 - Math.cos((2 * Math.PI * t) / LOOP)) / 2;

  return (
    <AbsoluteFill style={{ background: WOOD.bg, overflow: 'hidden' }}>
      {/* the neck, below the band: rises into view as the camera slides down */}
      <AbsoluteFill style={{ transform: `translateY(${neckY.toFixed(1)}px)` }}>
        <LampRoom />
        <Guitar t={t} cam={cam} names={ramp(t, T.hold + 0.5, T.hold + 0.9)} w={NECK_WOOD} />
        <AbsoluteFill style={{ background: SCRIM, opacity: up }} />
      </AbsoluteFill>

      {/* the band: full frame, then docked at the top fading into the room, then gone upwards */}
      {D < 1950 && (
        <AbsoluteFill style={{ transform: `translateY(${-D}px) scale(${k})`, transformOrigin: '540px 1000px' }}>
          {/* wider than the frame, so the docked (shrunk) stage still runs edge to edge */}
          <div style={{ position: 'absolute', left: -PAD, top: -PAD, width: W + 2 * PAD, height: H + PAD, background: WOOD.bg, overflow: 'hidden', WebkitMaskImage: mask, maskImage: mask }}>
            <div style={{ position: 'absolute', left: PAD, top: PAD, width: W, height: H, transform: `translate(${W / 2}px, ${H / 2}px) scale(${drift}) translate(-540px, -1090px)`, transformOrigin: '0 0' }}>
              <Club t={t} onBeat={onBeat} />
              <Sprite who="drummer" frame={dFrame} dy={-6 * onBeat + breathe(0) * 0.5} sy={squash(beatAge, 0.03)} />
              <Sprite who="guitarist2" frame={g2Frame} dy={-8 * onBeat + breathe(1)} lean={1.6 * sway(0)} sy={squash(beatAge, 0.025)} />
              <Sprite who="bassist" frame={bFrame} dy={-8 * onBeat + breathe(2)} lean={-1.6 * sway(1)} sy={squash(beatAge, 0.025)} />
              <Sprite who="guitarist" frame={gFrame} dy={breathe(3)} lean={1.2 * sway(0)} sy={squash(noteAge, 0.012)} />
              <Crowd t={t} beatAge={beatAge} />
            </div>
            {/* a light scrim under the hook */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: PAD, height: H, background: 'linear-gradient(180deg, rgba(26,13,46,0.75) 0%, rgba(26,13,46,0.3) 28%, rgba(26,13,46,0) 38%)', opacity: 1 - sd }} />
          </div>
        </AbsoluteFill>
      )}

      {/* scene 1 · the hook, over the band: on from frame 0, out as the camera slides; back in as the band lands at the end, so the loop's seam matches */}
      {hookO > 0.001 && (
        <AbsoluteFill style={{ opacity: hookO, transform: `translateY(${(1 - hookO) * 24}px)` }}>
          <Caps t={t} at={-9} y={260} text="ONE LISTEN" />
          <Line t={t} at={-9} y={430} size={124}>Can you play it</Line>
          <Line t={t} at={-9} y={575} size={124}><span style={{ fontStyle: 'italic', color: WOOD.lilac }}>without tabs?</span></Line>
        </AbsoluteFill>
      )}

      {/* scene 2 · note n of N, between the band and the neck */}
      <Beads t={t} y={765} S={S} from={DOCK + 0.2} />

      {/* scene 3 · your turn, and which song next; cleared before the band returns */}
      <Line t={t} at={T.cta} outAt={BACK - 0.15} y={300} size={150}>Your turn.</Line>
      <Caps t={t} at={T.sub} outAt={BACK - 0.15} y={440} text="NO TABS · JUST YOUR EARS" />
      <Line t={t} at={T.comment} outAt={BACK - 0.15} y={1560} size={66}>{'Which song should\nwe play '}<span style={{ fontStyle: 'italic', color: WOOD.lilac }}>next?</span></Line>
      <Caps t={t} at={T.comment + 0.35} outAt={BACK - 0.15} y={1720} text="TELL US BELOW ↓" color={WOOD.lilac} />

      <Lens frame={frame} />
      {!silent && <Audio src={staticFile('rising-band.wav')} />}
    </AbsoluteFill>
  );
};
