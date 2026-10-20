// A flat, waist-up cartoon person built from SVG primitives: two-bone arms that reach targets (so a hand can follow a guitar neck),
// a face driven by a mood table, five hair styles, an optional acoustic guitar. Local origin = centre of the waist, +y down, head ≈ y −262.
import React from 'react';

export type V = [number, number];
export type Mood = 'smug' | 'happy' | 'grin' | 'neutral' | 'bored' | 'tense' | 'worry' | 'cringe' | 'sad' | 'awe' | 'love' | 'yawn' | 'focus' | 'zen';
export type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'curly' | 'beanie';
export type Hold = 'cup' | 'phone' | undefined;

const FONT_DARK = '#2a1d33';

export function shade(hex: string, k: number): string {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const MOODS: Record<Mood, { raise: number; tilt: number; eye: 'open' | 'wide' | 'half' | 'closed' | 'arc' | 'squint'; mouth: string; blush?: boolean }> = {
  smug: { raise: 0, tilt: 8, eye: 'half', mouth: 'smirk' },
  happy: { raise: -4, tilt: -4, eye: 'open', mouth: 'smile' },
  grin: { raise: -8, tilt: -6, eye: 'open', mouth: 'grin' },
  neutral: { raise: 0, tilt: 0, eye: 'open', mouth: 'flat' },
  bored: { raise: 4, tilt: 5, eye: 'half', mouth: 'flat' },
  tense: { raise: -2, tilt: -14, eye: 'open', mouth: 'tense' },
  worry: { raise: -9, tilt: -20, eye: 'wide', mouth: 'frownS' },
  cringe: { raise: -2, tilt: -16, eye: 'squint', mouth: 'tense' },
  sad: { raise: 0, tilt: -22, eye: 'half', mouth: 'frown' },
  awe: { raise: -14, tilt: 0, eye: 'wide', mouth: 'o' },
  love: { raise: -8, tilt: -6, eye: 'arc', mouth: 'grin', blush: true },
  yawn: { raise: -6, tilt: 0, eye: 'closed', mouth: 'yawn' },
  focus: { raise: 2, tilt: 4, eye: 'open', mouth: 'smile' },
  zen: { raise: -2, tilt: -4, eye: 'closed', mouth: 'smile' },
};

/** 2-bone IK: shoulder → elbow → hand. `side` +1 bends outward to the viewer's left, −1 to the right. */
function arm(s: V, target: V, upper: number, fore: number, side: 1 | -1): { elbow: V; hand: V } {
  const dx = target[0] - s[0], dy = target[1] - s[1];
  const d = Math.hypot(dx, dy) || 1;
  const dd = Math.min(upper + fore - 1.5, Math.max(Math.abs(upper - fore) + 2, d));
  const ux = dx / d, uy = dy / d;
  const a = (upper * upper - fore * fore + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  return { elbow: [s[0] + ux * a - uy * h * side, s[1] + uy * a + ux * h * side], hand: [s[0] + ux * dd, s[1] + uy * dd] };
}

const rad = (d: number) => (d * Math.PI) / 180;
const GA = 36;                                       // guitar tilt, degrees
const GX = 0, GY = 14;                             // guitar origin in person space
const gpt = (x: number, y: number): V => [GX + x * Math.cos(rad(GA)) - y * Math.sin(rad(GA)), GY + x * Math.sin(rad(GA)) + y * Math.cos(rad(GA))];
/** Point on the neck, u = 0 (body) … 1 (headstock). */
export const neckPoint = (u: number): V => gpt(-110 - u * 300, 0);
export const strumPoint = (k: number): V => gpt(55 + 8 * k, -34 * k + 8);

// A classical guitar: waisted body (smaller upper bout, wider lower bout), wide flat neck, slotted headstock with side tuners.
// Local x: headstock −475 … nut −410 … body joint −118 … tail 168; y symmetric around 0.
const BODY_HALF = 'M -118 -60 C -112 -86 -80 -92 -52 -88 C -24 -84 -6 -70 14 -69 C 40 -68 58 -108 104 -108 C 148 -108 170 -72 170 0';
const BODY = `${BODY_HALF} C 170 72 148 108 104 108 C 58 108 40 68 14 69 C -6 70 -24 84 -52 88 C -80 92 -112 86 -118 60 Z`;
export const GuitarShape: React.FC<{ glow?: number }> = ({ glow = 0 }) => (
  <g>
    {/* neck + fretboard */}
    <rect x={-412} y={-20} width={300} height={40} fill="#b8844f" />
    <rect x={-412} y={-18} width={300} height={36} fill="#3a2418" />
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={-405 + i * 33 + i * i * 0.4} y={-18} width={2.6} height={36} fill="#d6d6dd" opacity={0.8} />)}
    {/* slotted headstock: cheeks, slot, three tuners each side */}
    <rect x={-478} y={-24} width={70} height={48} rx={10} fill="#4a2c1a" />
    <rect x={-462} y={-9} width={46} height={18} rx={9} fill="#1b110b" />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={-472 + i * 20} y={-35} width={9} height={14} rx={3} fill="#cfcfd6" />
        <rect x={-472 + i * 20} y={21} width={9} height={14} rx={3} fill="#cfcfd6" />
      </g>
    ))}
    {/* body: rim, top, soft shade on the lower edge, binding line */}
    <path d={BODY} fill="#7a4a22" transform="translate(0 4)" />
    <path d={BODY} fill="#e0a860" stroke="#8b5524" strokeWidth={7} strokeLinejoin="round" />
    <path d={BODY} fill="none" stroke="#f2cf92" strokeWidth={2.5} transform="scale(0.93 0.9) translate(10 0)" opacity={0.7} />
    {/* sound hole with rosette */}
    <circle cx={14} cy={0} r={39} fill="none" stroke="#6a3f1d" strokeWidth={4} />
    <circle cx={14} cy={0} r={33} fill="none" stroke="#f2cf92" strokeWidth={3} />
    <circle cx={14} cy={0} r={29} fill="#24160e" />
    {/* bridge */}
    <rect x={112} y={-34} width={22} height={68} rx={6} fill="#3a2418" />
    <rect x={112} y={-34} width={22} height={9} rx={4} fill="#5a3a24" />
    {/* strings */}
    {[-12, -7.2, -2.4, 2.4, 7.2, 12].map((y, i) => <line key={y} x1={-412} y1={y * 0.9} x2={118} y2={y * 1.25} stroke={`rgba(240,240,250,${0.5 + glow * 0.45})`} strokeWidth={i < 3 ? 1.3 : 1.9} />)}
  </g>
);

const Guitar: React.FC<{ glow?: number }> = ({ glow = 0 }) => (
  <g transform={`translate(${GX} ${GY}) rotate(${GA})`}><GuitarShape glow={glow} /></g>
);

export const GUITAR_POSE = { x: GX, y: GY, rot: GA };

// --- hair -----------------------------------------------------------------------------------------------------------------------------
const Hair: React.FC<{ style: HairStyle; color: string; accent: string; layer: 'back' | 'front' }> = ({ style, color, accent, layer }) => {
  const dark = shade(color, 0.82);
  if (layer === 'back') {
    if (style === 'long') return <path d="M -76 -6 C -84 -86 84 -86 76 -6 L 88 112 Q 0 134 -88 112 Z" fill={dark} />;
    if (style === 'bun') return <circle cx={0} cy={-82} r={27} fill={dark} />;
    if (style === 'curly') return <g fill={dark}>{Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i / 8) * Math.PI; return <circle key={i} cx={Math.cos(a) * 66} cy={Math.sin(a) * 62} r={26} />; })}</g>;
    return null;
  }
  const fringe = 'M -67 -2 C -72 -62 -30 -80 0 -78 C 34 -80 72 -60 67 -2 C 60 -28 30 -42 0 -42 C -30 -42 -58 -26 -67 -2 Z';
  switch (style) {
    case 'short': return <path d={fringe} fill={color} />;
    case 'long': return <path d="M -67 -2 C -72 -62 -30 -80 0 -78 C 34 -80 72 -60 67 -2 C 58 -32 20 -50 -12 -44 C -34 -40 -56 -22 -67 -2 Z" fill={color} />;
    case 'bun': return <path d={fringe} fill={color} />;
    case 'curly': return <path d="M -64 -6 C -62 -56 -30 -72 0 -70 C 30 -72 62 -56 64 -6 C 40 -34 -40 -34 -64 -6 Z" fill={color} />;
    case 'cap': return (
      <g>
        <path d="M -68 -26 C -72 -92 72 -92 68 -26 Z" fill={accent} />
        <path d="M -66 -28 Q 0 -12 66 -28 Q 44 -6 0 -4 Q -44 -6 -66 -28 Z" fill={shade(accent, 0.7)} />
      </g>
    );
    case 'beanie': return (
      <g>
        <path d="M -68 -8 C -74 -96 74 -96 68 -8 Z" fill={accent} />
        <rect x={-72} y={-30} width={144} height={26} rx={12} fill={shade(accent, 1.25)} />
        <circle cx={0} cy={-84} r={9} fill={shade(accent, 1.25)} />
      </g>
    );
  }
};

// --- face -----------------------------------------------------------------------------------------------------------------------------
const Face: React.FC<{ mood: Mood; look: V; talk: number; blink: number; skin: string; sweat: number; t: number }> = ({ mood, look, talk, blink, skin, sweat, t }) => {
  const m = MOODS[mood];
  const lid = shade(skin, 0.96);
  const eye = (x: number, side: 1 | -1) => {
    const tall = m.eye === 'wide' ? 19 : 15;
    const px = x + look[0] * 6, py = look[1] * 5;
    if (m.eye === 'closed') return <path d={`M ${x - 12} 0 Q ${x} 9 ${x + 12} 0`} stroke={FONT_DARK} strokeWidth={5} fill="none" strokeLinecap="round" />;
    if (m.eye === 'arc') return <path d={`M ${x - 12} 4 Q ${x} -11 ${x + 12} 4`} stroke={FONT_DARK} strokeWidth={5.5} fill="none" strokeLinecap="round" />;
    if (m.eye === 'squint') {
      const o = side === 1 ? 1 : -1;
      return <path d={`M ${x - 12 * o} -6 L ${x + 9 * o} 2 L ${x - 12 * o} 10`} stroke={FONT_DARK} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }
    return (
      <g transform={`translate(0 ${-1}) scale(1 ${1 - blink * 0.92})`} style={{ transformOrigin: `${x}px 0px` }}>
        <ellipse cx={x} cy={0} rx={14} ry={tall} fill="#fbf8ff" />
        <circle cx={Math.max(x - 6, Math.min(x + 6, px))} cy={py} r={m.eye === 'wide' ? 6 : 7.2} fill={FONT_DARK} />
        {m.eye === 'half' && <path d={`M ${x - 15} ${-tall - 1} L ${x + 15} ${-tall - 1} L ${x + 15} -3 L ${x - 15} -3 Z`} fill={lid} />}
        {m.eye === 'half' && <line x1={x - 14} y1={-3} x2={x + 14} y2={-3} stroke={FONT_DARK} strokeWidth={3.5} strokeLinecap="round" />}
      </g>
    );
  };
  const brow = (x: number, side: 1 | -1) => (
    <line x1={x - 15} y1={0} x2={x + 15} y2={0} stroke={FONT_DARK} strokeWidth={6} strokeLinecap="round" transform={`translate(0 ${-34 + m.raise}) rotate(${side * m.tilt} ${x} 0)`} />
  );
  let mouth: React.ReactNode;
  const open = Math.max(0, talk);
  if (open > 0.02 && mood !== 'yawn' && mood !== 'awe') {
    mouth = <ellipse cx={0} cy={34} rx={13 + open * 5} ry={4 + open * 13} fill={FONT_DARK} />;
  } else {
    switch (m.mouth) {
      case 'smile': mouth = <path d="M -24 26 Q 0 50 24 26" stroke={FONT_DARK} strokeWidth={6.5} fill="none" strokeLinecap="round" />; break;
      case 'grin': mouth = <g><path d="M -30 25 Q 0 66 30 25 Z" fill={FONT_DARK} /><path d="M -25 27 Q 0 36 25 27 L 22 33 Q 0 40 -22 33 Z" fill="#fbf8ff" /></g>; break;
      case 'smirk': mouth = <path d="M -20 36 Q 6 46 28 22" stroke={FONT_DARK} strokeWidth={6.5} fill="none" strokeLinecap="round" />; break;
      case 'flat': mouth = <path d="M -16 38 L 16 38" stroke={FONT_DARK} strokeWidth={6.5} strokeLinecap="round" />; break;
      case 'tense': mouth = <path d="M -24 38 L -12 31 L 0 38 L 12 31 L 24 38" stroke={FONT_DARK} strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />; break;
      case 'frown': mouth = <path d="M -22 46 Q 0 24 22 46" stroke={FONT_DARK} strokeWidth={6.5} fill="none" strokeLinecap="round" />; break;
      case 'frownS': mouth = <path d="M -15 42 Q 0 30 15 42" stroke={FONT_DARK} strokeWidth={6} fill="none" strokeLinecap="round" />; break;
      case 'o': mouth = <ellipse cx={0} cy={40} rx={11} ry={14} fill={FONT_DARK} />; break;
      case 'yawn': mouth = <g><ellipse cx={0} cy={42} rx={20} ry={28 + Math.sin(t * 5) * 2} fill={FONT_DARK} /><ellipse cx={0} cy={55} rx={13} ry={9} fill="#c9506a" /></g>; break;
    }
  }
  return (
    <g>
      {m.blush && <><ellipse cx={-42} cy={22} rx={14} ry={8} fill="#ee8da0" opacity={0.6} /><ellipse cx={42} cy={22} rx={14} ry={8} fill="#ee8da0" opacity={0.6} /></>}
      {eye(-26, 1)}{eye(26, -1)}
      {brow(-26, 1)}{brow(26, -1)}
      {mouth}
      {sweat > 0 && (
        <g transform={`translate(${60 + sweat * 4} ${-20 + sweat * 52}) scale(${0.6 + 0.4 * Math.min(1, sweat * 2)})`} opacity={1 - Math.max(0, sweat - 0.75) * 4}>
          <path d="M 0 -22 C 12 -4 14 6 0 14 C -14 6 -12 -4 0 -22 Z" fill="#9fd8ff" stroke="#e6f6ff" strokeWidth={2} />
        </g>
      )}
    </g>
  );
};

// --- person ---------------------------------------------------------------------------------------------------------------------------
export interface PersonProps {
  x: number; y: number; scale?: number; flip?: boolean; lean?: number; bob?: number; opacity?: number; gray?: number;
  skin: string; shirt: string; sleeves?: 'long' | 'short'; hair: HairStyle; hairColor: string; accent?: string;
  mood: Mood; look?: V; talk?: number; sweat?: number; t: number; seed?: number;
  /** Hand targets in person space. Ignored when `guitar` is set (hands then follow the guitar). */
  left?: V; right?: V; leftHold?: Hold; rightHold?: Hold;
  /** u: fretting-hand position on the neck (0.1–0.9), strum: 0…1 pick stroke phase, jitter: px of nervous hand tremor,
   *  ear: 0…1 raises the strumming hand to the right ear, cupped (listening); values past 1 overshoot, which is what a spring wants. */
  guitar?: { u: number; strum: number; jitter?: number; glow?: number; ear?: number };
  /** The head moves on its own (px / degrees, about the neck), so it can lag or lead the body. */
  head?: { x?: number; y?: number; rot?: number };
  /** Draw the guitar but leave the hands free (e.g. while reaching for a phone). */
  showGuitar?: boolean;
  extras?: React.ReactNode;
}

const REST_L: V = [-112, 40], REST_R: V = [112, 40];
const EAR_R: V = [104, -262];                          // where the right hand sits when it cups the ear

export const Person: React.FC<PersonProps> = (p) => {
  const { skin, shirt, t } = p;
  const look = p.look ?? [0, 0];
  const seed = p.seed ?? 1;
  const per = 3.1 + (seed % 5) * 0.37;
  const ph = (t + seed * 0.83) % per;
  const blink = ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
  const SL: V = [-90, -160], SR: V = [90, -160];
  let lt = p.left ?? REST_L, rt = p.right ?? REST_R;
  if (p.guitar) {
    const j = p.guitar.jitter ?? 0;
    const nn = (k: number) => Math.sin(t * (9 + k) + seed) * Math.cos(t * (5.3 + k * 0.7));
    const np = neckPoint(p.guitar.u);
    lt = [np[0] + j * nn(1), np[1] + j * 0.7 * nn(2)];
    const sp = strumPoint(Math.sin(Math.PI * Math.min(1, p.guitar.strum)));
    rt = [sp[0] + j * 0.4 * nn(3), sp[1] + j * 0.4 * nn(4)];
    const e = p.guitar.ear ?? 0;
    if (e) rt = [rt[0] + (EAR_R[0] - rt[0]) * e, rt[1] + (EAR_R[1] - rt[1]) * e];
  }
  // Fretting arm: with a guitar the elbow hangs down and the forearm comes up to the neck from below (not over it).
  let L = arm(SL, lt, 122, 118, 1);
  if (p.guitar) {
    // Fretting arm: the upper arm hangs straight down and the elbow points at the floor; the forearm only swings up to the neck
    // from below. (A two-bone solve throws the elbow sideways and drags the forearm across the guitar.)
    L = { elbow: [SL[0] - 22, SL[1] + 120], hand: lt };
  }
  let R = arm(SR, rt, 122, 118, -1);
  if (p.guitar) {
    // Strumming arm: the upper arm hangs down along the body and the elbow rests on the guitar's upper bout; the forearm only
    // swings to the strings (a plain two-bone solve throws the elbow out to the side like a wing).
    const sw = Math.sin(Math.PI * Math.min(1, p.guitar.strum));
    R = { elbow: [SR[0] + 24 + 4 * sw, SR[1] + 118 - 3 * sw], hand: rt };
    const e = p.guitar.ear ?? 0;
    if (e) {
      // raised to the ear the elbow swings out and up: blend from the hanging pose to a real two-bone solve (side +1: the vector points up)
      const up = arm(SR, rt, 122, 118, 1);
      R = { elbow: [R.elbow[0] + (up.elbow[0] - R.elbow[0]) * e, R.elbow[1] + (up.elbow[1] - R.elbow[1]) * e], hand: rt };
    }
  }
  const sleeveDark = shade(shirt, 0.72);
  const armPath = (a: { elbow: V; hand: V }, s: V) => `M ${s[0]} ${s[1]} L ${a.elbow[0]} ${a.elbow[1]} L ${a.hand[0]} ${a.hand[1]}`;
  const longSleeves = (p.sleeves ?? 'long') === 'long';
  const drawArm = (a: { elbow: V; hand: V }, s: V, hold: Hold, part: 'all' | 'limb' | 'hand' = 'all') => {
    const d = armPath(a, s);
    const shortPath = `M ${s[0]} ${s[1]} L ${s[0] + (a.elbow[0] - s[0]) * 0.55} ${s[1] + (a.elbow[1] - s[1]) * 0.55}`;
    if (part === 'hand') return <circle cx={a.hand[0]} cy={a.hand[1]} r={25} fill={skin} stroke={shade(skin, 0.8)} strokeWidth={3} />;
    return (
      <g>
        <path d={d} stroke={longSleeves ? sleeveDark : shade(skin, 0.8)} strokeWidth={54} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={d} stroke={longSleeves ? shirt : skin} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {!longSleeves && <path d={shortPath} stroke={shirt} strokeWidth={50} strokeLinecap="round" fill="none" />}
        {part === 'all' && hold === 'cup' && (
          <g transform={`translate(${a.hand[0]} ${a.hand[1]})`}>
            <path d="M -19 -52 L 19 -52 L 15 8 L -15 8 Z" fill="#e8445a" /><rect x={-21} y={-58} width={42} height={9} rx={4} fill="#f7f3ff" />
          </g>
        )}
        {part === 'all' && hold === 'phone' && (
          <g transform={`translate(${a.hand[0]} ${a.hand[1] - 10}) rotate(${a.hand[0] < 0 ? 12 : -12})`}>
            <rect x={-24} y={-48} width={48} height={86} rx={9} fill="#14151f" /><rect x={-20} y={-43} width={40} height={74} rx={5} fill="#7e8cff" opacity={0.9} />
          </g>
        )}
        {part === 'all' && <circle cx={a.hand[0]} cy={a.hand[1]} r={hold ? 21 : 25} fill={skin} stroke={shade(skin, 0.8)} strokeWidth={3} />}
      </g>
    );
  };
  const g = p.gray ?? 0;
  return (
    <g
      transform={`translate(${p.x} ${p.y + (p.bob ?? 0)}) scale(${(p.scale ?? 1) * (p.flip ? -1 : 1)} ${p.scale ?? 1}) rotate(${p.lean ?? 0})`}
      opacity={p.opacity ?? 1}
      style={g ? { filter: `saturate(${1 - g * 0.8}) brightness(${1 - g * 0.25})` } : undefined}
    >
      <Hair style={p.hair} color={p.hairColor} accent={p.accent ?? '#e8445a'} layer="back" />
      {/* torso */}
      <path d="M -94 -168 Q -108 -80 -96 140 L 96 140 Q 108 -80 94 -168 Q 44 -198 0 -198 Q -44 -198 -94 -168 Z" fill={shirt} stroke={sleeveDark} strokeWidth={4} />
      <ellipse cx={0} cy={-190} rx={52} ry={16} fill={sleeveDark} />
      <rect x={-21} y={-216} width={42} height={36} rx={14} fill={shade(skin, 0.88)} />
      {/* fretting arm sits BEHIND the guitar and its neck; only the palm shows on top of the neck */}
      {p.guitar && drawArm(L, SL, undefined, 'limb')}
      {(p.guitar || p.showGuitar) && <Guitar glow={p.guitar?.glow} />}
      {p.guitar ? drawArm(L, SL, undefined, 'hand') : drawArm(L, SL, p.leftHold)}
      {drawArm(R, SR, p.guitar ? undefined : p.rightHold)}
      {/* head */}
      <g transform={`translate(${p.head?.x ?? 0} ${-262 + (p.head?.y ?? 0)}) rotate(${p.head?.rot ?? 0})`}>
        <circle cx={-64} cy={8} r={13} fill={skin} /><circle cx={64} cy={8} r={13} fill={skin} />
        <circle cx={0} cy={0} r={65} fill={skin} />
        <Face mood={p.mood} look={look} talk={p.talk ?? 0} blink={blink} skin={skin} sweat={p.sweat ?? 0} t={t} />
        <Hair style={p.hair} color={p.hairColor} accent={p.accent ?? '#e8445a'} layer="front" />
      </g>
      {p.extras}
    </g>
  );
};
