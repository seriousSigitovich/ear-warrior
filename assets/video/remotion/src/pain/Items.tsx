// Props around the people: speech bubbles, the tab on a tablet, the dying phone, hearts and notes, counter chips, captions.
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, alpha, FONT } from '../theme';
import { clamp, easeOut } from '../util';
import { Rich } from '../Headline';
import type { PNote } from '../../pain/story.mjs';

export const INK = '#2a1d33';

// --- speech bubble (SVG) --------------------------------------------------------------------------------------------------------------
export const Bubble: React.FC<{ cx: number; cy: number; lines: string[]; tx: number; ty: number; p: number; size?: number; fill?: string; ink?: string }> = ({ cx, cy, lines, tx, ty, p, size = 48, fill = '#f6f3ff', ink = INK }) => {
  if (p <= 0.01) return null;
  const w = Math.max(...lines.map((l) => l.length)) * size * 0.54 + 70, h = lines.length * size * 1.18 + 42;
  const bx = Math.max(-w / 2 + 40, Math.min(w / 2 - 40, tx - cx));
  const down = ty > cy;
  const edge = down ? cy + h / 2 : cy - h / 2;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${0.6 + 0.4 * p}) translate(${-cx} ${-cy})`} opacity={clamp(p * 2)}>
      <path d={`M ${cx + bx - 20} ${edge} L ${cx + bx + 20} ${edge} L ${tx} ${ty} Z`} fill={fill} />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={34} fill={fill} />
      {lines.map((l, i) => (
        <text key={i} x={cx} y={cy - h / 2 + 21 + size * 1.18 * (i + 0.78)} textAnchor="middle" fontFamily={FONT} fontWeight={650} fontSize={size} fill={ink} letterSpacing={-1}>{l}</text>
      ))}
    </g>
  );
};

// --- tablet with a scrolling tab -------------------------------------------------------------------------------------------------------
const CHORDS = ['Am', 'F', 'C', 'G'];
export const TabScreen: React.FC<{ x: number; y: number; w: number; h: number; t: number; notes: PNote[]; speed?: number }> = ({ x, y, w, h, t, notes, speed = 175 }) => {
  const pad = 22, sx = x + pad + 54, sw = w - 2 * pad - 54, sy = y + pad + 52, sh = h - 2 * pad - 70;
  const head = sx + sw * 0.34;
  const gap = sh / 5;
  const LETTERS = ['e', 'B', 'G', 'D', 'A', 'E'];
  const yOf = (s: number) => sy + (5 - s) * gap;                          // string 5 (high e) on top
  const clipId = 'tab-clip';
  const bars = Array.from({ length: 8 }, (_, i) => i * 2);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={34} fill="#0c0d15" />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} rx={28} fill="#1a1b2b" />
      <text x={x + w / 2} y={y + 56 - 12} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={26} letterSpacing={6} fill={alpha(C.n400, 0.7)}>TAB</text>
      <clipPath id={clipId}><rect x={sx} y={y + 20} width={sw} height={h - 40} /></clipPath>
      {LETTERS.map((l, i) => <text key={l} x={x + pad + 32} y={sy + i * gap + 9} textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize={24} fill={alpha(C.n500, 0.9)}>{l}</text>)}
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={sx} y1={sy + i * gap} x2={sx + sw} y2={sy + i * gap} stroke={alpha(C.n400, 0.35)} strokeWidth={2} />)}
      <g clipPath={`url(#${clipId})`}>
        {bars.map((b) => {
          const bx = head + (b - t) * speed - 12;
          return (
            <g key={b}>
              <line x1={bx} y1={sy} x2={bx} y2={sy + 5 * gap} stroke={alpha(C.n400, 0.55)} strokeWidth={2.5} />
              <text x={bx + 10} y={sy - 12} fontFamily={FONT} fontWeight={650} fontSize={24} fill={alpha(C.accent4, 0.85)}>{CHORDS[(b / 2) % 4]}</text>
            </g>
          );
        })}
        {notes.map((n, i) => {
          const nx = head + (n.t - t) * speed;
          if (nx < sx - 30 || nx > sx + sw + 30) return null;
          const d = t - n.t;
          const on = d >= 0 && d < 0.2;
          const past = d >= 0.2;
          return (
            <g key={i} opacity={past ? 0.38 : 1}>
              <rect x={nx - 17} y={yOf(n.s) - 17} width={34} height={34} rx={9} fill={on ? C.accent3 : '#1a1b2b'} />
              <text x={nx} y={yOf(n.s) + 9} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={on ? 31 : 27} fill={on ? '#17182a' : C.text}>{n.f}</text>
            </g>
          );
        })}
      </g>
      <line x1={head} y1={sy - 22} x2={head} y2={sy + 5 * gap + 22} stroke={C.accent3} strokeWidth={4} opacity={0.8} />
      <circle cx={head} cy={sy - 28} r={7} fill={C.accent3} />
    </g>
  );
};

// --- the phone from the party scene -----------------------------------------------------------------------------------------------------
export const PhoneCard: React.FC<{ cx: number; cy: number; p: number; t: number }> = ({ cx, cy, p, t }) => {
  if (p <= 0.01) return null;
  const w = 430, h = 800;
  const blink = Math.sin(t * 14) > 0 ? 1 : 0.45;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${(1 - p) * -14 + Math.sin(t * 40) * 0.6 * p}) scale(${0.5 + 0.5 * p})`} opacity={clamp(p * 2)}>
      <rect x={-w / 2 - 6} y={-h / 2 - 6} width={w + 12} height={h + 12} rx={66} fill="#0a0a12" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={60} fill="#171826" />
      <rect x={-60} y={-h / 2 + 22} width={120} height={28} rx={14} fill="#0a0a12" />
      <text x={0} y={-h / 2 + 120} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={600} fill={alpha(C.text, 0.6)}>9:41</text>
      <g transform={`translate(${w / 2 - 110} ${-h / 2 + 96})`} opacity={blink}>
        <rect x={0} y={0} width={64} height={30} rx={8} fill="none" stroke="#ff5d73" strokeWidth={4} />
        <rect x={5} y={5} width={8} height={20} rx={3} fill="#ff5d73" />
        <rect x={64} y={9} width={5} height={12} rx={2} fill="#ff5d73" />
      </g>
      <text x={-w / 2 + 38} y={-h / 2 + 124} fontFamily={FONT} fontSize={26} fontWeight={700} fill="#ff5d73" opacity={blink}>1%</text>
      {[0, 1, 2, 3].map((i) => <rect key={i} x={-70 + i * 36} y={-90 - i * 22} width={22} height={30 + i * 22} rx={5} fill={alpha(C.text, 0.18)} />)}
      <line x1={-110} y1={30} x2={110} y2={-120} stroke="#ff5d73" strokeWidth={10} strokeLinecap="round" />
      <text x={0} y={140} textAnchor="middle" fontFamily={FONT} fontSize={66} fontWeight={650} fill={C.text} letterSpacing={-2}>No signal</text>
      <text x={0} y={210} textAnchor="middle" fontFamily={FONT} fontSize={36} fill={alpha(C.text, 0.55)}>Can’t load tab</text>
      <rect x={-130} y={270} width={260} height={70} rx={35} fill={alpha(C.accent, 0.25)} />
      <text x={0} y={318} textAnchor="middle" fontFamily={FONT} fontSize={34} fontWeight={600} fill={alpha(C.accent4, 0.8)}>Retry</text>
    </g>
  );
};

/** A phone in the loser's hand in the last scene: typing a search. */
export const SearchPhone: React.FC<{ cx: number; cy: number; text: string; p: number }> = ({ cx, cy, text, p }) => {
  if (p <= 0.01) return null;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${0.85 * (0.7 + 0.3 * p)})`} opacity={clamp(p * 2)}>
      <rect x={-170} y={-210} width={340} height={420} rx={42} fill="#0a0a12" />
      <rect x={-160} y={-200} width={320} height={400} rx={34} fill="#1a1b2b" />
      <rect x={-136} y={-150} width={272} height={58} rx={29} fill={alpha(C.text, 0.12)} />
      <text x={-114} y={-111} fontFamily={FONT} fontSize={27} fill={C.text}>{text}</text>
      {[0, 1, 2].map((i) => <rect key={i} x={-136} y={-60 + i * 74} width={272} height={52} rx={14} fill={alpha(C.text, 0.07)} />)}
    </g>
  );
};

// --- little vector icons -----------------------------------------------------------------------------------------------------------------
export const Heart: React.FC<{ x: number; y: number; s: number; o: number; rot?: number; color?: string }> = ({ x, y, s, o, rot = 0, color = '#ff6b8b' }) => (
  <path d="M 0 14 C -26 -4 -22 -26 -8 -26 C -2 -26 0 -20 0 -18 C 0 -20 2 -26 8 -26 C 22 -26 26 -4 0 14 Z" fill={color} opacity={o} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} />
);
export const MusicNote: React.FC<{ x: number; y: number; s: number; o: number; rot?: number; color?: string }> = ({ x, y, s, o, rot = 0, color = C.accent3 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
    <ellipse cx={0} cy={0} rx={13} ry={9.5} fill={color} transform="rotate(-20)" />
    <rect x={9} y={-44} width={4.5} height={44} fill={color} />
    <path d="M 13 -44 Q 28 -34 24 -16 Q 20 -28 13 -28 Z" fill={color} />
  </g>
);

/** Items rising from (cx, cy) one after another between t0 and t1. */
export const Floaters: React.FC<{ t: number; t0: number; t1: number; cx: number; cy: number; spread?: number; every?: number; kind: 'heart' | 'note' | 'mix'; rise?: number; size?: number }> = ({ t, t0, t1, cx, cy, spread = 150, every = 0.28, kind, rise = 300, size = 1 }) => {
  const out: React.ReactNode[] = [];
  for (let i = 0; t0 + i * every < t1; i++) {
    const age = t - (t0 + i * every);
    if (age < 0 || age > 2.2) continue;
    const u = age / 2.2;
    const dx = Math.sin(i * 12.9898) * spread + Math.sin(age * 3 + i) * 18;
    const k = kind === 'mix' ? (i % 2 ? 'heart' : 'note') : kind;
    const o = Math.min(1, age * 5) * (1 - u * u);
    const sc = (0.75 + 0.5 * ((i * 7) % 5) / 5) * size * (0.4 + 0.6 * easeOut(age * 4));
    const y = cy - rise * easeOut(u * 1.2);
    out.push(k === 'heart' ? <Heart key={i} x={cx + dx} y={y} s={sc * 1.1} o={o} rot={Math.sin(i) * 18} /> : <MusicNote key={i} x={cx + dx} y={y} s={sc} o={o} rot={Math.sin(i * 3) * 14} color={i % 3 ? C.accent3 : C.warm} />);
  }
  return <g>{out}</g>;
};

// --- HTML layer: counters and captions ---------------------------------------------------------------------------------------------------
export const Chip: React.FC<{ x: number; y: number; w: number; label: string; value: string; color?: string; pop?: number; align?: 'left' | 'right' }> = ({ x, y, w, label, value, color = C.accent4, pop = 1 }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, padding: '18px 22px 20px', borderRadius: 28, background: alpha('#0d0e1a', 0.78), border: `2px solid ${alpha(color, 0.35)}`, fontFamily: FONT, transform: `scale(${0.8 + 0.2 * pop})`, opacity: clamp(pop * 2) }}>
    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 1, color: alpha(C.text, 0.62) }}>{label}</div>
    <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2, color, lineHeight: 1.05, marginTop: 4 }}>{value}</div>
  </div>
);

/** Caption with a spring-in. Shown between `from` and `to` seconds (absolute). `*word*` = accent. */
export const Caption: React.FC<{ lines: string[]; from: number; to: number; top: number; size?: number; boxed?: boolean; left?: number; right?: number }> = ({ lines, from, to, top, size = 76, boxed = false, left = 60, right = 60 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t < from || t > to) return null;
  const out = clamp((to - t) / 0.15);
  return (
    <div style={{ position: 'absolute', left, right, top, textAlign: 'center', fontFamily: FONT, fontWeight: 650, fontSize: size, lineHeight: 1.06, letterSpacing: -2, color: C.text, opacity: out }}>
      {lines.map((l, i) => {
        const p = spring({ frame: frame - (from + i * 0.09) * fps, fps, config: { damping: 14, stiffness: 200, mass: 0.8 } });
        return (
          <div key={i} style={{ transform: `translateY(${(1 - p) * 50}px) scale(${0.92 + 0.08 * p})`, opacity: clamp(p * 1.6), textShadow: boxed ? 'none' : '0 4px 30px rgba(8,8,18,0.85), 0 2px 6px rgba(8,8,18,0.9)' }}>
            <Rich text={l} />
          </div>
        );
      })}
    </div>
  );
};
