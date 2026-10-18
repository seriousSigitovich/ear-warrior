// The app's fretboard as a picture-in-picture: every note that sounds lights its fret, a wrong note flashes red with a ×.
import React from 'react';
import { Board, BW, BH, cellCenter } from '../Board';
import { C, alpha, FONT } from '../theme';
import { clamp } from '../util';
import type { PNote } from '../../pain/story.mjs';

const BAD = '#ff5d73';

export const Inset: React.FC<{ x: number; y: number; k: number; t: number; notes: PNote[]; dim?: number; hold?: number }> = ({ x, y, k, t, notes, dim = 0, hold = 0.85 }) => {
  const live = notes.filter((n) => n.t <= t && t - n.t < hold + 0.4);
  const last = [...notes].reverse().find((n) => n.t <= t);
  const amp = [0, 0, 0, 0, 0, 0];
  if (last) { const d = t - last.t; amp[last.s] = 10 * Math.exp(-d * 6) * Math.cos(d * 70) * (last.ok === false ? 1.4 : 1); }
  const rows = last && t - last.t < 0.7 ? [{ fret: last.f, o: 0.22 * (1 - (t - last.t) / 0.7) }] : [];
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: BW * k, height: BH * k, opacity: 1 - dim }}>
      <div style={{ width: BW, height: BH, transformOrigin: '0 0', transform: `scale(${k})` }}>
        <Board stringAmp={amp} rows={rows}>
          {live.map((n, i) => {
            const d = t - n.t;
            const o = clamp(1 - Math.max(0, d - hold) / 0.4);
            const c = cellCenter(n.s, n.f);
            const bad = n.ok === false;
            const col = bad ? BAD : n.harmony ? C.warm : C.accent3;
            const pop = 1 + 0.35 * Math.exp(-d * 14);
            return (
              <g key={i} opacity={o}>
                <circle cx={c.x} cy={c.y} r={60 * pop} fill={alpha(col, 0.35)} filter="url(#glow-s)" />
                <circle cx={c.x} cy={c.y} r={34 * pop} fill={col} />
                {bad ? (
                  <path d={`M ${c.x - 14} ${c.y - 14} L ${c.x + 14} ${c.y + 14} M ${c.x + 14} ${c.y - 14} L ${c.x - 14} ${c.y + 14}`} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
                ) : (
                  <text x={c.x} y={c.y + 13} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={38} fill="#17182a">{n.f}</text>
                )}
                {bad && d < 0.5 && <circle cx={c.x} cy={c.y} r={34 + d * 220} fill="none" stroke={BAD} strokeWidth={6 * (1 - d / 0.5)} opacity={1 - d / 0.5} />}
              </g>
            );
          })}
        </Board>
      </div>
    </div>
  );
};
