// The disco jam loop — two cuts on one 8 s groove (groove/story.mjs): | Cmaj7 | Am7 | Dm7 | G7 | at ♩ = 120, four on the floor.
//   GrooveJam  "Can you solo over this without tabs?" — the C major pentatonic box at fret 5 stays on the neck; every bar lights the
//              chord's own triad inside it (the notes to land on), a big chord name with the beat and the next chord.
//   GrooveCall "The guitar asks. Can you answer by ear?" — bars 1–2 a guitar phrase pops note by note on the box (LISTEN), bars 3–4 are
//              empty for the viewer (YOUR TURN, the beats draining), with the landing notes lit as in the jam cut.
// Same band, same look; the cuts differ only by the call. The last frame runs into the first (every idle motion makes whole cycles per
// loop, and every change is anticipated by LEAD so the downbeat lands with the picture already in place).
// Pure function of the frame. Palette: the brand's dark purple with a neon per chord (pink · cyan · lime · amber).
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { kick, lin, springAt, wob, SNAP, POP } from '../ten/motion';
import { FONT, rgba } from '../ten/theme';
import { clamp } from '../util';
import * as G from '../../groove/story.mjs';

const W = 1080;
const D = G.DURATION;
const LEAD = 0.07;                                                 // the lights change this much before the downbeat they belong to
const WORD_LEAD = 0.24;                                            // big words (chord name, LISTEN / YOUR TURN) settle before it: frame 0 is clean
const CALL_C = '#FF4FD8';
const BG = '#120821', INK = '#FFFFFF', DIM = 'rgba(255,255,255,0.55)', FAINT = 'rgba(255,255,255,0.14)';
const wrap = (x: number) => ((x % D) + D) % D;
const cyc = (t: number, n: number, ph = 0) => Math.sin((2 * Math.PI * n * t) / D + ph);

// --- neck geometry: frets 2.5 → 10.5 across the frame, real scale-length spacing --------------------------------------------------
const F0 = 2.45, F1 = 10.55, NX0 = 24, NW = 1032;
const d = (n: number) => 1 - Math.pow(2, -n / 12);
const fretX = (n: number) => NX0 + ((d(n) - d(F0)) / (d(F1) - d(F0))) * NW;
const noteX = (f: number) => fretX(f - 1) + (fretX(f) - fretX(f - 1)) * 0.56;
const SPACING = 74, TOP = 1012;
const stringY = (s: number) => TOP + (5 - s) * SPACING;           // low E at the bottom, as in a tab
const BOARD_T = TOP - 40, BOARD_B = stringY(0) + 40;
const GAUGE = [6.4, 5.0, 4.0, 3.0, 2.3, 1.8];
const R = 31;

type Phase = { bar: number; prev: number; age: number };
/** Which bar the picture shows (switching LEAD early) and how long ago it switched. */
const phaseAt = (t: number, lead = LEAD): Phase => {
  const u = wrap(t + lead), bar = Math.min(G.BARS - 1, Math.floor(u / G.BAR));
  return { bar, prev: (bar + G.BARS - 1) % G.BARS, age: u - bar * G.BAR };
};
const isTone = (midi: number, bar: number) => G.CHORDS[bar].tones.includes(midi % 12);
const isChordRoot = (midi: number, bar: number) => G.CHORDS[bar].tones[0] === midi % 12;

// --- background: glow in the chord's colour, drifting disco spots, a lit floor ----------------------------------------------------
const Room: React.FC<{ t: number; color: string }> = ({ t, color }) => {
  const k = kick(t % G.BEAT, 7);
  const spots = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    x: 540 + 470 * cyc(t, 1, i * 1.7), y: 900 + 760 * cyc(t, i % 2 ? 1 : 2, i * 2.3 + 0.6), r: 160 + 60 * (i % 3), c: G.CHORDS[i % 4].color,
  }));
  const beat = Math.floor(wrap(t) / G.BEAT);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 55% at 50% 30%, ${rgba(color, 0.2 + 0.1 * k)} 0%, ${rgba(color, 0.05)} 45%, ${BG} 75%)` }} />
      <svg width={W} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60" /></filter></defs>
        <g filter="url(#soft)" opacity={0.22 + 0.08 * k}>{spots.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} />)}</g>
        {/* the floor: two rows of tiles, a new pattern on every beat */}
        {Array.from({ length: 18 }, (_, i) => {
          const row = Math.floor(i / 9), col = i % 9, on = ((col * 7 + row * 5 + beat * 3) % 5) < 2;
          const c = G.CHORDS[(col + row + beat) % 4].color;
          return <rect key={i} x={col * 120 + 4} y={1712 + row * 104} width={112} height={96} rx={10} fill={on ? rgba(c, 0.32 * (0.55 + 0.45 * k)) : 'rgba(255,255,255,0.03)'} />;
        })}
      </svg>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(18,8,33,0) 82%, rgba(18,8,33,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

// --- the neck --------------------------------------------------------------------------------------------------------------------
type Hit = { s: number; f: number; age: number; dur: number };
const Neck: React.FC<{ t: number; lit: (midi: number) => number; hits: Hit[]; color: string; chordBar: number }> = ({ t, lit, hits, color, chordBar }) => {
  const k = kick(t % G.BEAT, 10);
  const boxL = fretX(4) + 6, boxR = fretX(8) + 14;
  const ringing = (s: number) => hits.filter((h) => h.s === s && h.age < h.dur + 0.05).map((h) => h.age);
  return (
    <svg width={W} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24143D" /><stop offset="1" stopColor="#170C29" /></linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset="0.06" stopColor="white" stopOpacity="1" />
          <stop offset="0.94" stopColor="white" stopOpacity="1" /><stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="ends"><rect x={0} y={0} width={W} height={1920} fill="url(#fade)" /></mask>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>
      <g mask="url(#ends)">
        <rect x={0} y={BOARD_T} width={W} height={BOARD_B - BOARD_T} fill="url(#board)" />
        <rect x={0} y={BOARD_T} width={W} height={3} fill="rgba(255,255,255,0.10)" />
        <rect x={0} y={BOARD_B - 3} width={W} height={3} fill="rgba(0,0,0,0.35)" />
        {/* the box zone */}
        <rect x={boxL} y={BOARD_T + 8} width={boxR - boxL} height={BOARD_B - BOARD_T - 16} rx={22} fill={rgba(color, 0.07 + 0.03 * k)} stroke={rgba(color, 0.45)} strokeWidth={2} strokeDasharray="10 10" />
        {/* inlays */}
        {[3, 5, 7, 9].map((f) => <circle key={f} cx={(fretX(f - 1) + fretX(f)) / 2} cy={(stringY(2) + stringY(3)) / 2} r={11} fill="rgba(255,255,255,0.10)" />)}
        {/* frets */}
        {[3, 4, 5, 6, 7, 8, 9, 10].map((f) => <rect key={f} x={fretX(f) - 3} y={BOARD_T} width={6} height={BOARD_B - BOARD_T} rx={3} fill="#B9C0CE" opacity={0.75} />)}
        {/* strings: a ringing one shakes and takes the call's colour */}
        {[0, 1, 2, 3, 4, 5].map((s) => {
          const ages = ringing(s), y = stringY(s);
          if (!ages.length) return <rect key={s} x={0} y={y - GAUGE[s] / 2} width={W} height={GAUGE[s]} fill={s < 3 ? '#C9B79A' : '#DADFE8'} opacity={0.8} />;
          const a = Math.min(...ages), amp = 5 * Math.exp(-a * 5);
          const pts = Array.from({ length: 61 }, (_, i) => { const x = (i / 60) * W; return `${x.toFixed(1)},${(y + amp * Math.sin((i / 60) * Math.PI * 3) * Math.cos(a * 90)).toFixed(1)}`; }).join(' ');
          return <polyline key={s} points={pts} fill="none" stroke="#FFFFFF" strokeWidth={GAUGE[s] + 1} opacity={0.95} />;
        })}
      </g>
      {/* fret numbers */}
      {[3, 4, 5, 6, 7, 8, 9, 10].map((f) => (
        <text key={f} x={noteX(f)} y={BOARD_B + 52} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={f === 5 || f === 8 ? 800 : 500} fill={f >= 5 && f <= 8 ? INK : DIM}>{f}</text>
      ))}
      {/* the box's notes */}
      {G.BOX.map((n, i) => {
        const x = noteX(n.f), y = stringY(n.s), amt = lit(n.midi), keyRoot = n.midi % 12 === G.KEY.root;
        const hit = hits.filter((h) => h.s === n.s && h.f === n.f).sort((a, b) => a.age - b.age)[0];
        const pop = hit ? kick(hit.age, 6) : 0, sounding = hit ? clamp(1 - (hit.age - hit.dur) / 0.18) : 0;
        const chordRoot = isChordRoot(n.midi, chordBar) && amt > 0;
        const sc = 1 + amt * (0.1 * k + (chordRoot ? 0.12 : 0)) + 0.4 * pop + 0.1 * sounding;
        const fill = sounding > 0 ? CALL_C : amt > 0 ? color : '#2B1A47';
        const ink = sounding > 0 || amt > 0.5 ? BG : 'rgba(255,255,255,0.8)';
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${sc})`}>
            {(amt > 0 || sounding > 0) && <circle r={R + 8} fill={sounding > 0 ? CALL_C : color} opacity={0.75 * Math.max(amt, sounding)} filter="url(#glow)" />}
            {hit && hit.age < 0.6 && <circle r={(R + 70 * lin(hit.age, 0, 0.6)) / sc} fill="none" stroke="#FFFFFF" strokeWidth={4 / sc} opacity={0.7 * (1 - lin(hit.age, 0, 0.6))} />}
            <circle r={R} fill={fill} opacity={amt > 0 || sounding > 0 ? 1 : 0.95} stroke={amt > 0 || sounding > 0 ? 'none' : 'rgba(255,255,255,0.4)'} strokeWidth={2.5} />
            {keyRoot && <circle r={R + 7} fill="none" stroke="#FFFFFF" strokeWidth={3.5} opacity={0.9} />}
            <text y={11} textAnchor="middle" fontFamily={FONT} fontSize={30} fontWeight={800} fill={ink}>{n.name}</text>
          </g>
        );
      })}
    </svg>
  );
};

// --- type -------------------------------------------------------------------------------------------------------------------------
const Text: React.FC<{ y: number; size: number; weight?: number; color?: string; tracking?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ y, size, weight = 800, color = INK, tracking = -0.02, style, children }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', fontFamily: FONT, fontSize: size, fontWeight: weight, color, letterSpacing: `${tracking}em`, lineHeight: 1.05, ...style }}>{children}</div>
);
const Hook: React.FC<{ a: string; b: string; accent: string }> = ({ a, b, accent }) => (
  <>
    <Text y={176} size={30} weight={700} color={DIM} tracking={0.22}>DISCO JAM · KEY OF C</Text>
    <Text y={236} size={76}>{a}</Text>
    <Text y={324} size={76} color={accent}>{b}</Text>
  </>
);
/** Four beat dots (or `n` of them), the current one filled; `drain` empties them instead. */
const Dots: React.FC<{ t: number; y: number; n: number; from: number; color: string; drain?: boolean }> = ({ t, y, n, from, color, drain }) => {
  const i = Math.floor((wrap(t) - from) / G.BEAT), k = kick(t % G.BEAT, 9), gap = n > 4 ? 46 : 64;
  return (
    <svg width={W} height={60} style={{ position: 'absolute', left: 0, top: y }}>
      {Array.from({ length: n }, (_, j) => {
        const on = drain ? j >= i : j <= i, now = j === i;
        return <circle key={j} cx={W / 2 + (j - (n - 1) / 2) * gap} cy={30} r={now ? 14 + 5 * k : 12} fill={on ? color : 'none'} stroke={on ? 'none' : FAINT} strokeWidth={3} opacity={drain && now ? 1 - 0.6 * lin(wrap(t) - from - i * G.BEAT, 0, G.BEAT) : 1} />;
      })}
    </svg>
  );
};
const ChordName: React.FC<{ p: Phase; y: number; size: number }> = ({ p, y, size }) => {
  const s = springAt(p.age, 0, SNAP), out = clamp(p.age / 0.12), cur = G.CHORDS[p.bar], prev = G.CHORDS[p.prev];
  const glow = (c: string) => `0 0 40px ${rgba(c, 0.7)}, 0 0 90px ${rgba(c, 0.35)}`;
  return (
    <>
      {out < 1 && <Text y={y} size={size} weight={900} color={prev.color} style={{ transform: `translateX(${-180 * out}px)`, opacity: 1 - out, textShadow: glow(prev.color) }}>{prev.name}</Text>}
      <Text y={y} size={size} weight={900} color={cur.color} style={{ transform: `translateX(${180 * (1 - s)}px) scale(${1 + 0.04 * wob(p.age, 7, 26)})`, opacity: clamp(s * 1.4), textShadow: glow(cur.color) }}>{cur.name}</Text>
    </>
  );
};
const Legend: React.FC<{ color: string; a: string; b: string }> = ({ color, a, b }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 1512, display: 'flex', justifyContent: 'center', gap: 44, fontFamily: FONT, fontSize: 30, fontWeight: 600, color: DIM }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 26, height: 26, borderRadius: 13, background: color, boxShadow: `0 0 18px ${color}` }} />{a}</span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 22, height: 22, borderRadius: 13, border: '2.5px solid rgba(255,255,255,0.5)', background: '#2B1A47' }} />{b}</span>
  </div>
);

const useT = () => { const frame = useCurrentFrame(); const { fps } = useVideoConfig(); return wrap(frame / fps); };

// --- cut 1: jam over the loop ----------------------------------------------------------------------------------------------------
export const GrooveJam: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const t = useT(), p = phaseAt(t), c = G.CHORDS[p.bar], next = G.CHORDS[(p.bar + 1) % G.BARS];
  const s = springAt(p.age, 0, POP);
  const lit = (m: number) => (isTone(m, p.bar) ? (isTone(m, p.prev) ? 1 : s) : isTone(m, p.prev) ? 1 - clamp(p.age / 0.06) : 0);
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <Room t={t} color={c.color} />
      <Hook a="Can you solo over this" b="without tabs?" accent="#C6FF4D" />
      <ChordName p={phaseAt(t, WORD_LEAD)} y={520} size={210} />
      <Dots t={t} y={770} n={4} from={p.bar * G.BAR} color={c.color} />
      <Text y={850} size={32} weight={600} color={DIM} tracking={0.04}>next  <span style={{ color: next.color, fontWeight: 800 }}>{next.name}</span></Text>
      <Neck t={t} lit={lit} hits={[]} color={c.color} chordBar={p.bar} />
      <Legend color={c.color} a="land here" b="any note works" />
      <Text y={1590} size={28} weight={600} color={FAINT} tracking={0.18}>C MAJOR PENTATONIC · FRET 5</Text>
      {!silent && <Audio src={staticFile('groove-jam.wav')} />}
    </AbsoluteFill>
  );
};

// --- cut 2: call and response ----------------------------------------------------------------------------------------------------
export const GrooveCall: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const t = useT(), p = phaseAt(t), c = G.CHORDS[p.bar];
  const answer = wrap(t + LEAD) >= G.CALL_END;
  const s = springAt(p.age, 0, POP);
  const on = (bar: number) => bar >= 2;                            // landing notes only while it's the viewer's turn
  const lit = (m: number) => {
    const now = on(p.bar) && isTone(m, p.bar), before = on(p.prev) && isTone(m, p.prev);
    return now ? (before ? 1 : s) : before ? 1 - clamp(p.age / 0.06) : 0;
  };
  const hits: Hit[] = G.CALL.map((n) => ({ s: n.s, f: n.f, age: t - n.t, dur: n.dur })).filter((h) => h.age >= 0 && h.age < h.dur + 0.8);
  const uw = wrap(t + WORD_LEAD), wordAnswer = uw >= G.CALL_END, word = springAt(wordAnswer ? uw - G.CALL_END : uw, 0, SNAP), color = wordAnswer ? '#C6FF4D' : '#FF4FD8';
  return (
    <AbsoluteFill style={{ background: BG, overflow: 'hidden' }}>
      <Room t={t} color={answer ? c.color : '#FF4FD8'} />
      <Hook a="The guitar asks." b="Can you answer by ear?" accent="#FF4FD8" />
      <Text y={540} size={150} weight={900} color={color} style={{ transform: `scale(${0.7 + 0.3 * word + 0.05 * wob(wordAnswer ? uw - G.CALL_END : uw, 7, 24)})`, opacity: clamp(word * 1.5), textShadow: `0 0 40px ${rgba(color, 0.7)}, 0 0 100px ${rgba(color, 0.3)}` }}>
        {wordAnswer ? 'YOUR TURN' : 'LISTEN'}
      </Text>
      <Dots t={t} y={730} n={8} from={answer ? G.CALL_END : 0} color={color} drain={answer} />
      <Text y={820} size={34} weight={600} color={DIM} tracking={0.04}>over  <span style={{ color: c.color, fontWeight: 800 }}>{c.name}</span></Text>
      <Neck t={t} lit={lit} hits={hits} color={answer ? c.color : '#FF4FD8'} chordBar={p.bar} />
      {answer
        ? <Legend color={c.color} a="land here" b="any note works" />
        : <Text y={1512} size={32} weight={600} color={DIM}>every note is in the box</Text>}
      <Text y={1590} size={28} weight={600} color={FAINT} tracking={0.18}>C MAJOR PENTATONIC · FRET 5</Text>
      {!silent && <Audio src={staticFile('groove-call.wav')} />}
    </AbsoluteFill>
  );
};
