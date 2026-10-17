// Scene 2 (2–4 s): "Every note has a fret." The same melody lit up on the neck — strings ring, the played fret flashes, a glowing path
// links the notes and the camera dives after them as they climb from the G string to the high e.
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { Tune } from '../tune.mjs';
import { Board, cellCenter } from './Board';
import { buildCamera } from './camera';
import { NeckStage } from './NeckStage';
import { Headline } from './Headline';
import { C, alpha } from './theme';
import { clamp, easeOut } from './util';

const START = 2;

export const NeckTour: React.FC<{ tune: Tune }> = ({ tune }) => {
  const TOUR = useMemo(() => tune.notes.filter((n) => n.phase === 'tour'), [tune]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = START + frame / fps;
  const cams = useMemo(() => buildCamera(TOUR, START, 120, fps, 1.18, 0.55), [fps, TOUR]);
  const cam = cams[Math.min(frame, cams.length - 1)];
  const played = TOUR.filter((n) => n.t <= t);

  const amp = Array.from({ length: 6 }, (_, s) => {
    const last = [...played].reverse().find((n) => n.s === s);
    if (!last) return 0;
    const a = t - last.t;
    return 11 * Math.exp(-a * 6) * Math.cos(a * 70);
  });
  const rows = played.filter((n) => t - n.t < 0.35).map((n) => ({ fret: n.f, o: 0.2 * Math.exp(-(t - n.t) * 9) }));

  return (
    <>
      <Headline lines={tune.copy.tour} />
      <NeckStage cam={cam} tilt={16 - 5 * easeOut(frame / 120)} roll={-2 + 3.5 * (frame / 120)}>
        <Board stringAmp={amp} rows={rows}>
          {played.slice(1).map((n, i) => {
            const a = TOUR[i];
            const age = t - n.t;
            const k = clamp(age / 0.06);
            const p1 = cellCenter(a.s, a.f), p2 = cellCenter(n.s, n.f);
            const x2 = p1.x + (p2.x - p1.x) * k, y2 = p1.y + (p2.y - p1.y) * k;
            const o = 0.1 + 0.85 * Math.exp(-age * 2.6);
            return (
              <g key={i} opacity={o}>
                <line x1={p1.x} y1={p1.y} x2={x2} y2={y2} stroke={C.accent} strokeWidth={14} strokeLinecap="round" filter="url(#glow-s)" />
                <line x1={p1.x} y1={p1.y} x2={x2} y2={y2} stroke={C.accent4} strokeWidth={4} strokeLinecap="round" />
              </g>
            );
          })}
          {played.map((n, i) => {
            const { x, y } = cellCenter(n.s, n.f);
            const age = t - n.t;
            const latest = i === played.length - 1;
            const pop = spring({ frame: frame - Math.round((n.t - START) * fps), fps, config: { damping: 8, stiffness: 320 } });
            const ringP = clamp(age / 0.5);
            const r = latest ? 22 + 12 * pop : 17;
            return (
              <g key={i}>
                {ringP < 1 && <circle cx={x} cy={y} r={30 + 120 * easeOut(ringP)} fill="none" stroke={alpha(C.accent3, 0.7 * (1 - ringP))} strokeWidth={4} />}
                {latest && <circle cx={x} cy={y} r={r * 2.3} fill={alpha(C.accent, 0.85)} filter="url(#glow)" />}
                <circle cx={x} cy={y} r={r} fill={latest ? C.accent3 : alpha(C.accent, 0.3)} stroke={latest ? '#fff' : alpha(C.accent3, 0.7)} strokeWidth={latest ? 3 : 2.5} />
                {latest && <circle cx={x} cy={y} r={r * 0.4} fill="#fff" />}
              </g>
            );
          })}
        </Board>
      </NeckStage>
    </>
  );
};
