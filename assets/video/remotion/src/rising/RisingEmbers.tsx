// #71's cut with no guitar at all: the notes are embers from a campfire at the bottom of the frame. Each one rises on its note, catches at
// the height of its pitch (left → right in the order heard), overshoots a little and hangs there flickering; a thin glowing thread follows
// it from the one before, so the melody hangs as a garland — its shape, not its frets. Hook, "listen once", beads, "your turn", which song
// next, the room's colours, lens and soundtrack are RisingWood's (src/rising/RisingWood.tsx), on the same king/tunes.mjs timeline.
//   0–2.4 hook (a big ember bursts on frame 0) · 2.4–hold the embers rise · hold → end a 0.3 s hold, the view pulls back, a glow runs along
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SOFT, kick, ramp, springAt, type SpringCfg } from '../ten/motion';
import { clamp, easeOut, rng } from '../util';
import { TUNES } from '../../king/tunes.mjs';
import { WOOD, Line, Caps, Beads, YourTurn, Lens, SCRIM, woodWav } from './RisingWood';

const S = TUNES.rising;
const { T, HEARD } = S;
const FLY = 0.55;                                                          // the rise from the fire, landing on the note
const PULL: SpringCfg = { damping: 13, stiffness: 150, mass: 0.9 };       // #60's crane spring, for the pull-back
const CX = 540, CY = 1030;                                                 // the garland's centre: what the view scales about

// --- where each ember hangs: x by order, y by pitch ---------------------------------------------------------------------------------------
const LO = Math.min(...HEARD.map((n) => n.midi)), HI = Math.max(...HEARD.map((n) => n.midi));
const r0 = rng(71);
const EMBERS = HEARD.map((n, i) => ({
  i, land: n.t, big: i === HEARD.length - 1,                               // the home note: a larger ember, the strum
  x: 100 + (880 * i) / (HEARD.length - 1),
  y: 1380 - ((n.midi - LO) / (HI - LO)) * 680,
  from: 380 + r0() * 320, sway: (r0() - 0.5) * 260, ph: r0() * 6.28,      // where in the fire it starts, how its path bends, its flicker phase
}));
type Ember = (typeof EMBERS)[number];

/** The ember's position: rising from the fire (easing in, so it arrives on the note), then a small overshoot upward that settles. */
function emberAt(e: Ember, t: number): [number, number] | null {
  const a = t - (e.land - FLY);
  if (a < 0) return null;
  if (t < e.land) {
    const u = (a / FLY) ** 1.6, bend = Math.sin(Math.PI * u) * e.sway;
    return [e.from + (e.x - e.from) * u + bend, 1980 + (e.y - 1980) * u];
  }
  const age = t - e.land;
  return [e.x, e.y - 34 * Math.exp(-age * 6) * Math.sin(age * 14) + 5 * Math.sin(t * 1.3 + e.ph)];   // follow-through, then breathing
}

/** Ambient sparks off the fire: smaller and dimmer than the notes, so they never read as one. Fixed by seed. */
const r1 = rng(1964);
const SPARKS = Array.from({ length: 46 }, () => ({ x: 300 + r1() * 480, v: 0.18 + r1() * 0.25, ph: r1(), drift: (r1() - 0.5) * 120, r: 1.5 + r1() * 2 }));

const Fire: React.FC<{ t: number }> = ({ t }) => {
  const flick = 0.85 + 0.08 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 13.7 + 1);
  const hit = EMBERS.reduce((m, e) => m + (e.big ? 0.5 : 0.12) * kick(t - (e.land - FLY), 6), 0) + 0.6 * kick(t, 4);   // it flares as each ember leaves
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 26% at 50% 104%, rgba(255,154,60,${0.75 * flick + 0.25 * Math.min(1, hit)}) 0%, rgba(160,70,30,${0.4 * flick}) 45%, rgba(0,0,0,0) 80%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 90% 40% at 50% 8%, rgba(145,132,217,0.22) 0%, rgba(145,132,217,0) 70%)' }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {SPARKS.map((p, i) => {
          const u = (t * p.v + p.ph) % 1, y = 1960 - u * 1100, x = p.x + p.drift * u + 14 * Math.sin(t * 2 + i);
          return <circle key={i} cx={x} cy={y} r={p.r * (1 - u)} fill={WOOD.amber} opacity={0.5 * (1 - u) ** 1.5} />;
        })}
      </svg>
    </>
  );
};

/** The garland: threads, rising embers with their trails, landing flares, hanging embers. */
const Garland: React.FC<{ t: number }> = ({ t }) => {
  const sweep = (t - T.sweep) / 1.1;                                       // the closing glow runs left → right along the garland
  const glowAt = (x: number) => (sweep > 0 && sweep < 1.2 ? Math.exp(-(((x - (40 + 1000 * sweep)) / 90) ** 2)) : 0);
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="emb"><stop offset={0} stopColor="#FFF4DE" /><stop offset={0.35} stopColor={WOOD.amber} /><stop offset={0.7} stopColor={WOOD.ember} stopOpacity={0.55} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient>
        <filter id="glowE" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={10} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* threads: each grows from the ember before to this one just after it lands (it lags the ember — follow-through) and sags */}
      <g filter="url(#glowE)">
        {EMBERS.slice(1).map((e) => {
          const prev = EMBERS[e.i - 1], grow = easeOut(clamp((t - e.land - 0.04) / 0.18));
          if (grow <= 0) return null;
          const a = emberAt(prev, t)!, b = emberAt(e, t)!, mx = (a[0] + b[0]) / 2, my = Math.max(a[1], b[1]) + 22;
          const end: [number, number] = [a[0] + (b[0] - a[0]) * grow, a[1] + (b[1] - a[1]) * grow];
          const ctl: [number, number] = [a[0] + (mx - a[0]) * grow, a[1] + (my - a[1]) * grow];
          return <path key={e.i} d={`M${a[0]},${a[1]} Q${ctl[0]},${ctl[1]} ${end[0]},${end[1]}`} fill="none" stroke={WOOD.amber} strokeWidth={1.6 + 2 * glowAt(mx)} opacity={0.32 + 0.6 * glowAt(mx)} />;
        })}
      </g>

      {/* rising embers: a hot point with a short trail, a spark or two shed behind */}
      <g filter="url(#glowE)">
        {EMBERS.map((e) => {
          if (t >= e.land || t < e.land - FLY) return null;
          const p = emberAt(e, t)!, q = emberAt(e, Math.max(e.land - FLY, t - 0.07))!;
          return (
            <g key={e.i}>
              <line x1={q[0]} y1={q[1]} x2={p[0]} y2={p[1]} stroke={WOOD.amber} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
              <circle cx={p[0]} cy={p[1]} r={7} fill="#FFF4DE" />
              {[0.12, 0.2].map((d, k) => { const s = emberAt(e, Math.max(e.land - FLY, t - d))!; return <circle key={k} cx={s[0] + (k ? 9 : -7)} cy={s[1] + 6} r={2.5} fill={WOOD.amber} opacity={0.6 - k * 0.2} />; })}
            </g>
          );
        })}
      </g>

      {/* landing: a ring opens where the ember catches */}
      {EMBERS.map((e) => {
        const u = (t - e.land) / 0.7;
        if (u < 0 || u >= 1) return null;
        return <circle key={e.i} cx={e.x} cy={e.y} r={10 + (e.big ? 120 : 46) * easeOut(u)} fill="none" stroke={WOOD.amber} strokeWidth={2} opacity={0.65 * (1 - u)} />;
      })}

      {/* hanging embers: they pop in with an overshoot, then flicker */}
      {EMBERS.map((e) => {
        if (t < e.land) return null;
        const p = emberAt(e, t)!, s = Math.min(1.25, springAt(t, e.land, SOFT));
        const flick = 0.82 + 0.1 * Math.sin(t * 7.3 + e.ph) + 0.08 * Math.sin(t * 11.9 + e.ph * 2);
        const r = (e.big ? 26 : 15) * s * (1 + 0.3 * kick(t - e.land, 7) + 0.5 * glowAt(e.x));
        return (
          <g key={e.i}>
            <circle cx={p[0]} cy={p[1]} r={r * 2.6} fill="url(#emb)" opacity={0.5 * flick} />
            <circle cx={p[0]} cy={p[1]} r={r} fill="url(#emb)" opacity={flick} />
            <circle cx={p[0]} cy={p[1]} r={r * 0.38} fill="#FFF7E8" />
          </g>
        );
      })}
    </svg>
  );
};

/** #60's opening hit without a neck: a big ember bursts mid-frame on frame 0 and throws sparks, gone by 1.55 s like the hook note. */
const r2 = rng(7);
const BURST = Array.from({ length: 22 }, () => ({ a: r2() * Math.PI * 2, v: 260 + r2() * 420 }));
const HookEmber: React.FC<{ t: number }> = ({ t }) => {
  const out = 1 - clamp((t - 1.3) / 0.25) ** 2;
  if (out <= 0) return null;
  const r = 40 * Math.min(1.2, springAt(t, 0, SOFT) + 0.4) * (1 + 0.4 * kick(t, 5)) * out;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs><radialGradient id="embH"><stop offset={0} stopColor="#FFF4DE" /><stop offset={0.35} stopColor={WOOD.amber} /><stop offset={0.7} stopColor={WOOD.ember} stopOpacity={0.55} /><stop offset={1} stopColor={WOOD.ember} stopOpacity={0} /></radialGradient></defs>
      {BURST.map((b, i) => { const d = b.v * (1 - Math.exp(-t * 3)), g = 140 * t * t; return <circle key={i} cx={CX + Math.cos(b.a) * d} cy={CY + Math.sin(b.a) * d + g} r={3.5 * (1 - clamp(t / 1.3))} fill={WOOD.amber} opacity={(1 - clamp(t / 1.3)) * out} />; })}
      <circle cx={CX} cy={CY} r={r * 3} fill="url(#embH)" opacity={0.5} />
      <circle cx={CX} cy={CY} r={r} fill="url(#embH)" />
      <circle cx={CX} cy={CY} r={r * 0.4} fill="#FFF7E8" />
      <circle cx={CX} cy={CY} r={20 + 260 * easeOut(clamp(t / 0.9))} fill="none" stroke={WOOD.amber} strokeWidth={2} opacity={0.65 * (1 - clamp(t / 0.9))} />
    </svg>
  );
};

export const RisingEmbers: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // the view: a slow push in while the embers rise, a small push on each landing, then after a 0.3 s hold a pull back with one overshoot
  const push = EMBERS.reduce((m, e) => m + (e.big ? 0.03 : 0.006) * kick(t - e.land, 10), 0.012 * kick(t, 8));
  const zoom = 1 + 0.06 * ramp(t, T.listenAt, T.hold) - 0.13 * springAt(t, T.hold + 0.3, PULL) + push;

  return (
    <AbsoluteFill style={{ background: WOOD.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${CX}px ${CY}px` }}>
        <HookEmber t={t} />
        <Garland t={t} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: SCRIM }} />
      <Fire t={t} />{/* over the scrim: the type's dark band at the bottom would put it out */}

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.2} outAt={2.2} y={260} text="ONE LISTEN" />
      <Line t={t} at={-0.2} outAt={2.2} y={430} size={124}>Can you play it</Line>
      <Line t={t} at={0.15} outAt={2.2} y={575} size={124}><span style={{ fontStyle: 'italic', color: WOOD.lilac }}>without tabs?</span></Line>

      {/* scene 2 · hear the melody, once */}
      <Line t={t} at={T.listen + 0.05} outAt={T.hold} y={290} size={96} italic>Listen once.</Line>
      <Beads t={t} y={400} S={S} />

      {/* scene 3 · your turn, and which song next */}
      <YourTurn t={t} T={T} />
      <Lens frame={frame} />
      {!silent && <Audio src={staticFile(woodWav('rising'))} />}
    </AbsoluteFill>
  );
};
