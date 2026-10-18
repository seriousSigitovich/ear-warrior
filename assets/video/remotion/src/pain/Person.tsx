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
const GA = 24;                                       // guitar tilt, degrees
const GX = 30, GY = -5;                              // guitar origin in person space
const gpt = (x: number, y: number): V => [GX + x * Math.cos(rad(GA)) - y * Math.sin(rad(GA)), GY + x * Math.sin(rad(GA)) + y * Math.cos(rad(GA))];
/** Point on the neck, u = 0 (body) … 1 (headstock). */
export const neckPoint = (u: number): V => gpt(-110 - u * 300, 0);
export const strumPoint = (k: number): V => gpt(55 + 8 * k, -34 * k + 8);

export const GuitarShape: React.FC<{ glow?: number }> = ({ glow = 0 }) => (
  <g>
    <rect x={-475} y={-15} width={70} height={30} rx={9} fill="#3a2418" />
    {[0, 1, 2].map((i) => <circle key={i} cx={-450 + i * 20} cy={i === 1 ? -6 : 5} r={4} fill="#cfcfd6" />)}
    <rect x={-410} y={-17} width={310} height={34} fill="#6b4226" />
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={-405 + i * 33 + i * i * 0.4} y={-17} width={3} height={34} fill="#cfcfd6" opacity={0.75} />)}
    <circle cx={-40} cy={0} r={82} fill="#8f5a2d" />
    <circle cx={62} cy={0} r={103} fill="#8f5a2d" />
    <circle cx={-40} cy={0} r={76} fill="#c9894f" />
    <circle cx={62} cy={0} r={97} fill="#c9894f" />
    <circle cx={40} cy={0} r={31} fill="#2a1a12" />
    <circle cx={40} cy={0} r={34} fill="none" stroke="#8f5a2d" strokeWidth={5} />
    <rect x={112} y={-26} width={14} height={52} rx={5} fill="#3a2418" />
    {[-9, -3, 3, 9].map((y) => <line key={y} x1={-405} y1={y} x2={118} y2={y} stroke={`rgba(235,235,245,${0.55 + glow * 0.4})`} strokeWidth={1.6} />)}
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
  /** u: fretting-hand position on the neck (0.1–0.9), strum: 0…1 pick stroke phase, jitter: px of nervous hand tremor. */
  guitar?: { u: number; strum: number; jitter?: number; glow?: number };
  /** Draw the guitar but leave the hands free (e.g. while reaching for a phone). */
  showGuitar?: boolean;
  extras?: React.ReactNode;
}

const REST_L: V = [-112, 40], REST_R: V = [112, 40];

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
  }
  const L = arm(SL, lt, 122, 118, 1), R = arm(SR, rt, 122, 118, -1);
  const sleeveDark = shade(shirt, 0.72);
  const armPath = (a: { elbow: V; hand: V }, s: V) => `M ${s[0]} ${s[1]} L ${a.elbow[0]} ${a.elbow[1]} L ${a.hand[0]} ${a.hand[1]}`;
  const longSleeves = (p.sleeves ?? 'long') === 'long';
  const drawArm = (a: { elbow: V; hand: V }, s: V, hold: Hold) => {
    const d = armPath(a, s);
    const shortPath = `M ${s[0]} ${s[1]} L ${s[0] + (a.elbow[0] - s[0]) * 0.55} ${s[1] + (a.elbow[1] - s[1]) * 0.55}`;
    return (
      <g>
        <path d={d} stroke={longSleeves ? sleeveDark : shade(skin, 0.8)} strokeWidth={54} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={d} stroke={longSleeves ? shirt : skin} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {!longSleeves && <path d={shortPath} stroke={shirt} strokeWidth={50} strokeLinecap="round" fill="none" />}
        {hold === 'cup' && (
          <g transform={`translate(${a.hand[0]} ${a.hand[1]})`}>
            <path d="M -19 -52 L 19 -52 L 15 8 L -15 8 Z" fill="#e8445a" /><rect x={-21} y={-58} width={42} height={9} rx={4} fill="#f7f3ff" />
          </g>
        )}
        {hold === 'phone' && (
          <g transform={`translate(${a.hand[0]} ${a.hand[1] - 10}) rotate(${a.hand[0] < 0 ? 12 : -12})`}>
            <rect x={-24} y={-48} width={48} height={86} rx={9} fill="#14151f" /><rect x={-20} y={-43} width={40} height={74} rx={5} fill="#7e8cff" opacity={0.9} />
          </g>
        )}
        <circle cx={a.hand[0]} cy={a.hand[1]} r={hold ? 21 : 25} fill={skin} stroke={shade(skin, 0.8)} strokeWidth={3} />
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
      {(p.guitar || p.showGuitar) && <Guitar glow={p.guitar?.glow} />}
      {drawArm(L, SL, p.guitar ? undefined : p.leftHold)}
      {drawArm(R, SR, p.guitar ? undefined : p.rightHold)}
      {/* head */}
      <g transform="translate(0 -262)">
        <circle cx={-64} cy={8} r={13} fill={skin} /><circle cx={64} cy={8} r={13} fill={skin} />
        <circle cx={0} cy={0} r={65} fill={skin} />
        <Face mood={p.mood} look={look} talk={p.talk ?? 0} blink={blink} skin={skin} sweat={p.sweat ?? 0} t={t} />
        <Hair style={p.hair} color={p.hairColor} accent={p.accent ?? '#e8445a'} layer="front" />
      </g>
      {p.extras}
    </g>
  );
};
