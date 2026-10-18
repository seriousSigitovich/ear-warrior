// The two sets: Tab Guy's room (lamp-lit, quiet) and the party (warm, string lights). Drawn full-frame, 1080×1920.
import React from 'react';
import { C, alpha } from '../theme';
import { rng } from '../util';

const r1 = rng(11);
const STARS = Array.from({ length: 26 }, () => ({ x: r1() * 300, y: r1() * 330, r: 1.5 + r1() * 2.5, p: r1() * 6 }));

export const RoomBg: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <defs>
      <linearGradient id="room-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b2c4d" /><stop offset="1" stopColor="#1a1b33" />
      </linearGradient>
      <radialGradient id="lamp-glow"><stop offset="0" stopColor="#ffd9a0" stopOpacity={0.55} /><stop offset="1" stopColor="#ffd9a0" stopOpacity={0} /></radialGradient>
      <linearGradient id="sofa-seat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4182" /><stop offset="1" stopColor="#2c2754" /></linearGradient>
    </defs>
    <rect width={1080} height={1920} fill="url(#room-wall)" />
    {/* window with a night sky */}
    <g transform="translate(700 540)">
      <rect x={-10} y={-10} width={320} height={350} rx={22} fill="#0f1022" />
      <rect width={300} height={330} rx={14} fill="#14163a" />
      <clipPath id="win"><rect width={300} height={330} rx={14} /></clipPath>
      <g clipPath="url(#win)">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dfe0ff" opacity={0.35 + 0.5 * Math.abs(Math.sin(t * 1.4 + s.p))} />)}
        <circle cx={210} cy={90} r={46} fill="#f4ecd0" /><circle cx={226} cy={78} r={42} fill="#14163a" />
      </g>
      <line x1={150} y1={0} x2={150} y2={330} stroke="#0f1022" strokeWidth={10} /><line x1={0} y1={165} x2={300} y2={165} stroke="#0f1022" strokeWidth={10} />
    </g>
    {/* shelf with plant, to fill the wall left of the window */}
    <g transform="translate(70 940)">
      <rect x={0} y={0} width={190} height={14} rx={5} fill="#3b3a63" />
      <path d="M 40 0 L 56 -62 L 106 -62 L 122 0 Z" fill="#c2a190" />
      {[-34, -10, 14, 38].map((a, i) => <ellipse key={i} cx={81 + a * 1.1} cy={-100 - (i % 2) * 18} rx={14} ry={46} fill={i % 2 ? '#5fa58a' : '#78c0a0'} transform={`rotate(${a} ${81 + a} -70)`} />)}
    </g>
    {/* floor lamp */}
    <circle cx={985} cy={1150} r={430} fill="url(#lamp-glow)" />
    <rect x={978} y={1180} width={14} height={320} fill="#2a2a46" />
    <path d="M 945 1180 L 1025 1180 L 1000 1110 L 970 1110 Z" fill="#f3d6a8" />
    {/* sofa back */}
    <rect x={90} y={1210} width={960} height={420} rx={90} fill="#3a3370" />
    <rect x={90} y={1210} width={960} height={420} rx={90} fill="none" stroke="#25214d" strokeWidth={6} />
  </g>
);
/** Front of the sofa, drawn over the person's waist. */
export const RoomFront: React.FC = () => (
  <g>
    <rect x={0} y={1500} width={1080} height={420} fill="url(#sofa-seat)" />
    <rect x={0} y={1500} width={1080} height={10} fill="#6a5fb0" opacity={0.7} />
    <line x1={540} y1={1510} x2={540} y2={1920} stroke="#1f1b3f" strokeWidth={6} opacity={0.6} />
    <rect x={0} y={1500} width={90} height={420} rx={30} fill="#2f2a5f" />
    <rect x={990} y={1500} width={90} height={420} rx={30} fill="#2f2a5f" />
  </g>
);

// --- party ------------------------------------------------------------------------------------------------------------------------------
const r2 = rng(4);
const BOKEH = Array.from({ length: 14 }, () => ({ x: r2() * 1080, y: 160 + r2() * 760, r: 22 + r2() * 46, p: r2() * 6, c: r2() > 0.5 ? '#ffc98a' : '#b5abfc' }));
const BULBS = Array.from({ length: 13 }, (_, i) => i);

export const PartyBg: React.FC<{ t: number; dim?: number }> = ({ t, dim = 0 }) => (
  <g>
    <defs>
      <linearGradient id="party-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a2a63" /><stop offset="0.6" stopColor="#2a2150" /><stop offset="1" stopColor="#1b1638" />
      </linearGradient>
      <radialGradient id="party-glow"><stop offset="0" stopColor="#ff9f6e" stopOpacity={0.4} /><stop offset="1" stopColor="#ff9f6e" stopOpacity={0} /></radialGradient>
    </defs>
    <rect width={1080} height={1920} fill="url(#party-wall)" />
    <circle cx={540} cy={700} r={700} fill="url(#party-glow)" />
    {BOKEH.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.c} opacity={0.07 + 0.06 * Math.sin(t * 0.9 + b.p)} />)}
    {/* picture frames and a shelf with bottles */}
    <rect x={60} y={420} width={170} height={220} rx={10} fill="#1b1638" /><rect x={74} y={434} width={142} height={192} rx={4} fill="#5d5294" opacity={0.7} />
    <circle cx={145} cy={510} r={34} fill="#d2cefd" opacity={0.5} /><path d="M 74 626 L 120 560 L 160 600 L 190 570 L 216 626 Z" fill="#a7a1db" opacity={0.6} />
    <rect x={830} y={430} width={190} height={14} rx={5} fill="#4d3f86" />
    {[0, 1, 2, 3].map((i) => <g key={i}><rect x={850 + i * 40} y={360 - (i % 2) * 14} width={22} height={70 + (i % 2) * 14} rx={7} fill={['#5fa58a', '#c2a190', '#a7a1db', '#e8445a'][i]} opacity={0.85} /><rect x={856 + i * 40} y={344 - (i % 2) * 14} width={10} height={22} rx={3} fill={['#5fa58a', '#c2a190', '#a7a1db', '#e8445a'][i]} opacity={0.85} /></g>)}
    {/* string lights */}
    <path d="M -20 190 Q 540 400 1100 190" fill="none" stroke="#120f26" strokeWidth={5} />
    {BULBS.map((i) => {
      const u = i / 12, x = -20 + u * 1120;
      const y = 190 + 420 * u * (1 - u);
      const o = 0.75 + 0.25 * Math.sin(t * 2.2 + i * 1.7);
      const c = ['#ffc98a', '#ff8fb1', '#b5abfc', '#9ae6d4'][i % 4];
      return <g key={i}><circle cx={x} cy={y + 22} r={46} fill={c} opacity={0.14 * o} /><circle cx={x} cy={y + 20} r={13} fill={c} opacity={o} /></g>;
    })}
    {/* speaker */}
    <g transform="translate(12 1000)">
      <rect width={130} height={210} rx={18} fill="#14122c" />
      <circle cx={65} cy={72} r={30 + 2 * Math.sin(t * 8)} fill="#2a2650" /><circle cx={65} cy={150} r={40} fill="#2a2650" />
    </g>
    {/* coffee table in front of the performer */}
    <rect x={0} y={1565} width={1080} height={400} fill="#241b45" />
    <rect x={0} y={1565} width={1080} height={12} fill="#5b4a9a" opacity={0.8} />
    <rect x={0} y={1577} width={1080} height={60} fill="#000" opacity={0.18} />
    {[[140, '#e8445a'], [260, '#f7f3ff'], [880, '#e8445a'], [980, '#7fd1c4']].map(([x, c], i) => <rect key={i} x={+x - 20} y={1500} width={40} height={64} rx={8} fill={String(c)} opacity={0.9} />)}
    {dim > 0 && <rect width={1080} height={1920} fill="#07070f" opacity={dim} />}
  </g>
);
void C; void alpha;
