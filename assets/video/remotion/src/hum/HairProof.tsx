// A proof sheet for the wind-blown hair: three designs (A / B / C), each as a close-up and as the film's medium shot on the cliff.
// Not part of the film — render with: node render-hum.mjs --hair   → out/frames/hair-proof.png
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT } from '../theme';
import { Person } from '../pain/Person';
import type { HairVariant } from '../pain/WindHair';

const HERO = { skin: '#d9a07a', shirt: '#3d4064', hair: 'windy', hairColor: '#171420', sleeves: 'short' } as const;
const PW = 600, PH = 750;

const Backdrop: React.FC<{ id: string }> = ({ id }) => (
  <g>
    <defs>
      <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#21174f" /><stop offset="0.35" stopColor="#7a3a86" /><stop offset="0.6" stopColor="#f07a55" /><stop offset="0.8" stopColor="#ffc27a" /><stop offset="1" stopColor="#ffd9a0" /></linearGradient>
      <radialGradient id={`sun-${id}`}><stop offset="0" stopColor="#fff6d8" /><stop offset="0.35" stopColor="#ffd38a" stopOpacity={0.85} /><stop offset="1" stopColor="#ff8a4a" stopOpacity={0} /></radialGradient>
    </defs>
    <rect width={PW} height={PH} fill={`url(#sky-${id})`} />
    <circle cx={330} cy={560} r={420} fill={`url(#sun-${id})`} />
    <circle cx={330} cy={560} r={70} fill="#fff3c9" />
    <path d={`M 0 640 L 90 560 L 170 620 L 260 540 L 350 630 L 450 560 L 540 620 L 600 580 L 600 ${PH} L 0 ${PH} Z`} fill="#5e3b7c" opacity={0.9} />
    <path d={`M 0 700 L 120 640 L 220 690 L 340 620 L 460 690 L 600 650 L 600 ${PH} L 0 ${PH} Z`} fill="#3b2a63" />
  </g>
);

const Panel: React.FC<{ v: HairVariant; row: 0 | 1; col: number }> = ({ v, row, col }) => {
  const id = `${v}${row}`;
  return (
    <g transform={`translate(${col * PW} ${row * PH})`}>
      <clipPath id={`clip-${id}`}><rect width={PW} height={PH} /></clipPath>
      <g clipPath={`url(#clip-${id})`}>
        <Backdrop id={id} />
        {row === 0
          ? <Person x={190} y={1010} scale={2} t={2.1} seed={2} {...HERO} hairVariant={v} wind={1} mood="focus" look={[0, 0.2]} lean={-3} />
          : <Person x={250} y={700} scale={1.15} t={2.1} seed={2} {...HERO} hairVariant={v} wind={1} electric mood="grin" lean={-3} guitar={{ u: 0.5, strum: 1, glow: 0 }} />}
      </g>
      {row === 0 && <text x={26} y={74} fontFamily={FONT} fontWeight={800} fontSize={64} fill="#fff" stroke="#0a0818" strokeWidth={6} paintOrder="stroke">{v.toUpperCase()}</text>}
    </g>
  );
};

export const HairProof: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <svg width={PW * 3} height={PH * 2}>
      {(['a', 'b', 'c'] as HairVariant[]).map((v, i) => [0, 1].map((r) => <Panel key={`${v}${r}`} v={v} row={r as 0 | 1} col={i} />))}
      <line x1={PW} y1={0} x2={PW} y2={PH * 2} stroke="#0a0818" strokeWidth={4} /><line x1={PW * 2} y1={0} x2={PW * 2} y2={PH * 2} stroke="#0a0818" strokeWidth={4} /><line x1={0} y1={PH} x2={PW * 3} y2={PH} stroke="#0a0818" strokeWidth={4} />
    </svg>
  </AbsoluteFill>
);
