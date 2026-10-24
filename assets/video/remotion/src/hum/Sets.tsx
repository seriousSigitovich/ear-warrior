// The five places of the "melody in my head" film: shower, bus, lift, bedroom at night, and the stage the bedroom turns into.
// Every set is drawn full-frame, 1080×1920, as a pure function of the time `t`.
import React from 'react';
import { C, alpha, FONT } from '../theme';
import { clamp, rng } from '../util';

// --- shower ---------------------------------------------------------------------------------------------------------------------------
export const ShowerBg: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <defs>
      <linearGradient id="sh-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#35788f" /><stop offset="1" stopColor="#1b3b50" /></linearGradient>
      <radialGradient id="sh-glow"><stop offset="0" stopColor="#ffe6c0" stopOpacity={0.55} /><stop offset="1" stopColor="#ffe6c0" stopOpacity={0} /></radialGradient>
    </defs>
    <rect width={1080} height={1920} fill="url(#sh-wall)" />
    {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={i * 135} y1={0} x2={i * 135} y2={1920} stroke="#0c2433" strokeOpacity={0.5} strokeWidth={5} />)}
    {Array.from({ length: 15 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 135 + 40} x2={1080} y2={i * 135 + 40} stroke="#0c2433" strokeOpacity={0.5} strokeWidth={5} />)}
    <circle cx={800} cy={520} r={760} fill="url(#sh-glow)" />
    {/* the shower: pipe, head, and a cone of falling water */}
    <rect x={770} y={0} width={26} height={250} fill="#cfd3e5" />
    <path d="M 782 250 Q 782 300 720 320" stroke="#cfd3e5" strokeWidth={26} fill="none" strokeLinecap="round" />
    <ellipse cx={690} cy={338} rx={118} ry={34} transform="rotate(-8 690 338)" fill="#e9e9ed" />
    <ellipse cx={690} cy={346} rx={104} ry={20} transform="rotate(-8 690 346)" fill="#9397ab" />
    {Array.from({ length: 34 }, (_, i) => {
      const k = i - 16.5, x1 = 690 + k * 6, x2 = 690 + k * 26;
      return <line key={i} x1={x1} y1={372} x2={x2} y2={1750} stroke="#c9ecff" strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" strokeDasharray="70 190" strokeDashoffset={-(t * 1700 + i * 53) % 260} />;
    })}
  </g>
);
/** Steam and soap bubbles, drawn over the person. */
export const ShowerFront: React.FC<{ t: number }> = ({ t }) => {
  const r = rng(5);
  return (
    <g>
      {Array.from({ length: 7 }, (_, i) => {
        const y = 1750 - ((t * 140 + i * 230) % 1500), x = 90 + i * 150 + Math.sin(t * 0.9 + i) * 40;
        return <ellipse key={i} cx={x} cy={y} rx={190} ry={110} fill="#fff" opacity={0.1} />;
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const x0 = 120 + r() * 840, ph = r() * 6, y = 1500 - ((t * (80 + 40 * r()) + ph * 200) % 1200), rr = 12 + r() * 20;
        return <circle key={i} cx={x0 + Math.sin(t * 2 + ph) * 22} cy={y} r={rr} fill="#fff" fillOpacity={0.1} stroke="#fff" strokeOpacity={0.55} strokeWidth={3} />;
      })}
      <rect x={0} y={1560} width={1080} height={360} fill="#16313f" />
      <rect x={0} y={1560} width={1080} height={12} fill="#6cb4cc" opacity={0.6} />
      <rect x={140} y={1440} width={110} height={120} rx={22} fill="#e8445a" /><rect x={165} y={1410} width={60} height={34} rx={8} fill="#f7f3ff" />
      <rect x={820} y={1470} width={90} height={90} rx={20} fill="#9ae6d4" />
    </g>
  );
};

// --- bus ------------------------------------------------------------------------------------------------------------------------------
const rb = rng(21);
const SKY = Array.from({ length: 12 }, () => ({ w: 130 + rb() * 120, h: 110 + rb() * 300, c: rb() > 0.5 ? '#3a2f63' : '#2a2350' }));
export const BusBg: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <defs>
      <linearGradient id="bus-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c3558" /><stop offset="1" stopColor="#1b2140" /></linearGradient>
      <linearGradient id="bus-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d5294" /><stop offset="1" stopColor="#ff9f6e" /></linearGradient>
      <clipPath id="bus-win"><rect x={60} y={400} width={960} height={500} rx={30} /></clipPath>
    </defs>
    <rect width={1080} height={1920} fill="url(#bus-wall)" />
    <rect width={1080} height={170} fill="#3a4166" />
    {[210, 650].map((x) => <g key={x}><rect x={x} y={52} width={230} height={50} rx={20} fill="#f7f3ff" opacity={0.92} /><ellipse cx={x + 115} cy={100} rx={190} ry={70} fill="#ffe6c0" opacity={0.12} /></g>)}
    <rect x={40} y={380} width={1000} height={540} rx={42} fill="#10122a" />
    <g clipPath="url(#bus-win)">
      <rect x={60} y={400} width={960} height={500} fill="url(#bus-sky)" />
      {SKY.map((b, i) => {
        const span = SKY.length * 190, x = (((i * 190 - t * 720) % span) + span) % span - 200;
        return <g key={i}><rect x={x} y={900 - b.h} width={b.w} height={b.h} fill={b.c} />{Array.from({ length: 4 }, (_, k) => <rect key={k} x={x + 18 + (k % 2) * 52} y={900 - b.h + 22 + Math.floor(k / 2) * 60} width={28} height={34} fill="#ffd9a0" opacity={0.5 + 0.3 * ((i + k) % 2)} />)}</g>;
      })}
    </g>
    <line x1={540} y1={400} x2={540} y2={900} stroke="#10122a" strokeWidth={14} />
    {/* handrail and swinging straps */}
    <rect x={0} y={300} width={1080} height={20} fill="#cfd3e5" />
    {[160, 420, 700, 930].map((x, i) => {
      const sw = Math.sin(t * 7 + i * 1.3) * 12;
      return <g key={x} transform={`rotate(${sw * 0.5} ${x} 320)`}><line x1={x} y1={320} x2={x} y2={430} stroke="#e8445a" strokeWidth={8} /><ellipse cx={x} cy={470} rx={30} ry={46} fill="none" stroke="#e8445a" strokeWidth={10} /></g>;
    })}
    {/* seat backs behind the two passengers */}
    <rect x={90} y={1000} width={420} height={640} rx={80} fill="#2e3a70" /><rect x={570} y={1000} width={420} height={640} rx={80} fill="#2e3a70" />
  </g>
);
export const BusFront: React.FC = () => (
  <g>
    <rect x={0} y={1580} width={1080} height={340} fill="#243063" />
    <rect x={0} y={1580} width={1080} height={14} fill="#5c6bc0" opacity={0.7} />
    {[1, 2, 3].map((i) => <line key={i} x1={0} y1={1580 + i * 84} x2={1080} y2={1580 + i * 84} stroke="#1a2250" strokeWidth={6} />)}
  </g>
);

// --- lift -----------------------------------------------------------------------------------------------------------------------------
export const LiftBg: React.FC<{ t: number; floor: number; ding: number }> = ({ t, floor, ding }) => (
  <g>
    <defs>
      <linearGradient id="lift-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#555c78" /><stop offset="1" stopColor="#2a2e45" /></linearGradient>
      <radialGradient id="lift-light"><stop offset="0" stopColor="#fff" stopOpacity={0.5} /><stop offset="1" stopColor="#fff" stopOpacity={0} /></radialGradient>
    </defs>
    <rect width={1080} height={1920} fill="url(#lift-wall)" />
    {[0, 270, 540, 810].map((x) => <g key={x}><rect x={x + 6} y={0} width={258} height={1920} fill="#fff" opacity={0.04} /><line x1={x} y1={0} x2={x} y2={1920} stroke="#161829" strokeWidth={8} /><line x1={x + 8} y1={0} x2={x + 8} y2={1920} stroke="#fff" strokeOpacity={0.18} strokeWidth={3} /></g>)}
    <rect width={1080} height={110} fill="#d9dbe8" /><ellipse cx={540} cy={120} rx={560} ry={150} fill="url(#lift-light)" />
    {/* floor display */}
    <rect x={370} y={470} width={340} height={170} rx={22} fill="#07070d" stroke="#8a8fa8" strokeWidth={6} />
    <text x={540} y={602} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontWeight={700} fontSize={130} fill={ding > 0 ? '#7dffb0' : '#ff9f43'} style={{ filter: `drop-shadow(0 0 16px ${ding > 0 ? '#7dffb0' : '#ff9f43'})` }}>{floor}</text>
    <path d="M 430 580 L 458 536 L 486 580 Z" fill={ding > 0 ? '#7dffb0' : '#ff9f43'} opacity={0.5 + 0.5 * Math.sin(t * 12)} />
    {/* handrail */}
    <rect x={0} y={1180} width={1080} height={26} fill="#b2b6ca" /><rect x={0} y={1206} width={1080} height={14} fill="#000" opacity={0.25} />
  </g>
);
export const LiftFront: React.FC = () => (
  <g><rect x={0} y={1600} width={1080} height={320} fill="#1a1c2c" /><rect x={0} y={1600} width={1080} height={10} fill="#7d839e" opacity={0.7} /></g>
);

// --- bedroom at night -----------------------------------------------------------------------------------------------------------------
const r1 = rng(11);
const STARS = Array.from({ length: 24 }, () => ({ x: r1() * 300, y: r1() * 330, r: 1.5 + r1() * 2.5, p: r1() * 6 }));
/** `beam`: 0…1 strength of the streetlight that lands on the guitar in the corner. `flash`: warm light after the idea. */
export const BedroomBg: React.FC<{ t: number; beam: number }> = ({ t, beam }) => (
  <g>
    <defs>
      <linearGradient id="bed-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1c3c" /><stop offset="1" stopColor="#0d0e20" /></linearGradient>
      <linearGradient id="bed-beam" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfd8ff" stopOpacity={0.5} /><stop offset="1" stopColor="#cfd8ff" stopOpacity={0.05} /></linearGradient>
      <clipPath id="bed-win"><rect width={300} height={330} rx={14} /></clipPath>
    </defs>
    <rect width={1080} height={1920} fill="url(#bed-wall)" />
    <g transform="translate(700 420)">
      <rect x={-10} y={-10} width={320} height={350} rx={22} fill="#0b0c1c" /><rect width={300} height={330} rx={14} fill="#161a44" />
      <g clipPath="url(#bed-win)">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dfe0ff" opacity={0.35 + 0.5 * Math.abs(Math.sin(t * 1.4 + s.p))} />)}
        <circle cx={210} cy={90} r={46} fill="#f4ecd0" /><circle cx={226} cy={78} r={42} fill="#161a44" />
      </g>
      <line x1={150} y1={0} x2={150} y2={330} stroke="#0b0c1c" strokeWidth={10} /><line x1={0} y1={165} x2={300} y2={165} stroke="#0b0c1c" strokeWidth={10} />
    </g>
    {/* light from the window falls across the floor to the corner where the guitar waits */}
    <path d="M 700 750 L 1000 750 L 360 1700 L 40 1700 Z" fill="url(#bed-beam)" opacity={0.35 + 0.5 * beam} />
    <rect x={0} y={1660} width={1080} height={260} fill="#0a0a17" />
    {/* bed: headboard and pillow */}
    <rect x={250} y={880} width={760} height={780} rx={90} fill="#2b2457" /><rect x={250} y={880} width={760} height={780} rx={90} fill="none" stroke="#1c1840" strokeWidth={8} />
    <ellipse cx={640} cy={1160} rx={250} ry={90} fill="#e9e9ed" opacity={0.85} /><ellipse cx={640} cy={1180} rx={250} ry={80} fill="#b2b6ca" opacity={0.5} />
  </g>
);
export const BedFront: React.FC = () => (
  <g>
    <path d="M 250 1500 Q 440 1470 640 1500 T 1010 1500 L 1010 1920 L 250 1920 Z" fill="#4a4182" />
    <path d="M 250 1500 Q 440 1470 640 1500 T 1010 1500" fill="none" stroke="#6a5fb0" strokeWidth={8} />
    {[1600, 1700, 1800].map((y) => <path key={y} d={`M 250 ${y} Q 440 ${y - 24} 640 ${y} T 1010 ${y}`} fill="none" stroke="#352f66" strokeWidth={6} />)}
  </g>
);

void C; void alpha; void FONT; void clamp; void rng;
