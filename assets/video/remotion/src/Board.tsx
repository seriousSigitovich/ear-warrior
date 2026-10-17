// The app's vertical fretboard (src/components/fretboard/Fretboard.tsx), redrawn as SVG for video: strings are columns (low E left),
// the nut on top, frets 0–12 descending. Same inlays, same string weights; adds string vibration and row highlights for motion.
import React, { ReactNode } from 'react';
import { C, alpha, FONT } from './theme';

export const BW = 920;
export const BH = 1160;
const PAD = 22, LABEL_H = 46, GUTTER = 64;
export const X0 = PAD + GUTTER;
export const COLW = (BW - PAD - X0) / 6;
export const Y0 = PAD + LABEL_H;
export const ROWH = (BH - PAD - Y0) / 13;

export const cellCenter = (s: number, f: number) => ({ x: X0 + (s + 0.5) * COLW, y: Y0 + (f + 0.5) * ROWH });

const LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const STRING_W = [3.5, 3, 2.5, 2, 1.5, 1].map((w) => w * 1.7);

export const Board: React.FC<{
  /** Vibration amplitude (px) per string, already time-dependent. */
  stringAmp?: number[];
  /** Highlighted fret rows (0–12) with opacity. */
  rows?: { fret: number; o: number }[];
  children?: ReactNode;
}> = ({ stringAmp, rows = [], children }) => {
  const bottom = Y0 + 13 * ROWH;
  return (
    <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <filter id="glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <filter id="glow-s" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id="board-clip">
          <rect x={0} y={0} width={BW} height={BH} rx={30} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={BW} height={BH} rx={30} fill={C.surface} />
      <rect x={1} y={1} width={BW - 2} height={BH - 2} rx={29} fill="none" stroke={alpha(C.text, 0.16)} strokeWidth={2} />
      <g clipPath="url(#board-clip)">
        {rows.map((r, i) => (
          <rect key={i} x={X0} y={Y0 + r.fret * ROWH} width={6 * COLW} height={ROWH} fill={alpha(C.accent, r.o)} />
        ))}
        {Array.from({ length: 13 }, (_, f) => (
          <rect
            key={f}
            x={X0}
            y={Y0 + (f + 1) * ROWH - (f === 0 ? 3 : 1)}
            width={6 * COLW}
            height={f === 0 ? 7 : 2}
            fill={f === 0 ? alpha(C.n300, 0.85) : alpha(C.n500, 0.3)}
          />
        ))}
        {LABELS.map((l, s) => (
          <text key={l} x={cellCenter(s, 0).x} y={PAD + 30} textAnchor="middle" fontSize={26} fontFamily={FONT} fill={alpha(C.text, 0.55)}>
            {l}
          </text>
        ))}
        {[3, 5, 7, 9, 12].map((f) => (
          <text key={f} x={PAD + GUTTER / 2} y={cellCenter(0, f).y + 8} textAnchor="middle" fontSize={22} fontFamily={FONT} fill={alpha(C.text, 0.45)}>
            {f}
          </text>
        ))}
        {[3, 5, 7, 9].map((f) => (
          <circle key={f} cx={cellCenter(2, f).x + COLW / 2} cy={cellCenter(2, f).y} r={9} fill={alpha(C.text, 0.14)} />
        ))}
        {[1, 3].map((s) => (
          <circle key={s} cx={cellCenter(s, 12).x + COLW / 2} cy={cellCenter(s, 12).y} r={9} fill={alpha(C.text, 0.14)} />
        ))}
        {Array.from({ length: 6 }, (_, s) => {
          const x = cellCenter(s, 0).x;
          const amp = stringAmp?.[s] ?? 0;
          let d = `M ${x} ${Y0}`;
          if (Math.abs(amp) > 0.05) {
            for (let i = 1; i <= 28; i++) {
              const u = i / 28;
              d += ` L ${x + amp * Math.sin(Math.PI * u)} ${Y0 + (bottom - Y0) * u}`;
            }
          } else d += ` L ${x} ${bottom}`;
          return (
            <path
              key={s}
              d={d}
              fill="none"
              stroke={Math.abs(amp) > 0.5 ? alpha(C.accent4, 0.95) : alpha(C.n400, 0.65 - s * 0.07)}
              strokeWidth={STRING_W[s]}
              strokeLinecap="round"
            />
          );
        })}
        {children}
      </g>
    </svg>
  );
};
