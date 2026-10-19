import React from 'react';
import { spring, useVideoConfig } from 'remotion';
import { useCurrentFrame } from './clock';
import { C, alpha, FONT } from './theme';
import { clamp } from './util';

/** `*word*` → accent-coloured span (shared by the headline and the result line). */
export const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*[^*]+\*)/).map((part, j) =>
      part.startsWith('*') ? (
        <span key={j} style={{ color: C.accent3, textShadow: `0 0 40px ${alpha(C.accent, 0.8)}` }}>{part.slice(1, -1)}</span>
      ) : (
        <span key={j}>{part}</span>
      ),
    )}
  </>
);

/** Big hook text, one spring per line. `*word*` is the accent. `instant` shows it fully from frame 0 (first-frame headline). */
export const Headline: React.FC<{ lines: string[]; instant?: boolean; top?: number; size?: number }> = ({ lines, instant, top = 190, size = 112 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top, fontFamily: FONT, color: C.text, fontWeight: 600, fontSize: size, lineHeight: 1.03, letterSpacing: -3 }}>
      {lines.map((line, i) => {
        const p = instant ? 1 : spring({ frame: frame - i * 5 - 2, fps, config: { damping: 15, stiffness: 190, mass: 0.8 } });
        return (
          <div key={i} style={{ transform: `translateY(${(1 - p) * 80}px)`, opacity: clamp(p * 1.5) }}>
            <Rich text={line} />
          </div>
        );
      })}
    </div>
  );
};
