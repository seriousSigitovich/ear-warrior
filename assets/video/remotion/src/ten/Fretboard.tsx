import React from 'react';
import { K, FONT, rgba } from './theme';
import { FB, fretX, noteX, stringY, STRING_W, WOUND } from './geometry';
import { easeOut, rng } from '../util';

/** A lit position on the neck. `scale` is its pop-in (may overshoot 1); `age` is seconds since it sounded (drives rings, glow, particles). */
export type Marker = { id: string; string: number; fret: number; label: string; scale: number; age: number; hot: boolean };
/** A string that was just plucked, vibrating from the fretted position to the bridge side. */
export type Vibe = { string: number; fret: number; age: number };

const STRING_NAME = ['E', 'A', 'D', 'G', 'B', 'E'];
const R = 27;                                                     // marker radius → 54 px discs on a 60 px string pitch

/** The vibrating string as a sampled sine under a decaying envelope: ~14 Hz shimmer. */
function vibePath(v: Vibe): string {
  const a = fretX(v.fret), b = FB.W, y = stringY(v.string), amp = 9 * Math.exp(-v.age * 5.5) * Math.cos(v.age * 2 * Math.PI * 14);
  let d = '';
  for (let i = 0; i <= 36; i++) { const u = i / 36; d += `${i ? 'L' : 'M'}${(a + (b - a) * u).toFixed(1)} ${(y + amp * Math.sin(Math.PI * u)).toFixed(1)} `; }
  return d;
}

const Particles: React.FC<{ m: Marker }> = ({ m }) => {
  if (m.age < 0 || m.age > 0.85) return null;
  const r = rng(m.id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 17));
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2 + r() * 0.5, v = 130 + r() * 200, size = 3 + r() * 5, k = 4.2;
        const d = (v * (1 - Math.exp(-k * m.age))) / k, life = 1 - m.age / 0.85;
        return <circle key={i} cx={Math.cos(ang) * d} cy={Math.sin(ang) * d - 14 * m.age} r={size * life} fill={i % 3 === 0 ? K.white : K.lime} opacity={life} />;
      })}
    </>
  );
};

const MarkerView: React.FC<{ m: Marker }> = ({ m }) => {
  const x = noteX(m.fret), y = stringY(m.string);
  const glow = m.hot ? Math.exp(-Math.max(0, m.age) * 3.2) : 0.28;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={96} fill={`url(#limeGlow)`} opacity={0.2 + 0.8 * glow} transform={`scale(${m.scale})`} />
      {[0, 0.09].map((d, i) => {
        const a = (m.age - d) / 0.6;
        return a > 0 && a < 1 ? <circle key={i} r={R + 74 * easeOut(a)} fill="none" stroke={i ? K.white : K.lime} strokeWidth={5 * (1 - a) + 0.8} opacity={0.9 * (1 - a)} /> : null;
      })}
      <Particles m={m} />
      <g transform={`scale(${m.scale})`}>
        <circle r={R + 5} fill={rgba(K.lime, 0.22)} />
        <circle r={R} fill="url(#limeDisc)" stroke={m.hot ? K.white : 'none'} strokeWidth={m.hot ? 3 : 0} />
        <text textAnchor="middle" dominantBaseline="central" y={2} fontFamily={FONT} fontWeight={900} fontSize={30} fill="#0b1204">{m.label}</text>
      </g>
    </g>
  );
};

/** The neck: six strings (standard tuning), seven frets at true scale-length spacing, nut, inlays, fret numbers — and whatever is lit on it. */
export const Fretboard: React.FC<{ markers: Marker[]; vibes: Vibe[]; fretLit: number[] }> = ({ markers, vibes, fretLit }) => {
  const fretNums = [3, 5, 7];
  return (
    <svg width={FB.W} height={FB.H + 70} viewBox={`0 -4 ${FB.W} ${FB.H + 70}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={K.woodHi} /><stop offset="0.5" stopColor={K.wood} /><stop offset="1" stopColor="#120a22" /></linearGradient>
        <linearGradient id="fadeR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" /><stop offset={(FB.W - 70) / FB.W} stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient>
        <mask id="neckMask"><rect x={0} y={-10} width={FB.W} height={FB.H + 20} fill="url(#fadeR)" /></mask>
        <linearGradient id="fretMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8f97a5" /><stop offset="0.5" stopColor={K.fret} /><stop offset="1" stopColor="#8f97a5" /></linearGradient>
        <radialGradient id="limeGlow"><stop offset="0" stopColor={K.lime} stopOpacity={0.85} /><stop offset="0.35" stopColor={K.lime} stopOpacity={0.25} /><stop offset="1" stopColor={K.lime} stopOpacity={0} /></radialGradient>
        <radialGradient id="limeDisc" cx="0.38" cy="0.32" r="0.9"><stop offset="0" stopColor="#F3FFC9" /><stop offset="0.45" stopColor={K.lime} /><stop offset="1" stopColor="#8fd11f" /></radialGradient>
      </defs>

      {/* string names */}
      {STRING_NAME.map((n, s) => <text key={s} x={FB.labelW / 2 - 4} y={stringY(s)} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={700} fontSize={28} fill={K.dim}>{n}</text>)}

      <g mask="url(#neckMask)">
        {/* the board: graphite, lit from above, with a hairline edge */}
        <rect x={FB.labelW} y={0} width={FB.W - FB.labelW} height={FB.H} rx={12} fill="url(#wood)" stroke="rgba(255,255,255,0.09)" strokeWidth={1.5} />
        <rect x={FB.labelW} y={0} width={FB.W - FB.labelW} height={FB.H * 0.28} rx={12} fill="rgba(255,255,255,0.035)" />
        {/* inlays */}
        {[3, 5, 7].map((n) => <circle key={n} cx={(fretX(n - 1) + fretX(n)) / 2} cy={FB.H / 2} r={13} fill="rgba(255,255,255,0.09)" />)}
        {/* fret wires */}
        {Array.from({ length: FB.frets }, (_, i) => i + 1).map((n) => (
          <g key={n}><rect x={fretX(n) - 2} y={4} width={4} height={FB.H - 8} fill="url(#fretMetal)" opacity={0.78} /><rect x={fretX(n) + 2} y={4} width={5} height={FB.H - 8} fill="rgba(0,0,0,0.25)" /></g>
        ))}
        {/* nut */}
        <rect x={FB.labelW - 2} y={0} width={13} height={FB.H} rx={3} fill={K.nut} />
        {/* strings */}
        {STRING_W.map((w, s) => (
          <g key={s}>
            <line x1={FB.labelW + 11} x2={FB.W} y1={stringY(s) + w * 0.7} y2={stringY(s) + w * 0.7} stroke="rgba(0,0,0,0.45)" strokeWidth={w} />
            <line x1={FB.labelW + 11} x2={FB.W} y1={stringY(s)} y2={stringY(s)} stroke={WOUND[s] ? '#9aa1ad' : '#EEF2F8'} strokeWidth={w} strokeLinecap="round" />
            {WOUND[s] && <line x1={FB.labelW + 11} x2={FB.W} y1={stringY(s)} y2={stringY(s)} stroke="#DDE2EA" strokeWidth={w * 0.55} strokeDasharray="1.4 2.6" opacity={0.75} />}
          </g>
        ))}
        {vibes.filter((v) => v.age >= 0 && v.age < 1.1).map((v, i) => <path key={i} d={vibePath(v)} fill="none" stroke={K.lime} strokeWidth={STRING_W[v.string] + 0.8} strokeLinecap="round" opacity={Math.exp(-v.age * 2.4)} />)}
      </g>

      {/* fret numbers */}
      {fretNums.map((n) => {
        const on = fretLit.includes(n);
        return <text key={n} x={(fretX(n - 1) + fretX(n)) / 2} y={FB.H + 40} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={30} fill={on ? K.lime : 'rgba(255,255,255,0.32)'}>{n}</text>;
      })}

      {markers.filter((m) => m.scale > 0.001).map((m) => <MarkerView key={m.id} m={m} />)}
    </svg>
  );
};
