// YouTube thumbnail for the "tabs guy" sketch, 1280×720: the scared guitarist on the left, the hook on the right.
// Same cast and art as PainVideo (Person.tsx), so the thumbnail matches what the viewer then sees.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, alpha, FONT } from '../theme';
import { Person } from './Person';

const TAB = { skin: '#f0c3a0', shirt: '#7a74d6', hair: 'short', hairColor: '#3a2a22' } as const;
const STRINGS = [0, 1, 2, 3, 4, 5];

export const Thumb: React.FC = () => (
  <AbsoluteFill style={{ background: '#161826', fontFamily: FONT }}>
    <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="th-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2a63" /><stop offset="0.55" stopColor="#262049" /><stop offset="1" stopColor="#14152a" />
        </linearGradient>
        <radialGradient id="th-glow" cx="0.3" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#ff9f6e" stopOpacity={0.5} /><stop offset="1" stopColor="#ff9f6e" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="th-vig" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </radialGradient>
      </defs>
      <rect width={1280} height={720} fill="url(#th-wall)" />
      <rect width={1280} height={720} fill="url(#th-glow)" />
      {/* tab staff running behind the text: the thing he cannot play without */}
      <g opacity={0.13}>
        {STRINGS.map((i) => <line key={i} x1={600} y1={150 + i * 78} x2={1280} y2={150 + i * 78} stroke={C.accent4} strokeWidth={3} />)}
      </g>
      <Person x={385} y={742} scale={1.78} t={1.3} seed={2} {...TAB} mood="worry" look={[-0.2, 0.5]} sweat={0.45} lean={-2}
        guitar={{ u: 0.38, strum: 0.45, jitter: 0 }} />
      <rect width={1280} height={720} fill="url(#th-vig)" />
    </svg>
    <div style={{ position: 'absolute', left: 700, top: 62, width: 540, color: C.text, fontWeight: 800, letterSpacing: -3, lineHeight: 0.98, textShadow: '0 6px 36px rgba(8,8,18,0.8)' }}>
      <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1, color: C.accent4, marginBottom: 14 }}>7 years of guitar</div>
      <div style={{ fontSize: 132 }}>ZERO</div>
      <div style={{ fontSize: 132 }}>SONGS</div>
      <div style={{ fontSize: 104, marginTop: 6 }}>WITHOUT</div>
      <div style={{ fontSize: 150, color: C.accent3, textShadow: `0 0 60px ${alpha(C.accent, 0.9)}, 0 6px 36px rgba(8,8,18,0.8)` }}>TABS</div>
    </div>
  </AbsoluteFill>
);

/**
 * Instagram cover, 1080×1920. The profile grid crops a Reel to the middle 3:4 (y ≈ 240–1680), so the hook and the face
 * both live inside that band. Same design as the YouTube thumbnail, stacked instead of side by side.
 */
export const ThumbVertical: React.FC = () => (
  <AbsoluteFill style={{ background: '#161826', fontFamily: FONT }}>
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="tv-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2a63" /><stop offset="0.55" stopColor="#262049" /><stop offset="1" stopColor="#14152a" />
        </linearGradient>
        <radialGradient id="tv-glow" cx="0.5" cy="0.68" r="0.5">
          <stop offset="0" stopColor="#ff9f6e" stopOpacity={0.5} /><stop offset="1" stopColor="#ff9f6e" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="tv-vig" cx="0.5" cy="0.5" r="0.8">
          <stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#tv-wall)" />
      <rect width={1080} height={1920} fill="url(#tv-glow)" />
      <g opacity={0.13}>
        {STRINGS.map((i) => <line key={i} x1={0} y1={380 + i * 100} x2={1080} y2={380 + i * 100} stroke={C.accent4} strokeWidth={3} />)}
      </g>
      <Person x={560} y={1850} scale={2.1} t={1.3} seed={2} {...TAB} mood="worry" look={[-0.2, 0.5]} sweat={0.45} lean={-2}
        guitar={{ u: 0.38, strum: 0.45, jitter: 0 }} />
      <rect width={1080} height={1920} fill="url(#tv-vig)" />
    </svg>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 240, textAlign: 'center', color: C.text, fontWeight: 800, letterSpacing: -4, lineHeight: 0.96, textShadow: '0 6px 36px rgba(8,8,18,0.8)' }}>
      <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: -1, color: C.accent4, marginBottom: 16 }}>7 years of guitar</div>
      <div style={{ fontSize: 196 }}>ZERO</div>
      <div style={{ fontSize: 196 }}>SONGS</div>
      <div style={{ fontSize: 150, marginTop: 6 }}>WITHOUT</div>
      <div style={{ fontSize: 230, color: C.accent3, textShadow: `0 0 70px ${alpha(C.accent, 0.9)}, 0 6px 36px rgba(8,8,18,0.8)` }}>TABS</div>
    </div>
  </AbsoluteFill>
);
