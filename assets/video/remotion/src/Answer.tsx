// Scene 3 (4–6 s): "Now play it back." The learner's side — finger taps land on the frets with a ripple and the numbered markers of the app's
// answer board (placed = accent outline; the latest gets a halo; the same cell tapped twice keeps the newest number, as in Fretboard.tsx).
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { Tune } from '../tune.mjs';
import { Board, cellCenter } from './Board';
import { Finger, boardToScreen, fingerAt } from './Finger';
import { buildCamera } from './camera';
import { NeckStage, BOARD_TOP } from './NeckStage';
import { Headline } from './Headline';
import { C, alpha, FONT } from './theme';
import { clamp, easeOut } from './util';

const START = 4;
const CHECK = { x: 720, y: 1764 };   // centre of the Check button (Controls below)

export const Answer: React.FC<{ tune: Tune }> = ({ tune }) => {
  const ANSWER = useMemo(() => tune.notes.filter((n) => n.phase === 'answer'), [tune]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = START + frame / fps;
  const cams = useMemo(() => buildCamera(ANSWER, START, 120, fps, 1.18, 0.7), [fps, ANSWER]);
  const cam = cams[Math.min(frame, cams.length - 1)];
  const done = ANSWER.map((n, i) => ({ n, i })).filter(({ n }) => n.t <= t);
  const latestIdx = done.length - 1;

  // last tap wins per cell
  const cells = new Map<string, number>();
  done.forEach(({ n, i }) => cells.set(`${n.s}:${n.f}`, i));

  const amp = Array.from({ length: 6 }, (_, s) => {
    const last = [...done].reverse().find(({ n }) => n.s === s);
    if (!last) return 0;
    const a = t - last.n.t;
    return 9 * Math.exp(-a * 7) * Math.cos(a * 64);
  });
  const rows = done.filter(({ n }) => t - n.t < 0.3).map(({ n }) => ({ fret: n.f, o: 0.16 * Math.exp(-(t - n.t) * 10) }));

  // the finger: one stop per tap (the contact point is the cell's centre as the tilted board shows it right then), then the Check button
  const TILT = 9, roll = (f: number) => 1.6 - 3 * (f / 120);
  const lastT = ANSWER[ANSWER.length - 1].t;
  const pressAt = tune.finger ? START + 2 - 0.02 : lastT + ANSWER[ANSWER.length - 1].dur + 0.1;
  const stops = useMemo(() => {
    if (!tune.finger) return [];
    const out = ANSWER.map((n) => {
      const f = Math.round((n.t - START) * fps), c = cellCenter(n.s, n.f), cm = cams[Math.min(f, cams.length - 1)];
      const p = boardToScreen(c.x, c.y, cm, TILT, roll(f));
      return { t: n.t, x: p.x, y: p.y, s: p.s };
    });
    out.push({ t: START + 2 - 0.02, x: CHECK.x, y: CHECK.y, s: 1 });
    return out;
  }, [ANSWER, cams, fps, tune.finger]);
  const fing = tune.finger ? fingerAt(stops, t) : null;
  const contact = fing ? Math.max(...stops.map((st) => Math.exp(-Math.abs(t - st.t) * 30))) : 0;

  return (
    <>
      <Headline lines={tune.copy.answer} />
      <div
        style={{
          position: 'absolute', left: 80, top: BOARD_TOP - 66, height: 52, padding: '0 22px', borderRadius: 26, display: 'flex', alignItems: 'center', gap: 14,
          background: alpha(C.surface, 0.9), border: `2px solid ${alpha(C.text, 0.16)}`, fontFamily: FONT, fontSize: 28, color: alpha(C.text, 0.8),
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: 7, background: C.accent3, boxShadow: `0 0 16px ${C.accent}` }} />
        {tune.copy.chip}
        <span style={{ color: C.accent4, fontWeight: 600 }}>{done.length} / {ANSWER.length}</span>
      </div>
      <Controls placed={done.length} pressAt={pressAt} t={t} />
      <NeckStage cam={cam} tilt={9} roll={1.6 - 3 * (frame / 120)}>
        <Board stringAmp={amp} rows={rows}>
          {Array.from(cells.entries()).map(([key, idx]) => {
            const n = ANSWER[idx];
            const { x, y } = cellCenter(n.s, n.f);
            const latest = idx === latestIdx;
            const pop = spring({ frame: frame - Math.round((n.t - START) * fps), fps, config: { damping: 9, stiffness: 280 } });
            return (
              <g key={key}>
                {latest && <circle cx={x} cy={y} r={52} fill={alpha(C.accent, 0.28)} filter="url(#glow-s)" />}
                {latest && <circle cx={x} cy={y} r={46} fill={alpha(C.accent, 0.2)} />}
                <g transform={`translate(${x} ${y}) scale(${0.55 + 0.45 * pop})`}>
                  <circle r={30} fill={alpha(C.accent, 0.26)} stroke={C.accent} strokeWidth={3.5} />
                  <text textAnchor="middle" y={10} fontSize={29} fontWeight={600} fontFamily={FONT} fill={C.accent4}>{idx + 1}</text>
                </g>
              </g>
            );
          })}
          {done.map(({ n, i }) => {
            const age = t - n.t;
            if (age > 0.32) return null;
            const { x, y } = cellCenter(n.s, n.f);
            const p = clamp(age / 0.32);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={78 - 44 * easeOut(p * 2.2)} fill="none" stroke={alpha('#ffffff', 0.85 * (1 - p))} strokeWidth={4} />
                <circle cx={x} cy={y} r={38} fill={alpha('#ffffff', 0.5 * (1 - p) * (1 - p))} />
              </g>
            );
          })}
        </Board>
      </NeckStage>
      {fing && <Finger x={fing.x} y={fing.y} lift={fing.lift} vx={fing.vx} vy={fing.vy} scale={0.8} press={contact} t={t} />}
    </>
  );
};

/**
 * The app's answer action bar (src/components/controls/FretboardControls.tsx): Replay · Undo · Clear · Check. Undo/Clear/Check stay dim until a note is
 * placed (as in the app); Check carries the accent glow and is pressed once the last note is down.
 */
const Controls: React.FC<{ placed: number; pressAt: number; t: number }> = ({ placed, pressAt, t }) => {
  const press = clamp((t - pressAt) / 0.08) * (1 - clamp((t - pressAt - 0.22) / 0.1));
  const dim = (on: boolean) => (on ? 1 : 0.45);
  const box = { height: 104, borderRadius: 20, border: `2px solid ${alpha(C.text, 0.16)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: C.text } as const;
  return (
    <div style={{ position: 'absolute', left: 80, top: 1712, width: 920, display: 'flex', gap: 16 }}>
      <div style={{ ...box, width: 104, fontSize: 48 }}>↻</div>
      <div style={{ ...box, width: 104, fontSize: 48, opacity: dim(placed > 0) }}>↶</div>
      <div style={{ ...box, width: 104, fontSize: 44, opacity: dim(placed > 0) }}>✕</div>
      <div
        style={{
          ...box, flex: 1, border: `2px solid ${C.accent}`, color: C.accent, fontSize: 42, fontWeight: 500, opacity: dim(placed > 0),
          background: alpha(C.accent, 0.18 * press), transform: `scale(${1 - 0.04 * press})`,
          boxShadow: `0 0 ${36 + 40 * press}px ${alpha(C.accent, 0.4 + 0.3 * press)}`,
        }}
      >
        Check
      </div>
    </div>
  );
};
