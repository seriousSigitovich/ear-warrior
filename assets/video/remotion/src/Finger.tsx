// A human index finger tapping the app's board in the answer scene. Drawn as vector skin (gradient, nail, knuckle creases, a purple rim light from the
// screen) — not footage. Everything is a pure function of the time `t`.
//
// The finger lives in SCREEN space, so it can leave the tilted board and press the Check button; `boardToScreen` reproduces the CSS transform of
// NeckStage (camera translate/scale → rotateZ → rotateX → perspective) to find where a board cell lands on screen.
// Principles (README): ANTICIPATION/lift between taps (arc, not a straight slide), SQUASH on contact (the pad flattens), OVERSHOOT (a damped settle
// after each landing), SECONDARY ACTION (shadow tightens as it lands, ripple on the glass), never perfectly still (a slow drift while hovering).
import React from 'react';
import { BW, BH } from './Board';
import { BOARD_LEFT, BOARD_TOP } from './NeckStage';
import type { Cam } from './camera';
import { C, alpha } from './theme';
import { clamp, easeInOut, lerp } from './util';

const PERSPECTIVE = 2400;

/** Where a board point (px, py in board pixels) shows up on screen, and how much perspective scales it. */
export function boardToScreen(px: number, py: number, cam: Cam, tilt: number, roll: number) {
  const qx = cam.x + cam.k * px - BW / 2, qy = cam.y + cam.k * py - BH / 2;
  const b = (roll * Math.PI) / 180, a = (tilt * Math.PI) / 180;
  const x1 = qx * Math.cos(b) - qy * Math.sin(b), y1 = qx * Math.sin(b) + qy * Math.cos(b);
  const y2 = y1 * Math.cos(a), z2 = y1 * Math.sin(a);
  const s = PERSPECTIVE / (PERSPECTIVE - z2);
  return { x: BOARD_LEFT + BW / 2 + x1 * s, y: BOARD_TOP + BH / 2 + y2 * s, s };
}

export interface Stop { t: number; x: number; y: number }

/** Fingertip path: touches each stop exactly at its time, lifting on an arc in between. Returns the contact point, lift (0 = on the glass, 1 = high) and travel direction. */
export function fingerAt(stops: Stop[], t: number, intro = 0.45) {
  const first = stops[0], last = stops[stops.length - 1];
  const at = (tt: number) => {
    if (tt <= first.t) {
      const u = clamp((first.t - tt) / intro);
      return { x: first.x + 360 * u * u, y: first.y + 560 * u * u, lift: Math.sin((Math.PI / 2) * u) };   // arrives from the lower right
    }
    if (tt >= last.t) return { x: last.x, y: last.y, lift: 0 };
    let i = 0;
    while (i < stops.length - 2 && tt >= stops[i + 1].t) i++;
    const a = stops[i], b = stops[i + 1], u = (tt - a.t) / (b.t - a.t), e = easeInOut(u);
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), lift: Math.sin(Math.PI * u) ** 0.85 * Math.min(1, 0.35 + Math.hypot(b.x - a.x, b.y - a.y) / 500) };
  };
  const p = at(t), q = at(t + 0.02), r = at(t - 0.02);
  return { ...p, vx: (q.x - r.x) / 0.04, vy: (q.y - r.y) / 0.04 };
}

const LEN = 1700;   // long enough to run off the bottom of the frame

export const Finger: React.FC<{ x: number; y: number; lift: number; vx: number; vy: number; scale: number; press: number; t: number }> = ({ x, y, lift, vx, press, scale, t }) => {
  const drift = lift > 0.05 ? 3 * Math.sin(t * 5) : 0;                      // never perfectly still while hovering
  const angle = -17 + clamp(vx / 4500, -1, 1) * 7 + drift * 0.4;           // the hand leans into a sideways move
  const k = scale * (1 + 0.2 * lift);                                      // closer to the viewer when lifted
  const sq = 1 - 0.06 * press;                                             // pad flattens on contact
  const sh = 14 + 46 * lift;                                               // shadow: tight and dark on the glass, soft and offset in the air
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="skin" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#d99e7a" />
          <stop offset="0.28" stopColor="#f1c9a8" />
          <stop offset="0.62" stopColor="#e3ad88" />
          <stop offset="1" stopColor="#c68660" />
        </linearGradient>
        <linearGradient id="nail" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f7dcd2" />
          <stop offset="1" stopColor="#e6b7ab" />
        </linearGradient>
        <linearGradient id="rim" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={C.accent3} stopOpacity="0.55" />
          <stop offset="0.5" stopColor={C.accent} stopOpacity="0.15" />
          <stop offset="1" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
        <filter id="fshadow" x="-60%" y="-10%" width="220%" height="130%"><feGaussianBlur stdDeviation={sh * 0.55} /></filter>
      </defs>
      <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${k * (1 + 0.03 * press)} ${k * sq})`}>
        <g transform={`translate(${14 + 46 * lift} ${18 + 60 * lift})`} opacity={0.5 - 0.22 * lift} filter="url(#fshadow)">
          <path d={`M -78 0 A 78 78 0 0 1 78 -0.01 L 88 ${LEN} L -88 ${LEN} Z`} fill="#02030a" />
        </g>
        <path d={`M -78 0 A 78 78 0 0 1 78 -0.01 L 88 ${LEN} L -88 ${LEN} Z`} fill="url(#skin)" stroke="rgba(110,62,40,0.4)" strokeWidth={2.5} />
        <path d={`M 78 -0.01 L 88 ${LEN}`} stroke="url(#rim)" strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d="M -52 14 C -50 -50, 50 -50, 52 14 L 52 50 C 40 66, -40 66, -52 50 Z" fill="url(#nail)" stroke="rgba(150,88,80,0.45)" strokeWidth={2.2} transform="translate(0 -8)" />
        <ellipse cx={-18} cy={-14} rx={9} ry={20} fill="#fff" opacity={0.5} transform="rotate(12 -18 -14)" />
        <path d="M -58 78 Q 0 96 58 78" stroke="rgba(120,70,48,0.35)" strokeWidth={3} fill="none" />
        {[300, 470, 650].map((yy, i) => (
          <g key={yy} opacity={0.55}>
            <path d={`M -62 ${yy} Q 0 ${yy + 18} 62 ${yy}`} stroke="rgba(120,70,48,0.4)" strokeWidth={3} fill="none" />
            <path d={`M -48 ${yy + 22 + i * 2} Q 0 ${yy + 34} 48 ${yy + 22 + i * 2}`} stroke="rgba(120,70,48,0.25)" strokeWidth={2.5} fill="none" />
          </g>
        ))}
      </g>
    </svg>
  );
};
