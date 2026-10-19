// "Tabs guy" — 60 s animated sketch. One timeline (../../pain/story.mjs) drives the soundtrack and every frame here.
// All coordinates are scene space (1080×1920); the camera shifts/zooms the scene group, the lower panel and the text sit on top of it.
import React from 'react';
import { AbsoluteFill, Audio, spring, staticFile, useVideoConfig } from 'remotion';
import { ClockProvider, Seq, useCurrentFrame, useFx } from '../clock';
import { C, alpha, FONT } from '../theme';
import { clamp, easeInOut, easeOut, lerp } from '../util';
import { Background } from '../Background';
import { Headline, Rich } from '../Headline';
import { Wipe } from '../Wipe';
import {
  T, RIFF, ATTEMPTS, QUIET_MELODY, QUIET_LINE2, QUIET_HARMONY, QUIET_CHORD_AT, END_MELODY, END_CHORD_AT, RESTARTS, WRONG_AT, ATTEMPTS as AT,
  type PNote,
} from '../../pain/story.mjs';
import { Person, GuitarShape, GUITAR_POSE, type Mood, type V, type PersonProps } from './Person';
import { RoomBg, RoomFront, PartyBg } from './Rooms';
import { Bubble, TabScreen, PhoneCard, SearchPhone, Floaters, Chip, Caption } from './Items';
import { Inset } from './Inset';
import { srcAt } from '../../pain/cut.mjs';

void AT;
const FPS = 60;

// --- cast -----------------------------------------------------------------------------------------------------------------------------
const TAB = { skin: '#f0c3a0', shirt: '#7a74d6', hair: 'short', hairColor: '#3a2a22' } as const;
const QUIET = { skin: '#d9a07a', shirt: '#3d4064', hair: 'short', hairColor: '#171420', sleeves: 'short' } as const;
type Key = [number, Mood, number?, number?];
interface Extra { id: string; seed: number; base: [number, number, number]; cluster: [number, number, number]; delay: number; props: Omit<PersonProps, 'x' | 'y' | 't' | 'mood'>; keys: Key[]; talk?: [number, number][]; cup?: [number, number]; phone?: [number, number] }
const CROWD: Extra[] = [
  { id: 'g1', seed: 3, base: [170, 900, 0.74], cluster: [300, 1115, 0.9], delay: 0, props: { skin: '#f6d3b8', shirt: '#f2b6d0', hair: 'long', hairColor: '#6b3a1e' }, talk: [[11.2, 12.6]], cup: [11, 49.3],
    keys: [[0, 'happy'], [12.7, 'grin'], [20.35, 'tense'], [21.8, 'happy'], [26.45, 'cringe'], [27.4, 'tense'], [28.3, 'neutral'], [31, 'bored'], [34.9, 'cringe'], [36.5, 'tense', -0.6, 0.4], [39.2, 'neutral', -0.8, 0.3], [41, 'neutral'], [43.3, 'awe'], [44.6, 'happy'], [46.4, 'love']] },
  { id: 'beanie', seed: 7, base: [400, 880, 0.74], cluster: [410, 905, 0.8], delay: 0.25, props: { skin: '#d9a07a', shirt: '#9bd18a', hair: 'beanie', hairColor: '#222', accent: '#ff8a4a' }, talk: [[11.6, 12.5]], phone: [29.5, 43.2],
    keys: [[0, 'happy'], [12.7, 'happy'], [20.35, 'cringe'], [21.8, 'neutral'], [26.45, 'tense'], [28.3, 'bored'], [34.9, 'tense'], [36.5, 'bored', -0.6, 0.6], [41, 'neutral'], [43.3, 'awe'], [45, 'grin']] },
  { id: 'g2', seed: 5, base: [690, 880, 0.74], cluster: [790, 1110, 0.9], delay: 0.15, props: { skin: '#f0c3a0', shirt: '#7fd1c4', hair: 'bun', hairColor: '#e8c27a' }, talk: [[26.6, 28.6]], cup: [11, 49.3],
    keys: [[0, 'happy'], [12.7, 'grin'], [20.35, 'worry'], [21.8, 'happy'], [26.45, 'cringe'], [26.9, 'tense', -0.9, 0], [28.6, 'worry'], [31, 'bored'], [34.9, 'cringe'], [36.5, 'tense', 0.5, 0.4], [41, 'neutral'], [43.3, 'awe'], [45.4, 'love']] },
  { id: 'g3', seed: 9, base: [920, 900, 0.74], cluster: [680, 890, 0.8], delay: 0.35, props: { skin: '#a56b4a', shirt: '#ffd36e', hair: 'curly', hairColor: '#2a1a14' }, cup: [11, 49.3],
    keys: [[0, 'happy'], [12.7, 'grin'], [20.35, 'tense'], [21.8, 'happy'], [26.45, 'tense'], [28.3, 'neutral'], [31, 'yawn'], [33.6, 'bored'], [35, 'cringe'], [37, 'bored'], [41, 'neutral'], [43.3, 'awe'], [45, 'love']] },
  { id: 'friend', seed: 4, base: [190, 1210, 0.95], cluster: [110, 960, 0.8], delay: 0.3, props: { skin: '#a56b4a', shirt: '#e8445a', hair: 'cap', hairColor: '#1a1410', accent: '#2d6cdf' }, talk: [[11.4, 12.6], [12.8, 13.8]],
    keys: [[0, 'happy'], [12.7, 'grin'], [14.5, 'happy'], [17.5, 'grin'], [20.35, 'tense'], [21.8, 'happy'], [26.45, 'tense'], [28.3, 'neutral'], [34.9, 'cringe'], [37, 'worry'], [41, 'neutral'], [43.3, 'awe'], [45, 'grin']] },
];
const KEEP = (keys: Key[], t: number): Key => { let k = keys[0]; for (const x of keys) if (x[0] <= t) k = x; return k; };
const inRange = (r: [number, number][] | undefined, t: number) => !!r?.some(([a, b]) => t >= a && t <= b);

// --- helpers --------------------------------------------------------------------------------------------------------------------------
const fretU = (f: number) => 0.22 + f * 0.05;
/** Where the fretting hand is and how far through its pick stroke the other one is. */
function handFor(notes: PNote[], t: number) {
  let i = -1;
  for (let k = 0; k < notes.length; k++) { if (notes[k].t <= t) i = k; else break; }
  if (i < 0) return { u: fretU(notes[0]?.f ?? 0), strum: 1 };
  const n = notes[i], nx = notes[i + 1];
  let u = fretU(n.f);
  if (nx) { const gap = nx.t - n.t, k = clamp((t - (n.t + gap * 0.5)) / (gap * 0.45)); u += (fretU(nx.f) - u) * k * k * (3 - 2 * k); }
  return { u, strum: (t - n.t) / 0.2 };
}
const nearNote = (notes: PNote[], t: number, w = 0.18) => notes.some((n) => t >= n.t && t < n.t + w);
const last = <X,>(a: X[]) => a[a.length - 1];

const Dim: React.FC<{ o: number }> = ({ o }) => (o > 0.01 ? <rect width={1080} height={1920} fill="#07070f" opacity={o} /> : null);

// ===================================================================================================================================
// Scene 1–2 · the room (0–11 s)
// ===================================================================================================================================
const RoomScene: React.FC<{ t: number }> = ({ t }) => {
  const hits = RIFF.filter((n) => t >= n.t && t < n.t + 0.12);
  const { u, strum } = handFor(RIFF, t);
  const drift = 1 + 0.03 * clamp(t / 11);
  const songs = Math.round(lerp(12, 47, easeOut((t - 3.2) / 7.4)));
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(540 1200) scale(${drift}) translate(-540 -1200)`}>
          <RoomBg t={t} />
          {/* tablet on a stand, left */}
          <rect x={268} y={850} width={16} height={700} fill="#2a2a46" />
          <TabScreen x={30} y={540} w={500} h={330} t={t} notes={RIFF} />
          <Person
            x={640} y={1385} scale={1.35} t={t} seed={2} {...TAB} mood={t < 6 ? 'smug' : 'grin'} look={[-0.9, -0.5]}
            guitar={{ u, strum, glow: hits.length ? 1 : 0 }} bob={Math.sin(t * 6.28 * 2) * 2.5} lean={Math.sin(t * 3.1) * 1.5}
          />
          <RoomFront />
          <Floaters t={t} t0={3} t1={11} cx={700} cy={1130} spread={190} every={0.34} kind="note" rise={420} size={1.15} />
        </g>
      </svg>
      {t >= T.legend && (
        <Chip x={270} y={190} w={540} label="Songs played" value={String(songs)} pop={easeOut((t - T.legend) / 0.4)} />
      )}
    </>
  );
};

// ===================================================================================================================================
// Scenes 3–6 · the party (11–53 s)
// ===================================================================================================================================
const smooth = (a: number, b: number, t: number) => easeInOut((t - a) / (b - a));
const mix2 = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

const TAB_SLOT: [number, number, number] = [540, 1390, 1.22];
const TAB_CORNER: [number, number, number] = [975, 1350, 0.78];
const Q_START: [number, number, number] = [890, 1215, 0.95];

function tabPos(t: number) { return mix2(TAB_SLOT, TAB_CORNER, smooth(39.7, 41.3, t)); }
function quietPos(t: number) { return mix2(Q_START, TAB_SLOT, smooth(38.9, 40.7, t)); }

function worldGuitar(p: [number, number, number]) { return { x: p[0] + GUITAR_POSE.x * p[2], y: p[1] + GUITAR_POSE.y * p[2], rot: GUITAR_POSE.rot, s: p[2] }; }
function guitarProp(t: number): { x: number; y: number; rot: number; s: number } | null {
  const friendAt = CROWD[4].base;
  const stand = { x: friendAt[0] + 190, y: 1215, rot: 82, s: 0.95 };          // held upright beside the friend
  const offer = { x: friendAt[0] + 330, y: 1300, rot: 40, s: 1.0 };            // offered across
  if (t < 12.7) return stand;
  if (t < 13.2) { const k = smooth(12.7, 13.2, t); return { x: lerp(stand.x, offer.x, k), y: lerp(stand.y, offer.y, k), rot: lerp(stand.rot, offer.rot, k), s: lerp(stand.s, offer.s, k) }; }
  if (t < 13.8) { const g = worldGuitar(TAB_SLOT), k = smooth(13.2, 13.8, t); return { x: lerp(offer.x, g.x, k), y: lerp(offer.y, g.y, k), rot: lerp(offer.rot, g.rot, k), s: lerp(offer.s, g.s, k) }; }
  if (t >= 39.5 && t < 40.7) {                                                  // the hand-over: Tab Guy → Quiet Guy
    const a = worldGuitar(TAB_SLOT), b = worldGuitar(TAB_SLOT), k = smooth(39.5, 40.7, t);
    const mid = { x: 760, y: 1300 };
    const cx = k < 0.5 ? lerp(a.x, mid.x, k * 2) : lerp(mid.x, b.x, (k - 0.5) * 2), cy = k < 0.5 ? lerp(a.y, mid.y, k * 2) : lerp(mid.y, b.y, (k - 0.5) * 2);
    return { x: cx, y: cy, rot: GUITAR_POSE.rot + Math.sin(k * Math.PI) * -22, s: lerp(a.s, b.s, k) };
  }
  return null;
}

const PartyScene: React.FC<{ t: number }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fx = useFx();
  const sp = (at: number, cfg = { damping: 13, stiffness: 190, mass: 0.8 }) => spring({ frame: frame - at * fps, fps, config: cfg });

  // camera: slide up when the panel arrives, slow push-in during the fail
  const camY = -170 * smooth(16.5, 17.3, t);
  const push = 1 + 0.08 * smooth(17, 37, t) - 0.08 * smooth(39.5, 41.5, t) + (fx ? 0.06 * smooth(43.5, 50.5, t) : 0);
  // cut only: a wrong note punches the camera in on the loser's face (with a shake), then lets go; the grade goes cold, then warm
  const lastWrong = WRONG_AT.filter((w) => t >= w).pop();
  const wd = lastWrong === undefined ? 9 : t - lastWrong;
  const zoomK = fx && wd < 1.4 ? Math.min(1, wd / 0.07) * Math.exp(-Math.max(0, wd - 0.07) * 2.8) : 0;
  const shakeK = fx && wd < 0.6 ? Math.exp(-wd * 8) : 0;
  const shx = Math.sin(t * 95) * 9 * shakeK, shy = Math.cos(t * 83) * 7 * shakeK;
  const pv = tabPos(t), pvx = pv[0], pvy = pv[1] - 230 * pv[2];
  const cold = fx ? smooth(17, 18.5, t) * (1 - smooth(39.5, 41, t)) : 0;
  const warm = fx ? smooth(41.5, 44, t) : 0;
  const panel = smooth(16.6, 17.3, t);

  // --- main characters
  const tp = tabPos(t), qp = quietPos(t);
  const tabHasGuitar = t >= 13.8 && t < 39.5;
  const gProp = guitarProp(t);
  const quietHasGuitar = t >= 40.7;
  const phoneMode = t >= T.phone && t < 16.3;

  // Tab Guy mood/props over time
  let tabMood: Mood = 'happy';
  let tabLook: V = [-1, 0];
  let tabSweat = 0;
  if (t >= 12.7) { tabMood = 'worry'; tabLook = [-0.9, -0.1]; }
  if (t >= 14.1) { tabMood = 'worry'; tabLook = [0, 0.8]; tabSweat = clamp((t - 14.1) / 2.2); }
  if (t >= 16.3) { tabMood = 'tense'; tabLook = [0.2, 0.7]; tabSweat = 0.3; }
  if (t >= T.fail) { tabMood = 'focus'; tabLook = [-0.3, 0.9]; }
  const wrongSince = WRONG_AT.map((w) => t - w).filter((d) => d >= 0 && d < 1.4);
  if (wrongSince.length) { tabMood = 'cringe'; tabLook = [-0.4, 1]; }
  if (t >= 28.3 && t < 34.9 && !wrongSince.length) { tabMood = t > 32.3 && t < 34.4 ? 'worry' : 'tense'; tabLook = [-0.3, 1]; }
  if (t >= 20 && t < 37) tabSweat = (((t - 20) * 0.45) % 1);
  if (t >= 36.0 && t < 39.6) { tabMood = 'sad'; tabLook = [0.4, 0.9]; tabSweat = 0; }
  if (t >= 39.6) { tabMood = 'sad'; tabLook = [0, 0.9]; tabSweat = 0; }
  if (fx && t >= 45.3) { tabMood = 'worry'; tabLook = [1, 0.35]; }                 // his search finds nothing: he turns away
  const failHand = handFor(ATTEMPTS, t);
  const frozen = t > 33.8 && t < 34.9;
  const jitter = t >= T.fail && t < 37 ? 3 + 7 * Math.abs(Math.sin(t * 0.7)) + (frozen ? 6 : 0) : 0;

  const tabProps: Partial<PersonProps> = {};
  if (t < 13.8) { tabProps.left = [-92, -40]; tabProps.leftHold = 'cup'; tabProps.right = [104, 30]; }
  else if (phoneMode) {
    tabProps.showGuitar = true; tabProps.left = [-150, -150]; tabProps.leftHold = 'phone'; tabProps.right = [110, -10];
  } else if (tabHasGuitar) {
    tabProps.guitar = { u: failHand.u, strum: failHand.strum, jitter };
    if (t >= 13.8 && t < 14.1) { tabProps.guitar = undefined; tabProps.showGuitar = true; }
  } else if (t >= 39.5) {
    tabProps.left = t > 42.5 ? [-80, -110] : [-112, 40]; tabProps.leftHold = t > 42.5 ? 'phone' : undefined; tabProps.right = [112, 40];
  }

  // Quiet Guy
  const qNotes = [...QUIET_MELODY, ...QUIET_LINE2];
  const qHand = handFor(qNotes, t);
  let qMood: Mood = 'neutral', qLook: V = [-0.5, 0];
  if (t >= 17.5) { qMood = 'focus'; qLook = [-0.4, 0.2]; }
  if (t >= 26.45 && t < 28) qMood = 'neutral';
  if (t >= 34.9) { qMood = 'neutral'; qLook = [-0.5, 0.1]; }
  if (t >= 38.6) { qMood = 'focus'; qLook = [-0.6, 0.2]; }
  if (t >= 41 && t < 42.5) { qMood = 'zen'; qLook = [0, 0]; }
  if (t >= 42.5) { qMood = 'focus'; qLook = [0, 0.7]; }
  if (t >= 46.5) qMood = 'happy';
  if (t >= 49.3) qMood = 'grin';
  const qProps: Partial<PersonProps> = {};
  if (quietHasGuitar) qProps.guitar = { u: qHand.u, strum: qHand.strum, glow: nearNote(qNotes, t) ? 1 : 0 };
  else qProps.left = t < 39.5 ? [-92, -40] : [-112, 40], qProps.leftHold = t < 39.5 ? 'cup' : undefined, qProps.right = [112, 34];

  // crowd positions & faces
  const crowd = CROWD.map((c) => {
    const k = smooth(43 + c.delay, 44.8 + c.delay, t);
    const [x, y, s] = mix2(c.base, c.cluster, k);
    const key = KEEP(c.keys, t);
    const cx = x, tgt = key[2] ?? clamp((540 - cx) / 260, -1, 1);
    const look: V = [tgt, key[3] ?? 0.05];
    const talking = inRange(c.talk, t) ? 0.45 + 0.45 * Math.sin(t * 13 + c.seed * 2) : 0;
    const clap = t >= 49.4 && t < 53 + 0.5;
    const extra: Partial<PersonProps> = {};
    if (c.id === 'friend' && gProp && t < 13.8) {
      const r = (gProp.rot * Math.PI) / 180, nx = -215, hx = gProp.x + (nx * Math.cos(r)) * gProp.s, hy = gProp.y + (nx * Math.sin(r)) * gProp.s;
      extra.right = [(hx - x) / s, (hy - y) / s];
    } else if (clap) {
      const w = Math.sin(t * 14 + c.seed);
      extra.left = [-24 - 16 * w, -92]; extra.right = [24 + 16 * w, -92];
    } else if (c.phone && t >= c.phone[0] && t < c.phone[1]) { extra.left = [-70, -96]; extra.leftHold = 'phone'; extra.right = [112, 34]; }
    else if (c.cup && t >= c.cup[0] && t < c.cup[1]) { extra.left = [-92, -40]; extra.leftHold = 'cup'; extra.right = [112, 34]; }
    return { c, x, y, s, mood: key[1], look, talk: talking, extra, bob: Math.sin(t * 2.2 + c.seed) * 3 };
  });

  // draw order: back to front
  type Item = { y: number; node: React.ReactNode };
  const items: Item[] = [];
  for (const o of crowd) {
    const wiggle = t >= 49.4 ? Math.abs(Math.sin(t * 7 + o.c.seed)) * -10 : 0;
    items.push({
      y: o.y,
      node: <Person key={o.c.id} x={o.x} y={o.y + wiggle} scale={o.s} t={t} seed={o.c.seed} {...o.c.props} mood={o.mood} look={o.look} talk={o.talk} bob={o.bob} {...o.extra} />,
    });
  }
  items.push({
    y: tp[1] + 0.1,
    node: (
      <Person key="tab" x={tp[0]} y={tp[1]} scale={tp[2]} t={t} seed={2} {...TAB} mood={tabMood} look={tabLook} sweat={tabSweat}
        bob={Math.sin(t * 2) * 2.5 + (t >= T.fail && t < 37 ? Math.sin(t * 17) * 1.2 : 0)} lean={t > 36 && t < 39.5 ? 3 : 0} gray={t >= 41 ? 0.55 * smooth(41, 43, t) : 0} {...tabProps} />
    ),
  });
  items.push({
    y: qp[1],
    node: <Person key="quiet" x={qp[0]} y={qp[1]} scale={qp[2]} t={t} seed={6} {...QUIET} mood={qMood} look={qLook} bob={Math.sin(t * 2.6) * 2.5 + (t > 43 ? Math.sin(t * 5) * 2 : 0)} {...qProps} />,
  });
  items.sort((a, b) => a.y - b.y);

  const dim = phoneMode ? 0.55 * Math.min(clamp((t - T.phone) / 0.25), clamp((16.3 - t) / 0.25)) : 0;
  const hearts = t >= 46.4 && t < 53;

  const cxForBubble = tp[0];
  const winP = sp(T.ask);

  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, filter: fx ? `saturate(${1 - 0.35 * cold + 0.3 * warm}) brightness(${1 - 0.1 * cold + 0.04 * warm})` : undefined }}>
        <g transform={`translate(0 ${camY}) translate(540 900) scale(${push}) translate(-540 -900)`}>
          <g transform={`translate(${shx} ${shy}) translate(${pvx} ${pvy}) scale(${1 + 0.2 * zoomK}) translate(${-pvx} ${-pvy})`}>
          <PartyBg t={t} />
          {items.map((it, i) => <g key={i}>{it.node}</g>)}
          {/* the standing / travelling guitar */}
          {gProp && (
            <g transform={`translate(${gProp.x} ${gProp.y}) rotate(${gProp.rot}) scale(${gProp.s})`}><GuitarShape /></g>
          )}
          {/* bubbles */}
          <Bubble cx={420} cy={640} lines={['Play something!']} tx={CROWD[4].base[0] + 40} ty={940} p={t >= T.ask && t < 14.3 ? winP : 0} size={56} />
          <Bubble cx={cxForBubble} cy={800} lines={['…one sec,', 'I know it with tabs']} tx={cxForBubble} ty={930} p={t >= 36 && t < 38.1 ? sp(36) : 0} size={46} />
          <Bubble cx={410} cy={650} lines={['cough']} tx={400} ty={780} p={t >= 38.4 && t < 39.8 ? sp(38.4) : 0} size={42} fill="#ecebff" />
          {t >= 38.4 && t < 40.4 && (
            <text x={540} y={620} textAnchor="middle" fontFamily={FONT} fontStyle="italic" fontSize={46} fill={alpha(C.text, 0.55)} opacity={Math.sin(t * 9) > -0.2 ? 1 : 0.2}>chirp… chirp…</text>
          )}
          {/* Quiet Guy listens */}
          {t >= 41 && t < 42.6 && [0, 1, 2].map((i) => {
            const p = ((t - 41) * 1.1 + i / 3) % 1;
            return <path key={i} d={`M ${qp[0] - 120 - p * 60} ${qp[1] - 262 * qp[2] - 40 * (0.6 + p)} q -30 ${40 * (0.6 + p)} 0 ${80 * (0.6 + p)}`} stroke={C.accent3} strokeWidth={9} fill="none" strokeLinecap="round" opacity={1 - p} />;
          })}
          {t >= 41 && t < 42.6 && <Floaters t={t} t0={41} t1={42.4} cx={qp[0] - 140} cy={qp[1] - 262 * qp[2] - 20} spread={40} every={0.35} kind="note" rise={160} size={0.9} />}
          {/* the loser googles it */}
          <SearchPhone cx={925} cy={640} p={t >= 43.8 && t < 52.5 ? sp(43.8) : 0} text={t < 44.4 ? 'ode to jo|' : t < 45.2 ? 'ode to joy ta|' : 'ode to joy tab'} status={fx && t >= 45.7 ? 'No signal' : undefined} />
          <Floaters t={t} t0={43} t1={53} cx={qp[0] + 30} cy={qp[1] - 250 * qp[2]} spread={170} every={0.42} kind="note" rise={420} size={1.1} />
          {hearts && <Floaters t={t} t0={46.4} t1={53} cx={300} cy={820} spread={90} every={0.5} kind="heart" rise={260} />}
          {hearts && <Floaters t={t} t0={46.9} t1={53} cx={790} cy={830} spread={90} every={0.5} kind="heart" rise={260} />}
          <Dim o={dim} />
          </g>
        </g>
        <PhoneCard cx={540} cy={820} p={t >= T.phone && t < 16.3 ? Math.min(sp(T.phone), clamp((16.3 - t) / 0.25)) : 0} t={t} />
        {/* lower panel */}
        <g transform={`translate(0 ${(1 - panel) * 640})`}>
          <rect x={0} y={1310} width={1080} height={700} fill="#0e0f1d" />
          <rect x={0} y={1310} width={1080} height={4} fill={alpha(C.accent3, 0.45)} />
        </g>
      </svg>
      {fx && <Grade t={t} cold={cold} warm={warm} />}
      <PartyHud t={t} panel={panel} />
    </>
  );
};

/** Cut only: cold vignette while he fails, a warm spotlight and swinging party lights once the quiet guy plays. */
const Grade: React.FC<{ t: number; cold: number; warm: number }> = ({ t, cold, warm }) => {
  const lights = warm * clamp((t - 46.0) / 1.2);
  const beat = Math.exp(-((t % 0.5) / 0.5) * 5);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1310, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 760px 760px at 50% 62%, rgba(255,184,107,${0.2 * warm}) 0%, transparent 70%)`, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 70% at 50% 58%, transparent 40%, rgba(6,5,18,${0.42 * cold + 0.22 * warm}) 100%)` }} />
      {lights > 0.01 && [0, 1].map((i) => (
        <div key={i} style={{ position: 'absolute', left: i ? 600 + 120 * Math.sin(t * 2.3 + 1) : -120 + 120 * Math.sin(t * 1.9), top: -160, width: 560, height: 960, mixBlendMode: 'screen', transform: `rotate(${i ? -14 : 14}deg)`,
          background: `radial-gradient(closest-side, ${i ? 'rgba(90,220,255,' : 'rgba(255,90,170,'}${0.34 * lights * (0.65 + 0.35 * beat)}) 0%, transparent 100%)` }} />
      ))}
    </div>
  );
};

const PartyHud: React.FC<{ t: number; panel: number }> = ({ t, panel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fx = useFx();
  const lastW = last(WRONG_AT.filter((w) => t >= w));
  const kickW = fx && lastW !== undefined ? 1.1 * Math.exp(-(t - lastW) * 7) : 0;
  const crowdPct = Math.round(100 * easeOut(clamp((t - 43.2) / 6.4)));
  const pop = (at: number) => spring({ frame: frame - at * fps, fps, config: { damping: 12, stiffness: 220 } });
  const restarts = RESTARTS.filter((r) => t >= r).length;
  const wrongs = WRONG_AT.filter((w) => t >= w).length;
  const inFail = t >= T.fail && t < T.quiet;
  const board: PNote[] = t < T.silence + 0.5 ? ATTEMPTS : [...QUIET_MELODY, ...QUIET_LINE2, ...QUIET_HARMONY].sort((a, b) => a.t - b.t);
  const quietMode = t >= T.quiet;
  const dim = t >= T.silence && t < T.quiet ? 0.55 : 0;
  const lastRestart = last(RESTARTS.filter((r) => t >= r)) ?? 0;
  void lastRestart;
  return (
    <>
      {/* captions over the party */}
      <Caption lines={['Then someone', 'says…']} from={11.15} to={12.65} top={420} size={92} />
      <Caption lines={['…and your tab', 'is *gone.*']} from={16.35} to={16.9} top={1500} size={80} />
      {panel > 0.5 && (
        <>
          <Caption lines={['You know this song.', '*Your hands don’t.*']} from={18.1} to={25.2} top={1326} size={56} />
          <Caption lines={['The notes were *right there.*']} from={25.5} to={35.8} top={1344} size={56} />
          <Caption lines={['…']} from={T.silence + 0.3} to={T.quiet - 0.2} top={1332} size={96} />
          <Caption lines={['He didn’t read it.']} from={T.quiet + 0.4} to={45.6} top={1344} size={64} />
          <Caption lines={['He *heard* it.']} from={45.8} to={fx ? 47.0 : T.end - 0.15} top={1344} size={74} />
          {fx && <Caption lines={['The room *lights up.*']} from={47.1} to={50.9} top={1344} size={64} />}
          <Inset x={(1080 - 920 * 0.4) / 2} y={1450} k={0.4} t={t} notes={board} dim={dim} hold={quietMode ? 0.55 : 0.85} />
          {(inFail || t >= T.silence) && !quietMode && (
            <>
              <Chip x={24} y={1490} w={340} label="Restarts" value={String(restarts)} pop={pop(RESTARTS[0] - 0.4)} color={C.accent4} />
              <Chip x={716} y={1490} w={340} label="Wrong notes" value={String(wrongs)} color="#ff7a8d" pop={pop(WRONG_AT[0]) + kickW} />
            </>
          )}
          {quietMode && (
            <>
              <Chip x={24} y={1490} w={340} label="Tabs used" value="0" pop={pop(T.quiet + 0.2)} color={C.accent3} />
              <Chip x={716} y={1490} w={340} label="Wrong notes" value="0" pop={pop(T.quiet + 0.4)} color={C.accent3} />
              {fx && <Chip x={270} y={120} w={540} label="Crowd energy" value={`${crowdPct}%`} color="#8dffb4" pop={pop(43.0)} />}
            </>
          )}
        </>
      )}
    </>
  );
};

// ===================================================================================================================================
// Scene 7 · end card (53–60 s)
// ===================================================================================================================================
const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fx = useFx();
  const sp = (at: number) => spring({ frame: frame - (T.end + at) * fps, fps, config: { damping: 14, stiffness: 190, mass: 0.85 } });
  const l2 = sp(2.0), cta = sp(3.8), url = sp(fx ? END_CHORD_AT - T.end - 0.05 : 4.1), tag = sp(4.5);
  const hit = fx ? Math.exp(-Math.max(0, t - END_CHORD_AT) * 9) : 0;                       // the URL lands on the resolving chord
  const done = clamp((t - END_CHORD_AT) / 0.25);
  return (
    <AbsoluteFill>
      <Background beat={0.5} brand="EAR WARRIOR" />
      <Seq from={Math.round(T.end * FPS)} durationInFrames={Math.round(7 * FPS)}>
        <Headline lines={['Play what you', '*hear.*']} top={190} size={112} />
      </Seq>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 450, fontFamily: FONT, fontSize: 62, fontWeight: 600, letterSpacing: -1.5, color: alpha(C.text, 0.62), opacity: clamp(l2 * 1.5), transform: `translateY(${(1 - l2) * 40}px)` }}>
        Not just what you <span style={{ textDecoration: 'line-through', textDecorationColor: alpha(C.accent3, 0.9), textDecorationThickness: 5 }}>read.</span>
      </div>
      <Inset x={(1080 - 920 * 0.56) / 2} y={590} k={0.56} t={t} notes={END_MELODY} hold={0.5} />
      <div style={{ position: 'absolute', left: 560 + 270, top: 560, width: 120, height: 120, transform: `scale(${easeOut(done)})`, opacity: done }}>
        <svg width={120} height={120} viewBox="-60 -60 120 120"><circle r={52} fill={C.accent3} stroke={C.bg} strokeWidth={8} /><path d="M -22 2 L -6 18 L 24 -14" fill="none" stroke={C.bg} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1360, textAlign: 'center', fontFamily: FONT }}>
        <div style={{ display: 'inline-block', padding: '16px 44px', borderRadius: 60, background: `linear-gradient(90deg, ${C.accent3}, ${C.accent})`, color: C.bg, fontSize: 48, fontWeight: 700, letterSpacing: 1, opacity: clamp(cta * 1.5), transform: `scale(${0.7 + 0.3 * cta})` }}>Early access</div>
        <div style={{ marginTop: 28, fontSize: 98, fontWeight: 650, letterSpacing: -3, color: C.text, opacity: clamp(url * 1.5), transform: `translateY(${(1 - url) * 40}px) scale(${1 + 0.1 * hit})`, textShadow: `0 0 50px ${alpha(C.accent, 0.7)}` }}>
          <Rich text="ear*warrior*.app" />
        </div>
        <div style={{ marginTop: 18, fontSize: 40, color: alpha(C.text, 0.68), opacity: clamp(tag * 1.5) }}>Play it by ear. On guitar.</div>
      </div>
    </AbsoluteFill>
  );
};

// ===================================================================================================================================
export const PainVideo: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {!silent && <Audio src={staticFile('ear-pain.wav')} />}
      {t < T.party && <RoomScene t={t} />}
      {t >= T.party && t < T.end && <PartyScene t={t} />}
      {t >= T.end && <EndCard t={t} />}
      <Seq from={0} durationInFrames={Math.round(T.hookSplit * FPS)}><Headline lines={['7 years', 'of *guitar.*']} instant top={190} size={112} /></Seq>
      <Seq from={Math.round(T.hookSplit * FPS)} durationInFrames={Math.round((T.legend - T.hookSplit) * FPS)}><Headline lines={['*Zero* songs', 'without tabs.']} top={190} size={112} /></Seq>
      <Caption lines={['With tabs:', 'a *legend.*']} from={T.legend + 0.15} to={T.party - 0.15} top={1545} size={88} />
      <Wipe at={T.party * FPS} />
      <Wipe at={T.end * FPS} />
    </AbsoluteFill>
  );
};
void QUIET_CHORD_AT;

/** The short cut (pain/cut.mjs): the same 60 s picture played through a clock that speeds up and jumps (src/clock.tsx). */
export const PainCut: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Audio src={staticFile('ear-pain-cut.wav')} />
    <ClockProvider warp={(f) => srcAt(f / FPS) * FPS} fx>
      <PainVideo silent />
    </ClockProvider>
  </AbsoluteFill>
);
