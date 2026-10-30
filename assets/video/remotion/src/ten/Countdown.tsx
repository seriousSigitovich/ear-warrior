import React from 'react';
import { K, FONT, rgba } from './theme';
import { kick, springAt, POP } from './motion';
import { T, COUNT_FROM, remaining } from '../../ten/story.mjs';

const R = 150, SW = 16;
const C = 2 * Math.PI * R;

/**
 * The 7 → 0 countdown, locked to the timeline: the arc drains smoothly (it is `remaining(t) / 7`), the numeral is ceil(remaining) and
 * pulses on every whole second — the same instants the soundtrack ticks (story.mjs TICKS).
 */
export const Countdown: React.FC<{ t: number; cy: number; appear: number; boom?: number }> = ({ t, cy, appear, boom = 0 }) => {
  const left = remaining(t);                                       // 7 → 0 as t runs 5 → 12
  const num = Math.min(COUNT_FROM, Math.ceil(left - 1e-6));
  const sinceTick = t - Math.floor(t);                             // seconds since the numeral last changed
  const pulse = t >= T.challenge ? kick(sinceTick, 7) : 0;
  const urgent = left <= 3;
  const frac = left / COUNT_FROM;
  const enter = springAt(t, T.challenge - 0.05, POP);
  const scale = (0.5 + 0.5 * enter) * (1 + 0.025 * pulse) * (1 + boom * 0.5);
  const opacity = Math.min(1, enter * 2) * (1 - boom);
  // the bright head of the arc, at its draining end
  const headAng = -Math.PI / 2 + frac * Math.PI * 2;
  return (
    <div style={{ position: 'absolute', left: 540 - 220, top: cy - 220, width: 440, height: 440, transform: `scale(${scale})`, opacity }}>
      <svg width={440} height={440} viewBox="-220 -220 440 440" style={{ overflow: 'visible' }}>
        <circle r={R + 62 + 14 * pulse} fill="none" stroke={rgba(K.lime, 0.05 + 0.22 * pulse)} strokeWidth={2} />
        <circle r={R} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.11)" strokeWidth={SW} />
        {/* one tick per second, so the whole seconds read on the dial */}
        {Array.from({ length: COUNT_FROM }, (_, i) => {
          const a = -Math.PI / 2 + (i / COUNT_FROM) * Math.PI * 2;
          return <line key={i} x1={Math.cos(a) * (R + 22)} y1={Math.sin(a) * (R + 22)} x2={Math.cos(a) * (R + 38)} y2={Math.sin(a) * (R + 38)} stroke={i < Math.round(left) ? K.lime : 'rgba(255,255,255,0.22)'} strokeWidth={4} strokeLinecap="round" />;
        })}
        <circle r={R} fill="none" stroke={K.lime} strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90)" style={{ filter: `drop-shadow(0 0 ${10 + 14 * pulse}px ${rgba(K.lime, 0.55)})` }} />
        {frac > 0.004 && <circle cx={Math.cos(headAng) * R} cy={Math.sin(headAng) * R} r={SW * 0.9} fill={K.white} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 220, letterSpacing: '-0.04em', color: urgent ? K.lime : K.white, transform: `scale(${1 + 0.2 * pulse})`, textShadow: urgent ? `0 0 ${30 + 30 * pulse}px ${rgba(K.lime, 0.5)}` : '0 0 30px rgba(255,255,255,0.12)', fontVariantNumeric: 'tabular-nums' }}>
        {left <= 0 ? 0 : num}
      </div>
    </div>
  );
};
