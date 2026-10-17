// Cover image for Instagram: the profile grid crops a Reel to the middle (≈ 1:1 – 3:4), so the hook lives in the middle, not at the top as in the video.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Tune } from '../tune.mjs';
import { Background } from './Background';
import { Headline } from './Headline';
import { C } from './theme';

export const Cover: React.FC<Tune> = (tune) => (
  <AbsoluteFill>
    <Background beat={tune.beat} brand={tune.copy.brand} />
    <Headline lines={tune.copy.listen} instant top={650} size={176} />
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 30 }, (_, i) => {
        const h = 24 + 120 * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
        return <rect key={i} x={90 + i * 31.5} y={1210 - h / 2} width={16} height={h} rx={8} fill={i % 3 === 0 ? C.accent3 : C.accent} opacity={0.8} />;
      })}
    </svg>
  </AbsoluteFill>
);
