// Tab Guy, ep. 5 — "Wedding March". The three-piece from the band character sheet (public/band/<who>_<pose>.png) plays a wedding reception: the
// band ends a song, the newlyweds walk in, the bassist asks for the Wedding March; the guitarist (Tab Guy) finds only piano sheet music, plays
// it wrong twice and freezes while the bride's patience runs out and her bouquet wilts; the bassist plays the theme by ear, the drummer and
// the room join with a march, the bouquet bursts into petals on the reprise and she jumps; end card with the first notes on real frets.
// Timeline: ../../wedding/story.mjs (also the soundtrack, voices).
//
// Everything is a pure function of `t` (README "Animation principles"): poses swap on the beat, SQUASH/STRETCH anchored at the feet,
// ANTICIPATION crouch before the jump, OVERSHOOT on every pop, a HOLD after the landing, SECONDARY bouquet, petals, crowd, lights, notes, shake.
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Audio, Img, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, easeInOut, easeOut, rng } from '../util';
import { T, BEAT, MB, BEATS, LEAD, LEAD_POS, TRIES, REPLAY, OPEN_FILL, OPEN_SNARES, W_KICKS, W_SNARES, CLAPS, DURATION } from '../../wedding/story.mjs';
import SPRITES from '../../jam/sprites.json';

const W = 1080, H = 1920;
const MONO = 'Menlo, "SF Mono", "Courier New", monospace';
const OUTLINE: React.CSSProperties = { fontFamily: MONO, fontWeight: 800, WebkitTextStroke: '10px #0b0716', paintOrder: 'stroke fill', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap' };

// --- motion vocabulary (same as src/byear/ByEar.tsx) ----------------------------------------------------------------------------------
const kick = (age: number, k = 9) => (age < 0 ? 0 : Math.exp(-age * k));
const wob = (age: number, k = 8, w = 30) => (age < 0 ? 0 : Math.exp(-age * k) * Math.cos(age * w));
const hump = (t: number, a: number, d: number) => { const u = (t - a) / d; return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u); };
const pre = (t: number, a: number, b: number) => (t < a || t >= b ? 0 : easeInOut((t - a) / (b - a)));
const ageOf = (t: number, times: number[]) => { let a = Infinity; for (const x of times) if (t >= x) a = t - x; return a; };
const win = (t: number, a: number, b: number, fi = 0.18, fo = 0.18) => clamp((t - a) / fi) * clamp((b - t) / fo);
const beatIdx = (t: number) => { let k = -1; for (let i = 0; i < BEATS.length; i++) if (t >= BEATS[i]) k = i; return k; };

// --- camera ----------------------------------------------------------------------------------------------------------------------------
type Cam = { t: number; x: number; y: number; s: number };
const CAM: Cam[] = [
  { t: 0, x: 540, y: 1040, s: 1.0 }, { t: T.endHit, x: 540, y: 1060, s: 1.06 },
  { t: T.ask - 0.1, x: 545, y: 1070, s: 1.08 }, { t: T.phone - 0.05, x: 560, y: 1100, s: 1.12 },
  { t: T.phone + 0.35, x: 400, y: 1250, s: 1.75 }, { t: T.try1 - 0.15, x: 410, y: 1250, s: 1.8 },
  { t: T.try1 + 0.1, x: 420, y: 1210, s: 1.42 }, { t: T.freeze - 0.05, x: 430, y: 1200, s: 1.45 },
  { t: T.freeze + 0.4, x: 540, y: 1560, s: 1.75 }, { t: T.listen - 0.2, x: 540, y: 1565, s: 1.9 },           // the bouquet, wilting
  { t: T.listen + 0.3, x: 740, y: 1170, s: 1.5 }, { t: T.join - 0.4, x: 735, y: 1165, s: 1.55 },
  { t: T.join + 0.6, x: 560, y: 1160, s: 1.18 }, { t: T.hit - 0.3, x: 560, y: 1190, s: 1.1 },
  { t: T.hit, x: 560, y: 1200, s: 1.14 }, { t: DURATION, x: 560, y: 1180, s: 1.2 },
];
function camAt(t: number) {
  let i = 0;
  while (i < CAM.length - 2 && t >= CAM[i + 1].t) i++;
  const a = CAM[i], b = CAM[i + 1], u = easeInOut(clamp((t - a.t) / (b.t - a.t)));
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, s: a.s + (b.s - a.s) * u };
}

// --- the band ------------------------------------------------------------------------------------------------------------------------
type Who = 'drummer' | 'guitarist' | 'bassist';
type Pose = 'idle' | 'play' | 'hard' | 'bob' | 'fill' | 'jump';
const POSES: Record<Who, Pose[]> = { drummer: ['idle', 'play', 'hard', 'bob', 'fill'], guitarist: ['idle', 'play', 'hard', 'bob', 'jump'], bassist: ['idle', 'play', 'hard', 'bob', 'jump'] };
const SP = SPRITES as Record<string, { w: number; h: number; cx: number }>;
const SPOT = { drummer: { x: 545, y: 1320, s: 2.45 }, guitarist: { x: 290, y: 1600, s: 2.8 }, bassist: { x: 805, y: 1600, s: 2.8 } };

const Sprite: React.FC<{ who: Who; pose: Pose; x: number; y: number; s: number; flip?: boolean; lean?: number; sx?: number; sy?: number; filter?: string }> =
  ({ who, pose, x, y, s, flip, lean = 0, sx = 1, sy = 1, filter }) => (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `rotate(${lean}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`, transformOrigin: '0 0', filter }}>
      {POSES[who].map((p) => {
        const m = SP[`${who}_${p}`];
        return <Img key={p} src={staticFile(`band/${who}_${p}.png`)} style={{ position: 'absolute', left: -m.cx * s, top: -m.h * s, width: m.w * s, height: m.h * s, imageRendering: 'pixelated', visibility: p === pose ? 'visible' : 'hidden' }} />;
      })}
    </div>
  );

// --- one look for everyone: vector art is rasterised small and scaled up with hard edges, with a limited palette, like the band's pixel sprites -----
const P = 4;   // one "pixel" = 4 world px (the band sprites are about the same size on screen)
const PixelLayer: React.FC<{ left: number; top: number; vbx: number; vby: number; w: number; h: number; lv?: number; p?: number; children: React.ReactNode }> = ({ left, top, vbx, vby, w, h, lv = 9, p = P, children }) => {
  const holder = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const handle = delayRender('pixel layer');
    const svg = holder.current?.firstElementChild, canvas = cv.current;
    const done = () => continueRender(handle);
    if (!svg || !canvas) { done(); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height), a = d.data, q = 255 / (lv - 1);
        for (let i = 0; i < a.length; i += 4) {
          a[i + 3] = a[i + 3] < 40 ? 0 : a[i + 3] > 215 ? 255 : a[i + 3];
          a[i] = Math.round(a[i] / q) * q; a[i + 1] = Math.round(a[i + 1] / q) * q; a[i + 2] = Math.round(a[i + 2] / q) * q;
        }
        ctx.putImageData(d, 0, 0);
      } finally { done(); }
    };
    img.onerror = done;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  });
  return (
    <>
      <div ref={holder} style={{ display: 'none' }}><svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`${vbx} ${vby} ${w} ${h}`}>{children}</svg></div>
      <canvas ref={cv} width={Math.round(w / p)} height={Math.round(h / p)} style={{ position: 'absolute', left, top, width: w, height: h, imageRendering: 'pixelated' }} />
    </>
  );
};

// --- the wedding hall ----------------------------------------------------------------------------------------------------------------
// Ivory panelled walls with gold moulding, two arched windows onto a night sky with rose drapes, three swaying crystal chandeliers, a floral
// arch behind the drummer under a gold "MR & MRS" sign, a parquet stage with a draped front, a red runner, and the guests (seen from behind,
// each with their own hair, clothes and rhythm; one films the whole thing on a phone).
const HAIR = ['#2a1a14', '#5a3a2a', '#d9b36a', '#8a5a3a', '#1b1b22', '#b9b9c4', '#7a3a2a'];
const CLOTH = ['#26294d', '#3a3a44', '#1d3a4a', '#6b2d3e', '#3d5a49', '#7a5a8a', '#b8606f', '#2f2f3a'];
const SKINS = ['#f2cfae', '#e0b08a', '#c68b62', '#8d5a3b'];
type Guest = { x: number; y: number; s: number; ph: number; arm: boolean; hair: string; cloth: string; skin: string; dress: boolean; hat: boolean; phone: boolean; row: number };
const GUESTS: Guest[] = (() => {
  const r = rng(21), out: Guest[] = [];
  const mk = (row: number, x: number, y: number, s: number, i: number): Guest => ({ row, x, y, s, ph: r() * 6.28, arm: r() < 0.55, hair: HAIR[Math.floor(r() * HAIR.length)], cloth: CLOTH[Math.floor(r() * CLOTH.length)], skin: SKINS[Math.floor(r() * SKINS.length)], dress: r() < 0.5, hat: r() < 0.3, phone: row === 0 && i === 9 });
  for (let i = 0; i < 10; i++) out.push(mk(1, 20 + i * 112 + r() * 26, 1930 + r() * 18, 0.78 + r() * 0.1, i));
  for (let i = 0; i < 13; i++) out.push(mk(0, -24 + i * 92 + r() * 26, 2060 + r() * 30, 1.02 + r() * 0.26, i));
  return out;
})();
const ARCH = (() => {
  const r = rng(5), out: { x: number; y: number; r: number; c: string; leaf: boolean; rot: number }[] = [];
  const cx = 540, cy = 1020, rx = 300, ry = 430, cols = ['#ffffff', '#ffd9e6', '#ffb3cf', '#f4efe6', '#e8c9ff'];
  for (let i = 0; i < 80; i++) {
    const th = Math.PI * (0.96 + 1.08 * (i / 79)), x = cx + rx * Math.cos(th) + (r() - 0.5) * 30, y = cy + ry * Math.sin(th) + (r() - 0.5) * 30;
    out.push({ x, y, r: 15 + r() * 16, c: cols[Math.floor(r() * cols.length)], leaf: i % 3 === 0, rot: Math.atan2(ry * Math.cos(th), -rx * Math.sin(th)) * 57.3 + (r() - 0.5) * 40 });
  }
  for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) out.push({ x: cx + sd * rx + (r() - 0.5) * 24, y: cy + 30 + i * 38, r: 14 + r() * 12, c: cols[Math.floor(r() * cols.length)], leaf: i % 3 === 1, rot: 90 + (r() - 0.5) * 40 });
  return out;
})();
const STARS = Array.from({ length: 16 }, (_, i) => ({ x: ((i * 53) % 120) - 60, y: 520 + ((i * 97) % 420), r: 1.6 + (i % 3) * 0.7 }));

const Chandelier: React.FC<{ x: number; y: number; s: number; t: number; ph: number; lit: number }> = ({ x, y, s, t, ph, lit }) => {
  const sway = 1.4 * Math.sin(t * 0.9 + ph);
  return (
    <g transform={`translate(${x} ${y}) rotate(${sway} 0 -900) scale(${s})`}>
      <line x1={0} y1={-900} x2={0} y2={-30} stroke="#8a7a5a" strokeWidth={6} />
      <circle cx={0} cy={0} r={170} fill="url(#hGlow)" opacity={0.9 * lit} />
      <ellipse cx={0} cy={0} rx={16} ry={26} fill="#d8b45a" stroke="#7a5f22" strokeWidth={3} />
      {[-2, -1, 1, 2].map((k) => <g key={k}>
        <path d={`M 0 8 Q ${k * 46} 52 ${k * 96} 4`} stroke="#d8b45a" strokeWidth={7} fill="none" strokeLinecap="round" />
        <rect x={k * 96 - 6} y={-22} width={12} height={26} rx={3} fill="#fff6e0" stroke="#7a5f22" strokeWidth={2} />
        <ellipse cx={k * 96} cy={-34} rx={9} ry={14} fill="#ffe9a8" opacity={0.7 + 0.3 * lit * Math.sin(t * 17 + k)} />
        <circle cx={k * 96} cy={-34} r={30} fill="#ffd27a" opacity={0.22 * lit} />
      </g>)}
      {Array.from({ length: 9 }, (_, i) => { const cxx = -112 + i * 28, cyy = 34 + 22 * Math.abs(Math.sin(i * 0.9)), tw = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.7 + ph);
        return <g key={i}><line x1={cxx} y1={20} x2={cxx} y2={cyy} stroke="#e8e0cc" strokeWidth={2} /><polygon points={`${cxx},${cyy} ${cxx - 7},${cyy + 14} ${cxx},${cyy + 30} ${cxx + 7},${cyy + 14}`} fill="#fff" opacity={0.5 + 0.5 * tw} stroke="#c9d6e8" strokeWidth={1.5} /></g>; })}
    </g>
  );
};

const Guests: React.FC<{ t: number; energy: number; clapAge: number; bi: number }> = ({ t, energy, clapAge, bi }) => (
  <PixelLayer left={-40} top={1700} vbx={-40} vby={1700} w={1160} h={900} lv={14}>
    {GUESTS.map((g, i) => {
      const bob = (energy * 20 + 3) * (bi >= 0 ? kick(t - BEATS[bi] - (i % 3) * 0.03, 8) : 0) + 3 * Math.sin(t * 1.9 + g.ph);
      const up = energy > 0.55 && g.arm ? clamp((energy - 0.55) / 0.2) : 0, cl = 18 * kick(clapAge, 14), turn = 5 * Math.sin(t * 0.8 + g.ph);
      const filming = g.phone && t >= T.lick - 0.5 && t < T.card;
      const sleeve = g.cloth, skin = g.skin;
      return (
        <g key={i} transform={`translate(${g.x} ${g.y - bob}) scale(${g.s})`} style={{ filter: g.row ? 'brightness(0.78)' : undefined }}>
          {/* raised arms: clapping above the head, or one hand holding up a phone */}
          {up > 0 && !filming ? <>
            <rect x={-88 + cl * 0.6} y={-130 * up} width={24} height={130 * up + 50} rx={12} fill={sleeve} stroke="#0b0716" strokeWidth={3} /><circle cx={-76 + cl * 0.6} cy={-130 * up - 6} r={15} fill={skin} />
            <rect x={64 - cl * 0.6} y={-130 * up} width={24} height={130 * up + 50} rx={12} fill={sleeve} stroke="#0b0716" strokeWidth={3} /><circle cx={76 - cl * 0.6} cy={-130 * up - 6} r={15} fill={skin} />
          </> : null}
          {filming ? <>
            <rect x={60} y={-230} width={24} height={280} rx={12} fill={sleeve} stroke="#0b0716" strokeWidth={3} />
            <g transform="translate(74 -250) rotate(-6)"><rect x={-30} y={-62} width={60} height={112} rx={10} fill="#16121f" stroke="#6b5f86" strokeWidth={4} /><circle cx={-14} cy={-48} r={5} fill="#3a4a8a" /><rect x={-34} y={-62} width={6} height={112} fill="#8ee8ff" opacity={0.35 + 0.2 * Math.sin(t * 6)} /></g>
          </> : null}
          {/* back: jacket or dress, seam, collar, neck */}
          <path d="M -88 320 L -94 96 Q -92 40 -40 34 L 40 34 Q 92 40 94 96 L 88 320 Z" fill={sleeve} stroke="#0b0716" strokeWidth={3} />
          <line x1={0} y1={56} x2={0} y2={320} stroke="rgba(0,0,0,0.3)" strokeWidth={3} />
          <rect x={-18} y={-4} width={36} height={42} fill={skin} />
          {g.dress ? <path d="M -60 34 Q 0 118 60 34 Z" fill={skin} /> : <path d="M -26 30 L 0 62 L 26 30 Z" fill="#f2efe8" />}
          <circle cx={-47} cy={-18} r={11} fill={skin} /><circle cx={47} cy={-18} r={11} fill={skin} />
          <g transform={`translate(${turn} 0)`}>
            <ellipse cx={0} cy={-26} rx={47} ry={53} fill={g.hair} stroke="#0b0716" strokeWidth={3} />
            <path d="M -30 -58 Q 0 -78 30 -58" stroke="rgba(255,255,255,0.35)" strokeWidth={5} fill="none" strokeLinecap="round" />
            {g.dress ? <><circle cx={0} cy={-84} r={26} fill={g.hair} stroke="#0b0716" strokeWidth={3} /><circle cx={12} cy={-96} r={9} fill="#ffc7dd" /></> : null}
            {g.hat ? <><ellipse cx={0} cy={-62} rx={86} ry={15} fill="#f4efff" stroke="#0b0716" strokeWidth={3} /><path d="M -42 -64 Q 0 -122 42 -64 Z" fill="#f4efff" stroke="#0b0716" strokeWidth={3} /><rect x={-42} y={-76} width={84} height={10} fill="#ff9ac2" /></> : null}
          </g>
        </g>
      );
    })}
  </PixelLayer>
);

const Room: React.FC<{ t: number; mood: number; warm: number; energy: number; strobe: number; zoom: number; clapAge: number; sign: number }> = ({ t, mood, warm, energy, strobe, zoom, clapAge, sign }) => {
  const bi = beatIdx(t), onBeat = bi >= 0 ? kick(t - BEATS[bi], 7) : 0;
  const wide = clamp((1.22 - zoom) / 0.12);
  const signO = (0.85 + 0.15 * Math.sin(t * 7) * Math.sin(t * 2.3) + 0.12 * onBeat) * wide * sign;
  const lit = 0.7 + 0.3 * mood;
  const swags = Array.from({ length: 7 }, (_, k) => -240 + k * 240);
  return (
    <PixelLayer left={-40} top={0} vbx={-40} vby={0} w={1160} h={2200} lv={14}>
      <defs>
        <linearGradient id="hWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3e8d3" /><stop offset="1" stopColor="#dcc7a2" /></linearGradient>
        <linearGradient id="hSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a2354" /><stop offset="1" stopColor="#4a4f8c" /></linearGradient>
        <radialGradient id="hGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#ffe9b0" stopOpacity="0.8" /><stop offset="1" stopColor="#ffe9b0" stopOpacity="0" /></radialGradient>
        <linearGradient id="hFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#1a0f10" stopOpacity="0.7" /></linearGradient>
        <linearGradient id="hBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2cc" stopOpacity="0.32" /><stop offset="1" stopColor="#fff2cc" stopOpacity="0" /></linearGradient>
        <linearGradient id="bW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd27a" stopOpacity="0.55" /><stop offset="1" stopColor="#ffd27a" stopOpacity="0" /></linearGradient>
        <radialGradient id="bVig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.6" stopColor="#1a0f20" stopOpacity="0" /><stop offset="1" stopColor="#1a0f20" stopOpacity="0.6" /></radialGradient>
        <pattern id="parq" width="140" height="70" patternUnits="userSpaceOnUse"><rect width="140" height="70" fill="#b5834f" /><rect width="70" height="35" fill="#a87647" /><rect x={70} y={35} width="70" height="35" fill="#a87647" /><path d="M 0 0 H 140 M 0 35 H 140 M 70 0 V 70 M 0 0 V 70" stroke="#7a5430" strokeWidth={2} /></pattern>
      </defs>
      {/* wall: ivory damask, wainscot, gold moulding */}
      <rect x={-400} y={-400} width={W + 800} height={1760} fill="url(#hWall)" />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={-400 + i * 120} y={-400} width={46} height={1500} fill="#c9ae82" opacity={0.12} />)}
      <rect x={-400} y={1090} width={W + 800} height={270} fill="#cdb48a" />
      <rect x={-400} y={1082} width={W + 800} height={12} fill="#d8b45a" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={-300 + i * 220} y={1124} width={170} height={190} fill="none" stroke="#e3cf9f" strokeWidth={5} />)}
      {/* arched windows onto the night, rose drapes */}
      {[150, 930].map((wx) => <g key={wx}>
        <path d={`M ${wx - 75} 1060 L ${wx - 75} 500 A 75 75 0 0 1 ${wx + 75} 500 L ${wx + 75} 1060 Z`} fill="url(#hSky)" stroke="#f6ecd6" strokeWidth={10} />
        {STARS.map((st, i) => <circle key={i} cx={wx + st.x} cy={st.y} r={st.r} fill="#fff" opacity={0.5 + 0.5 * Math.sin(t * 2 + i * 1.3)} />)}
        <circle cx={wx + 28} cy={640} r={24} fill="#fff6d8" opacity={0.9} /><circle cx={wx + 38} cy={632} r={21} fill="#2a3470" />
        <path d={`M ${wx} 425 V 1060 M ${wx - 75} 700 H ${wx + 75} M ${wx - 75} 880 H ${wx + 75}`} stroke="#f6ecd6" strokeWidth={6} />
        {[-1, 1].map((sd) => <g key={sd} transform={`translate(${wx + sd * 112} 0)`}>
          <path d={`M -34 392 L 34 392 L ${34 + sd * 4 + 4 * Math.sin(t * 0.8 + sd)} 1090 L -34 1090 Z`} fill="#b5707f" stroke="#7a3a4a" strokeWidth={3} />
          {[-16, 0, 16].map((fx) => <line key={fx} x1={fx} y1={400} x2={fx} y2={1084} stroke="#8e4a5a" strokeWidth={3} opacity={0.7} />)}
          <rect x={-38} y={800} width={76} height={14} rx={7} fill="#d8b45a" />
        </g>)}
        <rect x={wx - 160} y={380} width={320} height={22} rx={10} fill="#d8b45a" />
      </g>)}
      {/* string lights */}
      <path d="M -20 300 Q 540 400 1100 300" stroke="#8a7a5a" strokeWidth={4} fill="none" />
      {Array.from({ length: 15 }, (_, i) => { const x = 20 + i * 72, y = 300 + 100 * (1 - Math.pow((x - 540) / 560, 2)) + 18, tw = 0.65 + 0.35 * Math.sin(t * 3 + i * 1.9) + 0.25 * onBeat;
        return <g key={i}><circle cx={x} cy={y + 6} r={24} fill="#ffd27a" opacity={0.2 * tw} /><circle cx={x} cy={y + 6} r={10} fill="#fff1c0" opacity={0.6 + 0.4 * tw} /></g>; })}
      {/* chandeliers (centre one behind the sign) */}
      <Chandelier x={180} y={380} s={0.8} t={t} ph={0} lit={lit} /><Chandelier x={900} y={380} s={0.8} t={t} ph={2.1} lit={lit} />
      {/* floral arch + gold sign */}
      <path d="M 240 1340 V 1020 A 300 430 0 0 1 840 1020 V 1340" stroke="#d8c9a8" strokeWidth={14} fill="none" />
      {ARCH.map((f, i) => <g key={i} transform={`translate(${f.x + 2 * Math.sin(t * 1.5 + i)} ${f.y}) rotate(${f.rot})`}>
        {f.leaf ? <ellipse cx={0} cy={0} rx={34} ry={12} fill={i % 2 ? '#5f8a5a' : '#7aa36b'} stroke="#3f5f3a" strokeWidth={2} /> : <><circle cx={0} cy={0} r={f.r} fill={f.c} stroke="#c9a8b8" strokeWidth={2} /><circle cx={0} cy={0} r={f.r * 0.35} fill="#ffe9a8" /></>}
      </g>)}
      <g opacity={signO}>
        <line x1={420} y1={300} x2={430} y2={452} stroke="#8a7a5a" strokeWidth={4} /><line x1={660} y1={300} x2={650} y2={452} stroke="#8a7a5a" strokeWidth={4} />
        <rect x={300} y={452} width={480} height={94} rx={14} fill="#fff8e8" stroke="#d8b45a" strokeWidth={8} style={{ filter: 'drop-shadow(0 0 16px #ffd27a)' }} />
        <text x={540} y={522} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={62} fill="#c99a2e" style={{ filter: 'drop-shadow(0 0 8px #ffd27a)' }}>MR &amp; MRS</text>
      </g>
      {/* amps, dressed for the occasion */}
      <rect x={40} y={1180} width={190} height={170} fill="#2a2430" stroke="#d8b45a" strokeWidth={5} /><rect x={58} y={1200} width={154} height={22} fill="#d8b45a" />
      <rect x={850} y={1110} width={210} height={250} fill="#2a2430" stroke="#d8b45a" strokeWidth={5} />
      {[0, 1].map((k) => <circle key={k} cx={955} cy={1180 + k * 110} r={44 + 3 * onBeat} fill="#15111c" stroke="#4a4258" strokeWidth={6} />)}
      {/* stage: parquet, drum riser, draped front */}
      <rect x={-400} y={1340} width={W + 800} height={320} fill="url(#parq)" />
      <rect x={-400} y={1340} width={W + 800} height={320} fill="#fff2dc" opacity={0.12} />
      <rect x={330} y={1250} width={420} height={90} fill="#8a5a34" stroke="#d8b45a" strokeWidth={6} />
      <rect x={-400} y={1650} width={W + 800} height={16} fill="#d8b45a" />
      {swags.map((x, k) => <g key={k}>
        <path d={`M ${x} 1664 Q ${x + 120} ${1740 + 6 * Math.sin(t * 1.3 + k)} ${x + 240} 1664 Z`} fill="#fffaf0" stroke="#d8c9a8" strokeWidth={3} />
        <path d={`M ${x + 60} 1668 Q ${x + 120} 1716 ${x + 180} 1668`} stroke="#e8dcc0" strokeWidth={3} fill="none" />
        <circle cx={x} cy={1668} r={20} fill="#ffb3cf" stroke="#c9a8b8" strokeWidth={2} /><circle cx={x - 12} cy={1676} r={12} fill="#fff" /><circle cx={x + 12} cy={1676} r={12} fill="#ffd9e6" />
      </g>)}
      {/* hall floor + red runner */}
      <rect x={-400} y={1664} width={W + 800} height={560} fill="url(#parq)" />
      <rect x={-400} y={1664} width={W + 800} height={560} fill="url(#hFloor)" />
      <polygon points="430,1664 650,1664 780,2200 300,2200" fill="#8e2c3c" stroke="#d8b45a" strokeWidth={6} />
      <polygon points="470,1664 610,1664 700,2200 380,2200" fill="none" stroke="#c9a05a" strokeWidth={3} opacity={0.7} />
      {/* light: chandelier shafts, a warm spot on the bassist from the moment she listens, a dimmer when the room goes cold */}
      {[180, 540, 900].map((x, i) => { const sway = Math.sin(t * 1.1 + i * 2.1) * 60;
        return <polygon key={i} points={`${x - 26},300 ${x + 26},300 ${x + 260 + sway},1660 ${x - 260 + sway},1660`} fill="url(#hBeam)" opacity={(0.5 + 0.5 * onBeat) * mood} style={{ mixBlendMode: 'screen' }} />; })}
      <polygon points="780,-40 840,-40 1060,1640 600,1640" fill="url(#bW)" opacity={warm} style={{ mixBlendMode: 'screen' }} />
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#0c1038" opacity={(1 - mood) * 0.9} />
      {strobe > 0 ? <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="#fff6e0" opacity={strobe} /> : null}
      <rect x={-400} y={-400} width={W + 800} height={H + 800} fill="url(#bVig)" />
    </PixelLayer>
  );
};

// --- the newlyweds: a jointed rig each (shoulder → elbow → hand, hip legs, head with eyes that look, blink and brow/mouth moods, hair, veil, hem) ---
// Walk in waving → wait (he checks his watch, hand on hip; she taps her foot, the bouquet wilts) → wince at each wrong note → look at the bassist
// → sway, nod to her notes and clap on 2 and 4 → leap, cheer and throw petals on the reprise, hearts. Everything is a function of `t`.
const INK = '#2a1a22', SKIN = '#f2cfae', SKIN_D = '#d9a985';
const NOD_T = LEAD.map((n) => n.t);
type Mood = 'happy' | 'impatient' | 'wince' | 'joy' | 'listen';
type Key = [number, number, number];   // time, upper-arm angle (° outward from hanging), forearm bend (° further outward/up; negative = in toward the body)
const poseAt = (t: number, keys: Key[]): [number, number] => {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b[0]) { const u = easeInOut(clamp((t - a[0]) / (b[0] - a[0]))); return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
  }
  const l = keys[keys.length - 1]; return [l[1], l[2]];
};
const WAVE_END = T.couple + 0.95;
const G_R: Key[] = [[T.couple, 105, 80], [WAVE_END, 105, 80], [WAVE_END + 0.3, 7, -6], [T.try1, 7, -6], [T.try1 + 0.4, 28, -112], [T.listen + 0.1, 28, -112], [T.listen + 0.6, 7, -6],
  [T.join - 0.2, 7, -6], [T.join + 0.1, 14, -98], [T.hit - 0.25, 14, -98], [T.hit + 0.05, 150, 15], [T.hit + 1.6, 150, 15], [T.hit + 2.1, 7, -6]];
const G_L: Key[] = [[T.couple, 8, -6], [T.try1, 8, -6], [T.try1 + 0.5, 38, -98], [T.listen + 0.1, 38, -98], [T.listen + 0.6, 7, -6],
  [T.join - 0.2, 7, -6], [T.join + 0.1, 14, -98], [T.hit - 0.25, 14, -98], [T.hit + 0.05, 150, 15], [T.hit + 1.6, 150, 15], [T.hit + 2.1, 7, -6]];
const B_R: Key[] = [[T.couple, 28, -70], [T.hit - 0.25, 28, -70], [T.hit + 0.1, 160, 10], [T.hit + 1.6, 160, 10], [T.hit + 2.1, 28, -70]];   // the bouquet arm
const B_L: Key[] = [[T.couple, 105, 80], [WAVE_END, 105, 80], [WAVE_END + 0.3, 7, -6], [T.try1 + 0.5, 7, -6], [T.try1 + 0.9, 38, -98], [T.listen + 0.1, 38, -98], [T.listen + 0.6, 7, -6],
  [T.hit - 0.25, 7, -6], [T.hit + 0.05, 150, 15], [T.hit + 1.6, 150, 15], [T.hit + 2.1, 7, -6]];

/** One arm of a person drawn for the screen-right side (mirror it with scale(-1 1) for the left): `up` swings it out, `fo` bends the elbow outward/up. */
const Arm: React.FC<{ up: number; fo: number; sleeve: string; cuff?: string; watch?: boolean; r?: number; len?: [number, number]; children?: React.ReactNode }> = ({ up, fo, sleeve, cuff, watch, r = 12, len = [70, 64], children }) => (
  <g transform={`rotate(${-up})`}>
    <rect x={-r} y={-r} width={2 * r} height={len[0] + r} rx={r} fill={sleeve} stroke={INK} strokeWidth={4} />
    <g transform={`translate(0 ${len[0]}) rotate(${-fo})`}>
      <rect x={-r * 0.9} y={-r * 0.6} width={r * 1.8} height={len[1] + r * 0.6} rx={r * 0.9} fill={sleeve} stroke={INK} strokeWidth={4} />
      {cuff ? <rect x={-r} y={len[1] - 16} width={2 * r} height={16} rx={4} fill={cuff} stroke={INK} strokeWidth={3} /> : null}
      {watch ? <><rect x={-r - 1} y={len[1] - 30} width={2 * r + 2} height={12} rx={3} fill="#c9a05a" stroke={INK} strokeWidth={2.5} /><circle cx={0} cy={len[1] - 24} r={8} fill="#fff6d8" stroke={INK} strokeWidth={2.5} /></> : null}
      <circle cx={0} cy={len[1] + 9} r={r * 1.05} fill="url(#cSkin)" stroke={INK} strokeWidth={3.5} />
      <g transform={`translate(0 ${len[1] + 9}) rotate(${up + fo})`}>{children}</g>
    </g>
  </g>
);

const Face: React.FC<{ mood: Mood; lx: number; ly: number; blink: number; blush?: number; brow?: string }> = ({ mood, lx, ly, blink, blush = 0, brow = '#3b2418' }) => {
  const open = mood === 'wince' ? 0.25 : 1 - 0.93 * blink, ry = (mood === 'impatient' ? 7.5 : 11) * open;
  const bro = (sd: number) => {
    const o = mood === 'joy' ? -9 : mood === 'wince' ? -3 : mood === 'impatient' ? 3 : mood === 'listen' && sd > 0 ? -8 : 0;
    const inner = mood === 'impatient' ? 11 : mood === 'wince' ? -10 : mood === 'joy' ? -8 : 0;
    return `M ${sd * 31} ${-24 + o} Q ${sd * 20} ${-31 + o - (mood === 'wince' ? 3 : 0)} ${sd * 8} ${-24 + o + inner}`;
  };
  const mouth = mood === 'happy' ? <path d="M -15 19 Q 0 32 15 19" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    : mood === 'listen' ? <path d="M -9 23 Q 0 29 9 23" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    : mood === 'impatient' ? <path d="M -13 27 Q 0 20 13 27" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    : mood === 'wince' ? <path d="M -17 25 L -9 20 L 0 26 L 9 20 L 17 25" stroke={INK} strokeWidth={4} fill="none" strokeLinejoin="round" />
    : <><path d="M -20 14 Q 0 50 20 14 Z" fill="#7a1f2e" stroke={INK} strokeWidth={4} strokeLinejoin="round" /><path d="M -17 15 Q 0 22 17 15 L 15 21 Q 0 27 -15 21 Z" fill="#fff" /><ellipse cx={0} cy={33} rx={9} ry={5} fill="#e5707f" /></>;
  return (
    <g transform={`translate(${lx * 7} ${ly * 3})`}>
      {blush > 0 ? <><ellipse cx={-31} cy={15} rx={11} ry={7} fill="#ff8aa0" opacity={blush} /><ellipse cx={31} cy={15} rx={11} ry={7} fill="#ff8aa0" opacity={blush} /></> : null}
      {[-1, 1].map((sd) => <g key={sd} transform={`translate(${sd * 18} -4)`}>
        {mood === 'joy' ? <path d="M -10 3 Q 0 -10 10 3" stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" /> : <>
          <ellipse cx={0} cy={0} rx={11.5} ry={Math.max(1.2, ry)} fill="#fff" stroke={INK} strokeWidth={2.5} />
          {ry > 3 ? <><circle cx={lx * 4.5} cy={ly * 3} r={Math.min(6.5, ry * 0.9)} fill="#3a2a22" /><circle cx={lx * 4.5 + 2} cy={ly * 3 - 2} r={2} fill="#fff" /></> : null}
          {mood === 'impatient' ? <path d="M -13 -6 Q 0 -9 13 -6 L 13 -1 Q 0 -5 -13 -1 Z" fill={SKIN} stroke={INK} strokeWidth={2} /> : null}
        </>}
      </g>)}
      <path d={bro(-1)} stroke={brow} strokeWidth={5} fill="none" strokeLinecap="round" /><path d={bro(1)} stroke={brow} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M 0 4 Q 5 13 0 15" stroke={SKIN_D} strokeWidth={3} fill="none" strokeLinecap="round" />
      {mouth}
    </g>
  );
};

const Bouquet: React.FC<{ t: number; wilt: number; angle: number }> = ({ t, wilt, angle }) => {
  const c = (col: string) => (wilt > 0.7 ? '#9a8070' : wilt > 0.35 ? '#c4a8a0' : col);
  const flowers = [[0, -20, '#ff9ac2'], [-24, -4, '#f4efff'], [24, -6, '#ffc7dd'], [-10, 16, '#f4efff'], [14, 14, '#ff9ac2'], [-30, 20, '#ffc7dd'], [30, 18, '#fff']] as const;
  return (
    <g transform={`rotate(${angle + 105 * wilt + 5 * Math.sin(t * 3)})`}>
      <line x1={0} y1={14} x2={0} y2={-66} stroke="#3f8f5a" strokeWidth={9} strokeLinecap="round" />
      <path d="M -10 -10 L 10 -10 L 6 -48 L -6 -48 Z" fill="#fff" stroke={INK} strokeWidth={3} /><rect x={-11} y={-34} width={22} height={7} fill="#ff9ac2" />
      <g transform="translate(0 -88)">
        {[-50, -25, 25, 50].map((a, i) => <ellipse key={i} cx={Math.sin(a * 0.0175) * 46} cy={-Math.cos(a * 0.0175) * 30 + 10} rx={16} ry={9} fill={wilt > 0.5 ? '#6f8a5a' : '#4f9a63'} stroke={INK} strokeWidth={2} transform={`rotate(${a} ${Math.sin(a * 0.0175) * 46} ${-Math.cos(a * 0.0175) * 30 + 10})`} />)}
        {flowers.map(([fx, fy, col], i) => <circle key={i} cx={fx} cy={fy + 12 * wilt * (i % 2)} r={17 - 4 * wilt} fill={c(col)} stroke={INK} strokeWidth={3} />)}
        {flowers.map(([fx, fy], i) => <circle key={`c${i}`} cx={fx} cy={fy + 12 * wilt * (i % 2)} r={4} fill={wilt > 0.5 ? '#6a5a40' : '#ffe9a8'} />)}
      </g>
    </g>
  );
};

const PETALS = Array.from({ length: 22 }, (_, j) => ({ vx: -460 + (j * 53) % 920, vy: -540 - ((j * 97) % 420), rot: (j * 137) % 360, c: ['#ffc7dd', '#ff9ac2', '#f4efff', '#ffe9a8'][j % 4] }));
const Couple: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.couple - 0.05) return null;
  const inU = clamp((t - T.couple) / 0.75), x = 540 + 780 * (1 - easeOut(inU)), walking = inU < 1;
  const walkPh = (t - T.couple) * 9.5, stepBob = walking ? 12 * Math.abs(Math.sin(walkPh)) : 0, settle = 7 * wob(t - T.couple - 0.75, 7, 22);
  const hitAge = t - T.hit, out = hitAge >= 0;
  const wiltRaw = easeInOut(clamp((t - T.phone) / (T.lick - T.phone)));
  const wilt = out ? wiltRaw * clamp(1 - hitAge / 0.35) : wiltRaw;
  const missAge = ageOf(t, [T.miss1, T.miss2]), nodAge = ageOf(t, NOD_T), clapAge = ageOf(t, CLAPS);
  const marching = t >= T.join - 0.1 && t < T.hit - 0.05;
  const mood: Mood = out ? 'joy' : missAge < 0.5 ? 'wince' : t >= T.try1 && t < T.listen + 0.2 ? 'impatient' : t >= T.listen + 0.2 && t < T.lick + 0.9 ? 'listen' : 'happy';
  const look = (who: 'g' | 'b'): [number, number] => out ? [0, -0.2] : t < T.try1 ? [Math.sin(t * 1.3) * 0.4, 0] : t < T.listen ? [who === 'g' ? -0.9 : -0.6, 0.15] : [0.9, -0.1];
  const blinkOf = (ph: number) => ((t + ph) % 3.3) < 0.13 ? 1 : 0;
  const sway = 2.2 * Math.sin(t * 2.2) + (marching ? 3.2 * Math.sin((t - T.lick) * Math.PI / MB) : 0);
  const ant = clamp((t - (T.hit - 0.4)) / 0.4) * (out ? 0 : 1), air = hump(t, T.hit, 0.55);
  const jump = -60 * air + 14 * ant, sy = 1 - 0.1 * ant + 0.06 * air - 0.08 * wob(hitAge - 0.55, 9, 34) * (hitAge > 0.55 ? 1 : 0), sx = 1 + 0.8 * (1 - sy);
  const beatNod = 5 * kick(nodAge, 10) * (t > T.lick && t < T.hit ? 1 : 0), recoil = 7 * kick(missAge, 9);
  const tap = mood === 'impatient' ? Math.max(0, Math.sin(t * Math.PI * 2 * 3.3)) : 0;
  const watchU = win(t, T.try1 + 0.4, T.listen + 0.1, 0.2, 0.3);
  const waveU = win(t, T.couple, WAVE_END + 0.1, 0.1, 0.25);
  const clapOn = t >= T.join + 0.1 && t < T.hit - 0.25 ? 1 : 0;

  const arm = (keys: Key[], extra = 0, clap = false): [number, number] => { const [u, f] = poseAt(t, keys); return [u, f + extra + (clap && clapOn ? -10 * kick(clapAge, 14) : 0)]; };
  const gR = arm(G_R, 22 * Math.sin(t * 13) * waveU + 4 * Math.sin(t * 18) * watchU, true), gL = arm(G_L, 0, true);
  const bR = poseAt(t, B_R), bL = arm(B_L, 22 * Math.sin(t * 13 + 1) * waveU);
  const legA = walking ? 26 * Math.sin(walkPh) : 1.5 * Math.sin(t * 1.6) + (marching ? 3 * Math.sin((t - T.lick) * Math.PI / MB) : 0);
  const veil = (y: number) => 9 * Math.sin(t * 2.1 - y * 0.012) + (walking ? 28 * (1 - inU) : 0);
  const groomHead = `translate(0 -392) rotate(${(mood === 'impatient' ? -4 : 0) + beatNod * 0.3 - recoil * 0.6 + (marching ? 2 * Math.sin((t - T.lick) * Math.PI / MB) : 0)} 0 44)`;
  const brideHead = `translate(0 -440) rotate(${(mood === 'impatient' ? 5 : 0) + beatNod * 0.3 - recoil * 0.5 + (marching ? -2 * Math.sin((t - T.lick) * Math.PI / MB) : 0)} 0 48)`;
  const [glx, gly] = look('g'), [blx, bly] = look('b');
  const hearts = out && hitAge > 0.35 && hitAge < 2.4 ? [0, 1, 2, 3, 4].map((j) => { const a = hitAge - 0.35 - j * 0.16; if (a < 0 || a > 1.6) return null; const u = a / 1.6;
    return <text key={j} x={-130 + j * 70 + 24 * Math.sin(a * 4 + j)} y={-560 - 320 * u} fontSize={54 + 12 * (j % 2)} textAnchor="middle" fill="#ff4d79" stroke={INK} strokeWidth={2} opacity={1 - u * u}>♥</text>; }) : null;

  return (
    <PixelLayer left={x - 450} top={1790 - 880} vbx={-450} vby={-880} w={900} h={1000} lv={18} p={3}>
      <defs>
        <radialGradient id="cSkin" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stopColor="#fbe0c4" /><stop offset="1" stopColor="#e6b994" /></radialGradient>
        <linearGradient id="cDress" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#f3eefc" /><stop offset="1" stopColor="#d9d0ee" /></linearGradient>
        <linearGradient id="cSuit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#323766" /><stop offset="1" stopColor="#1f2349" /></linearGradient>
      </defs>
      <ellipse cx={0} cy={6} rx={250 - 40 * air} ry={20} fill="#000" opacity={0.35 - 0.15 * air} />
      <g transform={`translate(0 ${jump - stepBob - settle * 0.4}) scale(${sx} ${sy})`}>
        {/* ---------------- groom ---------------- */}
        <g transform={`translate(150 0) rotate(${sway * 0.5} 0 0)`}>
          {[-1, 1].map((sd) => <g key={sd} transform={`translate(${sd * 17} -150) rotate(${sd * legA})`}>
            <rect x={-14} y={-4} width={28} height={146} rx={8} fill="#1b1e3c" stroke={INK} strokeWidth={4} />
            <ellipse cx={sd * 4} cy={146} rx={25} ry={12} fill="#15121c" stroke={INK} strokeWidth={4} /><ellipse cx={sd * 4 - 6} cy={142} rx={9} ry={3} fill="#fff" opacity={0.3} />
          </g>)}
          <rect x={-58} y={-340} width={116} height={208} rx={16} fill="url(#cSuit)" stroke={INK} strokeWidth={5} transform={`scale(1 ${1 + 0.012 * Math.sin(t * 2.3)})`} />
          <path d="M -22 -340 L 22 -340 L 14 -200 L -14 -200 Z" fill="#f6f1ff" stroke={INK} strokeWidth={3} />
          <path d="M -36 -340 L -22 -340 L 0 -262 L -26 -250 Z" fill="#262b57" stroke={INK} strokeWidth={3} /><path d="M 36 -340 L 22 -340 L 0 -262 L 26 -250 Z" fill="#262b57" stroke={INK} strokeWidth={3} />
          <polygon points="-18,-334 -2,-324 -18,-314" fill="#e5484d" stroke={INK} strokeWidth={3} /><polygon points="18,-334 2,-324 18,-314" fill="#e5484d" stroke={INK} strokeWidth={3} /><circle cx={0} cy={-324} r={5} fill="#c0272d" />
          <g transform="translate(30 -296)"><circle cx={0} cy={0} r={9} fill="#ff9ac2" stroke={INK} strokeWidth={2} /><ellipse cx={-10} cy={6} rx={8} ry={4} fill="#4f9a63" /></g>
          <path d="M -44 -276 L -24 -276 L -28 -262 L -44 -262 Z" fill="#fff" stroke={INK} strokeWidth={2} />
          {[-190, -150].map((by) => <circle key={by} cx={0} cy={by} r={4} fill="#c9a05a" stroke={INK} strokeWidth={1.5} />)}
          <rect x={-14} y={-402} width={28} height={34} fill="url(#cSkin)" />
          <g transform="translate(-54 -322) scale(-1 1)"><Arm up={gL[0]} fo={gL[1]} sleeve="#262b57" cuff="#f6f1ff" /></g>
          <g transform="translate(54 -322)"><Arm up={gR[0]} fo={gR[1]} sleeve="#262b57" cuff="#f6f1ff" watch /></g>
          <g transform={groomHead}>
            <circle cx={-50} cy={4} r={11} fill="url(#cSkin)" stroke={INK} strokeWidth={3} /><circle cx={50} cy={4} r={11} fill="url(#cSkin)" stroke={INK} strokeWidth={3} />
            <ellipse cx={0} cy={0} rx={49} ry={52} fill="url(#cSkin)" stroke={INK} strokeWidth={5} />
            <Face mood={mood} lx={glx} ly={gly} blink={blinkOf(0)} brow="#1c1420" />
            <path d="M -52 -6 Q -58 -64 -4 -64 Q 54 -68 54 -8 Q 44 -34 18 -38 Q -12 -46 -52 -6 Z" fill="#1c1420" stroke={INK} strokeWidth={4} />
            <path d="M -22 -60 Q 12 -92 48 -58 Q 18 -62 -22 -60 Z" fill="#2a2030" stroke={INK} strokeWidth={3} />
          </g>
        </g>
        {/* ---------------- bride ---------------- */}
        <g transform={`translate(-105 0) rotate(${-sway * 0.6} 0 0)`}>
          {/* veil (lagging sway) */}
          <path d={`M -22 -470 Q ${-60 + veil(-300)} -300 ${-78 + veil(0)} 20 L ${70 + veil(0)} 20 Q ${60 + veil(-300)} -300 22 -470 Z`} fill="#fff" opacity={0.3} stroke="#e8e0f6" strokeWidth={3} />
          <path d={`M -58 -392 Q ${-62 + veil(-200)} -200 ${-70 + veil(-30)} 10`} stroke="#fff" strokeWidth={3} fill="none" opacity={0.5} strokeDasharray="6 8" />
          {/* gown: bodice, lace band, belt, layered skirt with a swaying hem, a shoe that taps */}
          <path d={`M -44 -300 C -70 -200 -112 -100 ${-124 + 5 * Math.sin(t * 2.4)} 0 Q -60 ${10 + 4 * Math.sin(t * 3)} 0 6 Q 60 ${10 + 4 * Math.sin(t * 3 + 1)} ${124 + 5 * Math.sin(t * 2.4 + 2)} 0 C 112 -100 70 -200 44 -300 Z`} fill="url(#cDress)" stroke={INK} strokeWidth={5} />
          {[-210, -130, -60].map((yy, i) => <path key={i} d={`M ${-50 - i * 22} ${yy} Q 0 ${yy + 22} ${50 + i * 22} ${yy}`} stroke="#cfc6e8" strokeWidth={3} fill="none" />)}
          <ellipse cx={-38} cy={2 - 12 * tap} rx={22} ry={9} fill="#fff" stroke={INK} strokeWidth={3} />
          <path d="M -44 -300 L -46 -372 Q -22 -356 0 -372 Q 22 -356 46 -372 L 44 -300 Z" fill="#fff" stroke={INK} strokeWidth={4} transform={`scale(1 ${1 + 0.012 * Math.sin(t * 2.3 + 1)})`} />
          <rect x={-46} y={-314} width={92} height={16} fill="#f0ddc0" stroke={INK} strokeWidth={3} /><path d="M -40 -306 H 40" stroke="#c9a05a" strokeWidth={3} strokeDasharray="4 5" />
          <path d="M -46 -372 Q -64 -394 -40 -400 L 40 -400 Q 64 -394 46 -372 Q 22 -356 0 -372 Q -22 -356 -46 -372 Z" fill="url(#cSkin)" />
          <rect x={-12} y={-410} width={24} height={26} fill="url(#cSkin)" />
          <g transform="translate(-44 -376) scale(-1 1)"><Arm up={bL[0]} fo={bL[1]} sleeve={SKIN} r={10} len={[70, 62]} /></g>
          <g transform="translate(44 -376)"><Arm up={bR[0]} fo={bR[1]} sleeve={SKIN} r={10} len={[70, 62]}><Bouquet t={t} wilt={wilt} angle={0} /></Arm></g>
          <g transform={brideHead}>
            <ellipse cx={0} cy={-6} rx={58} ry={56} fill="#5a3a2a" stroke={INK} strokeWidth={4} /><circle cx={0} cy={-64} r={27} fill="#5a3a2a" stroke={INK} strokeWidth={4} />
            {[-1, 1].map((sd) => <ellipse key={sd} cx={sd * 53} cy={38} rx={14} ry={42} fill="#5a3a2a" stroke={INK} strokeWidth={3} />)}
            <circle cx={-49} cy={6} r={10} fill="url(#cSkin)" stroke={INK} strokeWidth={3} /><circle cx={49} cy={6} r={10} fill="url(#cSkin)" stroke={INK} strokeWidth={3} />
            <circle cx={-49} cy={20} r={5} fill="#fff" stroke={INK} strokeWidth={1.5} /><circle cx={49} cy={20} r={5} fill="#fff" stroke={INK} strokeWidth={1.5} />
            <ellipse cx={0} cy={4} rx={48} ry={51} fill="url(#cSkin)" stroke={INK} strokeWidth={5} />
            <Face mood={mood} lx={blx} ly={bly} blink={blinkOf(0.9)} blush={mood === 'joy' ? 0.7 : 0.35} brow="#5a3a2a" />
            <path d="M -50 -2 Q -48 -58 0 -58 Q 48 -58 50 -2 Q 36 -38 10 -34 Q -20 -26 -50 -2 Z" fill="#5a3a2a" stroke={INK} strokeWidth={4} />
            <path d="M -26 -54 L -20 -70 L -10 -56 L 0 -76 L 10 -56 L 20 -70 L 26 -54 Z" fill="#e8c46a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <circle cx={0} cy={-70} r={4} fill="#fff" />
          </g>
        </g>
      </g>
      {/* petals on the reprise; a few drop while the bouquet wilts; hearts */}
      {out && hitAge < 2.0 ? PETALS.map((p, j) => { const a = hitAge - (j % 4) * 0.02;
        return a < 0 ? null : <ellipse key={j} cx={-20 + p.vx * a * 0.9} cy={-480 + p.vy * a + 700 * a * a} rx={14} ry={8} fill={p.c} stroke={INK} strokeWidth={2} opacity={1 - a / 2.0} transform={`rotate(${p.rot + a * 280} ${-20 + p.vx * a * 0.9} ${-480 + p.vy * a + 700 * a * a})`} />; }) : null}
      {wilt > 0.45 && !out ? [0, 1, 2].map((j) => { const u = ((t * 0.6 + j * 0.37) % 1); return <ellipse key={j} cx={-60 + 26 * j + 14 * Math.sin(u * 6 + j)} cy={-260 + 260 * u} rx={11} ry={6} fill="#c4a8a0" opacity={1 - u} />; }) : null}
      {hearts}
    </PixelLayer>
  );
};

// --- overlays ------------------------------------------------------------------------------------------------------------------------
const Chip: React.FC<{ children: React.ReactNode; style: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'absolute', fontFamily: MONO, fontWeight: 800, fontSize: 40, color: '#fff', background: 'rgba(11,7,22,0.82)', border: '4px solid #5a3f86', borderRadius: 10, padding: '12px 20px', letterSpacing: 2, ...style }}>{children}</div>
);

const Bubble: React.FC<{ x: number; y: number; text: string[]; t: number; a: number; b: number; tail: 'left' | 'right' }> = ({ x, y, text, t, a, b, tail }) => {
  const o = win(t, a, b, 0.12, 0.15), pop = 1 + 0.18 * wob(t - a, 9, 26);
  if (o <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(${tail === 'right' ? '-100%' : '0'}, -100%) scale(${pop})`, transformOrigin: tail === 'right' ? '100% 100%' : '0 100%', opacity: o }}>
      <div style={{ background: '#fff', color: '#1c1730', fontFamily: MONO, fontWeight: 800, fontSize: 46, lineHeight: 1.2, padding: '18px 24px', borderRadius: 10, boxShadow: '0 0 0 6px #0b0716', whiteSpace: 'nowrap' }}>
        {text.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div style={{ position: 'absolute', bottom: -22, [tail === 'right' ? 'right' : 'left']: 40, width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '24px solid #fff' }} />
    </div>
  );
};

/** His phone: types the search, loads, finds only piano sheet music — and a red 'no guitar tab' banner. */
const Phone: React.FC<{ t: number }> = ({ t }) => {
  const a = T.phone + 0.2, b = T.try1 - 0.1;
  if (t < a - 0.1 || t > b + 0.3) return null;
  const inU = easeOut(clamp((t - a) / 0.35)), outU = clamp((t - b) / 0.25);
  const y = 1920 - (1060 + 40 * wob(t - a - 0.35, 7, 18)) * inU + 1300 * outU * outU;
  const query = 'wedding march guitar tab', typed = query.slice(0, Math.floor(clamp((t - a - 0.15) / 0.35) * query.length));
  const searching = t > a + 0.5 && t < a + 0.72, page = t >= a + 0.72, wall = t >= a + 0.95;
  return (
    <div style={{ position: 'absolute', left: 520, top: y, width: 470, height: 900, background: '#0b0716', borderRadius: 54, padding: 26, boxShadow: '0 0 0 8px #3a2a58, 0 0 80px rgba(142,232,255,0.45)', transform: `rotate(${-6 + 2 * Math.sin(t * 3)}deg)` }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#f4f2fa', borderRadius: 30, padding: '40px 26px', fontFamily: MONO, fontWeight: 700, color: '#1c1730', overflow: 'hidden' }}>
        <div style={{ background: '#e2ddf3', borderRadius: 14, padding: '18px 18px', fontSize: 30 }}>🔍 {typed}<span style={{ opacity: Math.sin(t * 14) > 0 && !page ? 1 : 0 }}>|</span></div>
        {searching ? <div style={{ width: 90, height: 90, margin: '120px auto 0', borderRadius: '50%', border: '12px solid #d8d2ee', borderTopColor: '#8a3a86', transform: `rotate(${t * 720}deg)` }} /> : null}
        {page ? <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 33, lineHeight: 1.2 }}>Wedding March<br /><span style={{ fontSize: 24, color: '#6a5f86' }}>Mendelssohn · <span style={{ color: '#d79b00' }}>★★★★★</span></span></div>
          <div style={{ marginTop: 16, fontSize: 24, background: '#e2ddf3', borderRadius: 10, padding: '8px 12px' }}>🎹 Piano · sheet music</div>
          <svg width={410} height={250} viewBox="0 0 410 250" style={{ marginTop: 14, filter: wall ? 'blur(3px)' : 'none' }}>
            {[0, 1].map((sys) => <g key={sys} transform={`translate(0 ${sys * 120})`}>
              {[0, 1, 2, 3, 4].map((l) => <line key={l} x1={0} y1={30 + l * 12} x2={410} y2={30 + l * 12} stroke="#1c1730" strokeWidth={2} />)}
              {STAFF.slice(sys * 12, sys * 12 + 12).map((st, i) => <g key={i}>
                <ellipse cx={22 + i * 32} cy={30 + st * 6} rx={9} ry={6.5} fill="#1c1730" transform={`rotate(-20 ${22 + i * 32} ${30 + st * 6})`} />
                <line x1={st > 4 ? 22 + i * 32 - 8 : 22 + i * 32 + 8} y1={30 + st * 6} x2={st > 4 ? 22 + i * 32 - 8 : 22 + i * 32 + 8} y2={30 + st * 6 + (st > 4 ? -36 : 36)} stroke="#1c1730" strokeWidth={2.4} />
              </g>)}
            </g>)}
          </svg>
        </div> : null}
        {wall ? <div style={{ position: 'absolute', left: 18, right: 18, top: 380, background: '#fff', borderRadius: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', padding: '26px 22px', textAlign: 'center', transform: `scale(${1 + 0.15 * wob(t - a - 0.95, 9, 26)})` }}>
          <div style={{ fontSize: 70 }}>🎸✕</div>
          <div style={{ fontSize: 33, lineHeight: 1.3, marginTop: 8 }}>No guitar tab<br />for this song</div>
          <div style={{ marginTop: 20, background: '#e5484d', color: '#fff', borderRadius: 14, padding: '14px 10px', fontSize: 26 }}>REQUEST A TAB<br /><span style={{ fontSize: 22 }}>ETA: 5 DAYS</span></div>
        </div> : null}
      </div>
    </div>
  );
};

/** A fretboard: `strings` strings, frets 0–12; `dots` light up. */
const Neck: React.FC<{ strings: number; dots: { s: number; f: number; c: string; o: number }[]; y: number; o: number }> = ({ strings, dots, y, o }) => {
  if (o <= 0) return null;
  const x0 = 70, w = 940, h = 46 * (strings - 1), fx = (f: number) => x0 + (f === 0 ? -18 : ((f - 0.5) / 12) * w);
  return (
    <svg width={W} height={h + 80} style={{ position: 'absolute', left: 0, top: y, opacity: o }}>
      <rect x={x0} y={30} width={w} height={h + 20} rx={8} fill="#2a1d14" stroke="#0b0716" strokeWidth={6} />
      {Array.from({ length: 13 }, (_, f) => <rect key={f} x={x0 + (f / 12) * w - 3} y={30} width={f === 0 ? 10 : 6} height={h + 20} fill={f === 0 ? '#e8e0cc' : '#c9b48a'} />)}
      {[3, 5, 7, 9].map((f) => <circle key={f} cx={fx(f)} cy={40 + h / 2} r={8} fill="#5a4636" />)}
      <circle cx={fx(12)} cy={40 + h / 2 - 30} r={8} fill="#5a4636" /><circle cx={fx(12)} cy={40 + h / 2 + 30} r={8} fill="#5a4636" />
      {Array.from({ length: strings }, (_, s) => <rect key={s} x={x0} y={40 + s * 46 - 2} width={w} height={3 + (strings - 1 - s) * 0.8} fill="#b9b2a6" />)}
      {dots.map((d, i) => d.o > 0 ? <circle key={i} cx={fx(d.f)} cy={40 + (strings - 1 - d.s) * 46} r={20 * (0.7 + 0.3 * d.o)} fill={d.c} stroke="#0b0716" strokeWidth={5} opacity={d.o} /> : null)}
    </svg>
  );
};

// --- the film --------------------------------------------------------------------------------------------------------------------------
const STAFF = [0, 1, 2, 3, 5, 4, 3, 2, 1, 2, 4, 6, 0, 1, 2, 3, 5, 4, 3, 2, 1, 2, 4, 6];   // note heights on the staff (decorative)
const LEAD_T = LEAD.map((n) => n.t);
const MISS_T = [T.miss1, T.miss2];
const TRY_T = TRIES.flatMap((tr) => tr.notes.map(([o]) => tr.t + o));
const DRUM_HITS = [...OPEN_SNARES, ...OPEN_FILL, T.endHit, ...W_KICKS, ...W_SNARES, T.hit];

export const WeddingMarch: React.FC = () => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const bi = beatIdx(t), beatAge = bi >= 0 ? t - BEATS[bi] : Infinity;
  const opening = t < T.endHit, waltz = t >= T.join && t < T.card;
  const grooving = opening || waltz;
  const missAge = ageOf(t, MISS_T), tryAge = ageOf(t, TRY_T), hitAge = t - T.hit, endAge = t - T.endHit, onCard = t >= T.card;
  const clapAge = ageOf(t, CLAPS);

  // the room's mood: the misses kill it, the tune lifts it, the high note blows it up
  const energy = opening ? 0.55 : t < T.ask ? 0.75 - 0.3 * clamp(endAge / 0.5) : t < T.miss1 ? 0.35 : t < T.listen ? 0.08 : t < T.lick ? 0.15 :
    t < T.hit ? 0.3 + 0.5 * clamp((t - T.lick) / 7.4) : 1;
  const warm = win(t, T.listen + 0.2, T.card, 0.5, 0.3) * 0.9;
  const cold = win(t, T.freeze - 0.3, T.listen + 0.3, 0.4, 0.5);
  const strobe = 0.5 * kick(hitAge, 7) * (hitAge >= 0 ? 1 : 0) + 0.25 * kick(endAge, 9) * (endAge >= 0 ? 1 : 0);

  const c = camAt(t);
  const shake = 22 * kick(missAge, 10) + 34 * kick(hitAge, 8) + 14 * kick(endAge, 10);
  const shx = shake * Math.sin(t * 91), shy = shake * Math.cos(t * 77);
  const toScreen = (wx: number, wy: number) => ({ x: W / 2 + (wx - c.x) * c.s + shx, y: H / 2 + (wy - c.y) * c.s + shy });

  // --- drummer: grooves in the opening, rolls, hits; waits with sticks down; a march from bar 3; hits the reprise
  const drumHitAge = ageOf(t, DRUM_HITS);
  const drumPose: Pose = t >= OPEN_FILL[0] && t < T.endHit ? 'fill' : drumHitAge < 0.13 ? 'hard' : grooving ? (bi % 2 ? 'bob' : 'play') : t >= T.hit ? 'bob' : 'idle';
  const dBounce = (grooving ? 10 * kick(beatAge, 9) : 0) + 14 * kick(hitAge, 7) + 3 * Math.sin(t * 1.7);
  const dSy = 1 - (grooving ? 0.03 * kick(beatAge, 12) : 0) - 0.05 * kick(hitAge, 9);

  // --- bassist: grooves in the opening, turns to the guitarist on the ask, listens (idle + tilt), plays the tune (HARD on each note),
  //     crouches before the high note, jumps on it, lands with a dust ring
  const lickAge = ageOf(t, LEAD_T);
  const ant = pre(t, T.hit - 0.45, T.hit), air = hump(t, T.hit, 0.5), land = t - (T.hit + 0.5);
  const bassPose: Pose =
    opening ? (bi % 2 ? 'bob' : 'play') : t >= T.hit && t < T.hit + 0.5 ? 'jump' : t >= T.lick && t < T.card ? (lickAge < 0.16 ? 'hard' : 'play') : 'idle';
  const step = easeInOut(clamp((t - T.listen) / 0.5)) * (1 - easeInOut(clamp((t - T.card + 0.3) / 0.3)));
  const bassX = SPOT.bassist.x - 70 * step, bassY = SPOT.bassist.y + 30 * step;
  const bLean = (opening ? 2.2 * Math.sin(t * Math.PI * 2) : 0) + 6 * pre(t, T.ask - 0.1, T.ask + 0.2) * (1 - clamp((t - T.ask - 1.9) / 0.3))
    + (t >= T.listen && t < T.lick ? 7 * easeOut(clamp((t - T.listen) / 0.25)) : 0) - 4 * kick(lickAge, 10) - 9 * ant + 6 * wob(land, 7, 26)
    + (waltz ? 2.5 * Math.sin((t - T.lick) * Math.PI * 2 / (2 * MB)) : 0);
  const bDy = (grooving ? 8 * kick(beatAge, 10) : 0) + 34 * ant - 380 * air + 3 * Math.sin(t * 2 * Math.PI / 3.6);
  const bSy = 1 - (grooving ? 0.035 * kick(beatAge, 12) : 0) - 0.12 * ant + 0.08 * air - 0.12 * wob(land, 9, 36), bSx = 1 + 0.8 * (1 - bSy);

  // --- guitarist: plays in the opening; leans to the phone; plays each try (HARD + recoil on the sour note); frozen, cold, a sweat drop
  const gPose: Pose = opening ? (bi % 2 ? 'bob' : 'play') : onCard ? 'idle' : tryAge < 0.2 || missAge < 0.45 ? 'hard' : 'idle';
  const toPhone = win(t, T.phone, T.try1 - 0.1, 0.3, 0.2) + win(t, T.hit + 0.1, T.card + 1, 0.3, 0.2);
  const gLean = 1.2 * Math.sin(t * 2 * Math.PI / 3.2) + 5 * toPhone - 8 * wob(missAge, 8, 24) + (t >= T.freeze && t < T.card ? -1.5 : 0) + (opening ? 2 * Math.sin(t * Math.PI * 2) : 0);
  const gDy = 3 * Math.sin(t * 2 * Math.PI / 3.6) + 18 * kick(missAge, 9) + (opening ? 7 * kick(beatAge, 10) : 0) - 10 * pre(t, T.miss1 - 0.25, T.miss1) - 10 * pre(t, T.miss2 - 0.25, T.miss2);
  const gSy = 1 - 0.07 * wob(missAge, 10, 34), gSx = 1 + 0.8 * (1 - gSy);
  const gCold = Math.max(cold, t >= T.listen ? 0.75 : 0);
  const gFilter = `saturate(${1 - 0.65 * gCold}) brightness(${1 - 0.3 * gCold}) hue-rotate(${-14 * gCold}deg)`;

  const bassHead = toScreen(bassX - 40, bassY - 600), gHead = toScreen(SPOT.guitarist.x, SPOT.guitarist.y - 590), gGuitar = toScreen(SPOT.guitarist.x + 130, SPOT.guitarist.y - 280);
  const bassBody = toScreen(bassX - 80, bassY - 330);

  const misses = (t >= T.miss1 ? 1 : 0) + (t >= T.miss2 ? 1 : 0);
  const candleLeft = t >= T.hit ? 1 : 1 - 0.75 * easeInOut(clamp((t - T.phone) / (T.lick - T.phone)));   // the bride's patience

  // flying notes: white on the right notes of the tries, red ✕ on the sour ones, green from the bass, a ring into her head while she listens
  const flyers: React.ReactNode[] = [];
  TRIES.forEach((tr, k) => tr.notes.forEach(([o], j) => { const a = t - tr.t - o; if (j < 2 && a >= 0 && a < 0.8) flyers.push(
    <div key={`t${k}${j}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x - 30 + j * 70, top: gGuitar.y - a * 260, fontSize: 60, color: '#fff', opacity: 1 - a / 0.8, WebkitTextStroke: '7px #0b0716' }}>♪</div>); }));
  MISS_T.forEach((m, k) => { const a = t - m; if (a >= 0 && a < 1.2) [0, 1, 2].forEach((j) => flyers.push(
    <div key={`m${k}${j}`} style={{ ...OUTLINE, position: 'absolute', left: gGuitar.x + (j - 1) * 110 + a * (j - 1) * 120, top: gGuitar.y - a * 320 - j * 30, fontSize: 84, color: '#ff5d5d', opacity: 1 - a / 1.2, WebkitTextStroke: '8px #0b0716' }}>{j === 1 ? '✕' : '♪'}</div>)); });
  LEAD_T.forEach((m, k) => { const a = t - m; if (a >= 0 && a < 1.1) flyers.push(
    <div key={`l${k}`} style={{ ...OUTLINE, position: 'absolute', left: bassBody.x - 60 - a * (k % 2 ? 150 : -60), top: bassBody.y - a * 420, fontSize: 76 + 20 * kick(a, 8), color: '#7cf0a8', opacity: 1 - a / 1.1, WebkitTextStroke: '8px #0b0716' }}>{k % 3 === 2 ? '♫' : '♪'}</div>); });
  if (t >= T.listen && t < T.lick + 0.1) [0, 1, 2, 3].forEach((j) => { const u = clamp((t - T.listen - j * 0.08) / 0.45); if (u > 0 && u < 1) flyers.push(
    <div key={`e${j}`} style={{ ...OUTLINE, position: 'absolute', left: bassHead.x + 300 * (1 - u) * Math.cos(j * 1.7), top: bassHead.y + 40 + 220 * (1 - u) * Math.sin(j * 1.7), fontSize: 64, color: '#8ee8ff', opacity: Math.sin(u * Math.PI), WebkitTextStroke: '7px #0b0716' }}>♪</div>); });

  const neckO = win(t, T.lick - 0.3, T.hit + 2.0, 0.3, 0.3);
  const neckDots = LEAD_POS.map((p, k) => ({ s: p.s, f: p.f, c: '#3fbf7f', o: t >= LEAD_T[k] ? clamp(1 - (t - LEAD_T[k]) / 1.6) * 0.75 + (t - LEAD_T[k] < 0.2 ? 0.25 : 0) : 0 }));

  const h1 = win(t, 0.05, T.endHit + 0.4, 0.12, 0.3), h2 = win(t, 1.3, T.endHit + 0.4, 0.12, 0.3);
  const cardU = easeOut(clamp((t - T.card) / 0.35));

  return (
    <AbsoluteFill style={{ background: '#0b0716', overflow: 'hidden' }}>
      <Audio src={staticFile('wedding.wav')} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${W / 2 + shx}px, ${H / 2 + shy}px) scale(${c.s}) translate(${-c.x}px, ${-c.y}px)`, transformOrigin: '0 0' }}>
        <Room t={t} mood={1 - 0.55 * cold} warm={warm} energy={energy} strobe={strobe} zoom={c.s} clapAge={clapAge} sign={1 - neckO} />
        <Guests t={t} energy={energy} clapAge={clapAge} bi={bi} />
        <Sprite who="drummer" pose={drumPose} x={SPOT.drummer.x} y={SPOT.drummer.y - dBounce * 0.4} s={SPOT.drummer.s} sy={dSy} sx={1 + 0.8 * (1 - dSy)} lean={1.5 * Math.sin(t * 2.1)} />
        <div style={{ position: 'absolute', left: 497, top: 1290, width: 8, height: 330, background: '#3a2a58' }} />
        <div style={{ position: 'absolute', left: 452, top: 1236, width: 96, height: 64, background: '#0b0716', border: '5px solid #3a2a58', borderRadius: 8, boxShadow: `0 0 ${24 + 30 * toPhone}px rgba(142,232,255,${0.35 + 0.4 * toPhone})` }} />
        <Sprite who="guitarist" pose={gPose} x={SPOT.guitarist.x} y={SPOT.guitarist.y + gDy} s={SPOT.guitarist.s} lean={gLean} sx={gSx} sy={gSy} filter={gFilter} />
        <Sprite who="bassist" pose={bassPose} x={bassX} y={bassY + bDy} s={SPOT.bassist.s} flip lean={-bLean} sx={bSx} sy={bSy} />
        {air > 0 ? <div style={{ position: 'absolute', left: bassX - 120 * (1 - 0.4 * air), top: bassY - 14, width: 240 * (1 - 0.4 * air), height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)' }} /> : null}
        {land >= 0 && land < 0.5 ? <div style={{ position: 'absolute', left: bassX - 60 - 300 * easeOut(land / 0.5), top: bassY - 30, width: 120 + 600 * easeOut(land / 0.5), height: 60, borderRadius: '50%', border: '8px solid #ffd27a', opacity: 1 - land / 0.5 }} /> : null}
        {t >= T.freeze + 0.2 && t < T.card ? (() => { const u = ((t - T.freeze - 0.2) % 1.4) / 1.4; return <div style={{ position: 'absolute', left: SPOT.guitarist.x + 55, top: SPOT.guitarist.y - 600 + 120 * u * u, fontSize: 64, opacity: 1 - u }}>💧</div>; })() : null}
        <Couple t={t} />
      </div>

      {flyers}
      {cold > 0 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, transparent 35%, rgba(40,70,140,0.45))', opacity: cold }} /> : null}
      {missAge < 0.35 ? <AbsoluteFill style={{ background: 'radial-gradient(circle at 45% 60%, rgba(229,72,77,0.55), transparent 60%)', opacity: 1 - missAge / 0.35 }} /> : null}

      {/* hook, over a dark band so the balloons and the bunting don't eat it */}
      {h1 > 0 ? <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(11,7,22,0.62) 0%, rgba(11,7,22,0.42) 24%, rgba(11,7,22,0) 38%)', opacity: h1 }} /> : null}
      {h1 > 0 ? <div style={{ position: 'absolute', left: 0, right: 0, top: 230, opacity: h1 }}>
        <div style={{ ...OUTLINE, fontSize: 70, color: '#ffd43b', letterSpacing: 4, transform: `scale(${1 + 0.2 * wob(t - 0.05, 9, 26)})` }}>8 years of guitar.</div>
        {h2 > 0 ? <div style={{ ...OUTLINE, fontSize: 96, color: '#fff', marginTop: 20, lineHeight: 1.05, opacity: h2, transform: `scale(${1 + 0.22 * wob(t - 1.3, 9, 26)})` }}>Can’t play<br /><span style={{ color: '#ff9ac2' }}>Wedding March.</span></div> : null}
      </div> : null}

      {/* chips: the bride's patience; the wrong notes */}
      {t >= T.ask && t < T.hit + 0.3 ? <Chip style={{ right: 50, top: 70, display: 'flex', alignItems: 'center', gap: 14, opacity: win(t, T.ask, T.hit + 0.3, 0.15, 0.3) }}>
        💍<span style={{ fontSize: 30 }}>PATIENCE</span><div style={{ width: 160, height: 24, background: '#0b0716', border: '4px solid #5a3f86' }}><div style={{ width: `${100 * candleLeft}%`, height: '100%', background: candleLeft < 0.55 ? '#ff8a3d' : '#ffd43b' }} /></div>
      </Chip> : null}
      {t >= T.miss1 && t < T.listen ? <Chip style={{ left: 50, top: 70, opacity: win(t, T.miss1, T.listen, 0.1, 0.3) }}>WRONG NOTES: <span style={{ color: '#ff6b6b', display: 'inline-block', transform: `scale(${1 + 0.5 * kick(missAge, 8)})` }}>{misses}</span></Chip> : null}

      {/* dialogue + captions */}
      <Bubble x={bassHead.x} y={bassHead.y} t={t} a={T.ask} b={T.ask + 2.0} text={['PLAY THE', 'WEDDING MARCH!']} tail="right" />
      <Bubble x={gHead.x - 40} y={gHead.y + 30} t={t} a={T.hit + 0.55} b={T.card} text={['…page 1 of 12']} tail="left" />
      {[
        { a: T.phone + 0.55, b: T.try1 - 0.1, text: <>He needed<br />a tab.</>, color: '#8ee8ff' },
        { a: T.freeze + 0.1, b: T.listen, text: <>The couple<br />didn’t wait.</>, color: '#ffffff' },
        { a: T.listen + 0.05, b: T.listen + 2.0, text: <>She didn’t<br /><span style={{ color: '#7cf0a8' }}>need one.</span></>, color: '#ffffff' },
      ].map((cap, i) => { const o = win(t, cap.a, cap.b, 0.12, 0.2); return o > 0 ? <div key={i} style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 250, fontSize: 84, lineHeight: 1.08, color: cap.color, opacity: o, transform: `scale(${1 + 0.18 * wob(t - cap.a, 9, 26)})` }}>{cap.text}</div> : null; })}

      <Neck strings={4} dots={neckDots} y={480} o={neckO} />
      {t >= T.lick - 0.2 && t < T.card ? <div style={{ position: 'absolute', left: 70, top: 430, display: 'flex', alignItems: 'center', gap: 18, opacity: win(t, T.lick - 0.2, T.card, 0.2, 0.2) }}>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 34, color: '#fff', letterSpacing: 3 }}>DANCE FLOOR</div>
        <div style={{ width: 420, height: 26, background: '#0b0716', border: '4px solid #5a3f86' }}><div style={{ width: `${100 * clamp(energy)}%`, height: '100%', background: '#ffd43b' }} /></div>
      </div> : null}

      <Phone t={t} />

      {/* end card: the first line on real frets, played once more */}
      {cardU > 0 ? <AbsoluteFill style={{ background: '#120c2a', transform: `translateY(${(1 - cardU) * H}px)` }}>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 260, fontSize: 112, lineHeight: 1.05, color: '#fff', transform: `scale(${1 + 0.15 * wob(t - T.card - 0.35, 8, 24)})` }}>Play what<br />you <span style={{ color: '#8ee8ff' }}>hear.</span></div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 520, fontSize: 60, color: '#d2cefd', opacity: clamp((t - T.card - 0.6) / 0.2) }}>Not what you read.</div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 660, fontSize: 50, color: '#ffd43b', opacity: clamp((t - T.replay + 0.3) / 0.2) }}>Your turn · first notes</div>
        <Neck strings={6} y={740} o={clamp((t - T.card - 0.4) / 0.25)} dots={REPLAY.map((n) => ({ s: n.s, f: n.f, c: '#3fbf7f', o: t >= n.t ? 0.55 + 0.45 * kick(t - n.t, 5) : 0 }))} />
        <Sprite who="guitarist" pose={Math.floor((t - T.card) / BEAT) % 2 ? 'bob' : 'play'} x={540} y={1560 + 6 * kick((t - T.card) % BEAT, 10)} s={2.0} />
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1630, fontSize: 52, color: '#ffd43b', opacity: clamp((t - T.card - 2.6) / 0.2) }}>Train your ear</div>
        <div style={{ ...OUTLINE, position: 'absolute', left: 0, right: 0, top: 1720, fontSize: 46, color: '#ff9ac2', WebkitTextStroke: '8px #0b0716', opacity: clamp((t - T.card - 2.8) / 0.2) }}>Link in profile · earwarrior.app</div>
      </AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
