// "Can you play this by ear?" — the 3D Mozart cut, 10.5 s, 1080×1920, 120 fps. The bouncing-ball idea of the Spring cut moved into space:
// a near-black ground, a hairline floor grid fading into fog, thin pads that float at the height of their note's pitch, one white ball.
// Still minimal — white on near-black, hairlines and thin type, no colour — but in perspective, with a moving camera. No countdown, no answer.
// A pure function of the frame (the 3D is a hand-rolled pinhole projection into SVG, painter-sorted); every time comes from ../../mozart/story.mjs.
//   0–2 hook, the ball bounces on the floor · 2–5 it leaps pad to pad (each pad appears under it) · 5.1 the camera sweeps round to the side, the
//   pads flash again in order · 6.3 they sink · 6.8 the ball pops, a ring runs over the floor · 6.9–10.5 your turn, a new ball bounces in tempo
import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { POP, SOFT, kick, ramp, springAt, wob, type SpringCfg } from '../ten/motion';
import { clamp, easeOut, lerp, rng } from '../util';
import { FONT, Line, Caps } from '../winter/TenWinter';
import { Hook, Pips } from '../spring/SpringBounce';
import { T, NOTES, END, BEAT, type TimedNote } from '../../mozart/story.mjs';

const C = { bg: '#07040D', ink: '#F4F0FA', top: '#1A1229', side: '#0F0919' };

// --- a pinhole camera -------------------------------------------------------------------------------------------------------------------
type V = [number, number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => mul(a, 1 / Math.hypot(...a));
const mix = (a: V, b: V, k: number): V => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

type Cam = { pos: V; r: V; u: V; f: V };
/** A camera orbiting `target`: `az` round the vertical (0 looks along −z), `el` above the horizon, `dist` away, `roll` banked. */
type Rig = { target: V; az: number; el: number; dist: number; roll: number };
function camera({ target, az, el, dist, roll }: Rig): Cam {
  const pos = add(target, [dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az)]);
  const f = unit(sub(target, pos)), r0 = unit([-f[2], 0, f[0]]), u0 = cross(r0, f);
  const c = Math.cos(roll), s = Math.sin(roll);
  return { pos, f, r: add(mul(r0, c), mul(u0, s)), u: add(mul(u0, c), mul(r0, -s)) };
}
const rigMix = (a: Rig, b: Rig, k: number): Rig => ({ target: mix(a.target, b.target, k), az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), dist: lerp(a.dist, b.dist, k), roll: lerp(a.roll, b.roll, k) });
const FOCAL = 1150, CX = 540, CY = 1030, NEAR = 0.4;
/** World → [screen x, screen y, depth], or null behind the near plane. */
const project = (cam: Cam, p: V): [number, number, number] | null => {
  const v = sub(p, cam.pos), z = dot(v, cam.f);
  return z < NEAR ? null : [CX + (FOCAL * dot(v, cam.r)) / z, CY - (FOCAL * dot(v, cam.u)) / z, z];
};
/** Haze: things fade out with distance, the floor dissolves before the horizon. */
const fog = (depth: number) => Math.pow(clamp(1 - (depth - 4) / 20), 1.4);

// --- the world: x across, y up, z along the tune ----------------------------------------------------------------------------------------
const R = 0.24;                                        // the ball
const SPEED = 2.4;                                     // world units per second of music: the tune is 7.2 long
const PAD = 0.5, THICK = 0.1;                         // half the pad's side; its thickness
const padY = (midi: number) => 0.5 + (midi - 62) * 0.27;          // D4 floats 0.5 above the floor, D5 3.7
const at = (n: TimedNote): V => { const z = (n.t - T.melodyAt) * SPEED; return [1.1 * Math.sin(z * 0.42), padY(n.midi), z]; };   // a gentle S-curve
const HOME: V = [0, 0, -1.7];                          // where the ball waits on the floor during the hook
const LAST = NOTES[NOTES.length - 1];
const IDLE_END = 1.5;
const isBig = (n: TimedNote) => n.beats >= 1;
const MID: V = mix(at(NOTES[0]), at(LAST), 0.5);

type Hop = { t0: number; t1: number; a: V; b: V; h: number };
const HOPS: Hop[] = [
  { t0: T.launch, t1: NOTES[0].t, a: HOME, b: at(NOTES[0]), h: 1.5 },
  ...NOTES.slice(1).map((n, i) => ({ t0: NOTES[i].t, t1: n.t, a: at(NOTES[i]), b: at(n), h: 0.35 + 1.9 * (n.t - NOTES[i].t) })),
];
/** The ball's contact point (its bottom) at time t, before the ending. */
function contact(t: number): V {
  if (t < IDLE_END) return [HOME[0], 0.32 * Math.abs(Math.sin((Math.PI * t) / BEAT)), HOME[2]];   // bounces on the floor in tempo
  if (t < T.launch) return HOME;
  const h = HOPS.find((p) => t >= p.t0 && t < p.t1);
  if (!h) return at(LAST);
  const u = (t - h.t0) / (h.t1 - h.t0), p = mix(h.a, h.b, u);
  return [p[0], p[1] + 4 * h.h * u * (1 - u), p[2]];
}
/** The level the ball travels at (no arcs): what the chasing camera follows, so it never bobs with the bounces. */
function level(t: number): V {
  if (t < T.launch) return HOME;
  const h = HOPS.find((p) => t >= p.t0 && t < p.t1);
  return h ? mix(h.a, h.b, easeOut((t - h.t0) / (h.t1 - h.t0))) : at(LAST);
}
const LANDINGS = [...[0, 1, 2, 3].map((k) => ({ t: k * BEAT, sq: 0.16 })), ...NOTES.map((n) => ({ t: n.t, sq: isBig(n) ? 0.5 : 0.36 }))];

// the ending: the ball lifts off the last pad (a dip first), swells, pops; a new one drops in for the call to action
const LIFT: SpringCfg = { damping: 14, stiffness: 90, mass: 1 };
function ballEnd(t: number): V {
  const p = at(LAST), dip = -0.18 * Math.sin(Math.PI * clamp((t - T.collapse) / 0.18)) * (t < T.collapse + 0.18 ? 1 : 0);
  return [p[0], p[1] + dip + 0.5 * springAt(t, T.collapse + 0.15, LIFT), p[2]];
}
const POP_AT: V = [at(LAST)[0], 0, at(LAST)[2]];
function ctaBall(t: number): V | null {
  const drop = T.comment - 0.45;
  if (t < drop) return null;
  if (t < T.comment) { const u = (t - drop) / 0.45; return [POP_AT[0], 6 * (1 - u * u), POP_AT[2]]; }
  return [POP_AT[0], 0.7 * Math.abs(Math.sin((Math.PI * (t - T.comment)) / BEAT)), POP_AT[2]];
}

// --- camera moves -----------------------------------------------------------------------------------------------------------------------
const SWEEP: SpringCfg = { damping: 22, stiffness: 26, mass: 1 };       // the long, heavy sweep round the shape
function rig(t: number): Rig {
  const drift = 0.05 * Math.sin(t * 0.7);                                // never dead still
  const hook: Rig = { target: add(HOME, [0, 1.3, 0.6]), az: -2.5 + drift, el: 0.3, dist: 6.4, roll: 0 };
  const lv = level(t - 0.12);
  const chase: Rig = { target: add(lv, [0, 0.9, 0.4]), az: -2.4 + drift, el: 0.36, dist: 7.4, roll: -0.03 };
  const side: Rig = { target: [MID[0], 2.4, MID[2]], az: -1.62 + 0.04 * (t - T.orbit), el: 0.26, dist: 8.6, roll: 0 };
  const cta: Rig = { target: [POP_AT[0], 0.9, POP_AT[2]], az: -1.15 + 0.03 * (t - T.flash), el: 0.5, dist: 7.6, roll: 0 };
  let r = rigMix(hook, chase, springAt(t, T.launch - 0.1, SOFT));
  const k = springAt(t, T.orbit, SWEEP);
  r = rigMix(r, side, k);
  r.roll += -0.07 * Math.sin(Math.PI * clamp(k));                      // the sweep banks like a drone
  const focus: Rig = { target: add(at(LAST), [0, 0.7, 0]), az: -1.5 + 0.04 * (t - T.orbit), el: 0.22, dist: 7.2, roll: 0 };
  r = rigMix(r, focus, springAt(t, T.collapse - 0.15, SOFT));            // the pop happens mid-frame
  r = rigMix(r, cta, springAt(t, T.flash + 0.05, SWEEP));
  const shake = NOTES.filter(isBig).reduce((s, n) => s + 0.06 * wob(t - n.t, 9, 38), 0) + 0.12 * wob(t - T.flash, 7, 34);
  return { ...r, target: add(r.target, [0, shake, 0]) };
}

// --- drawing ----------------------------------------------------------------------------------------------------------------------------
type Item = { depth: number; el: React.ReactNode };
const pts = (list: ([number, number, number] | null)[]) => list.every(Boolean) ? (list as [number, number, number][]).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ') : null;
/** A horizontal circle in the world as screen polyline pieces (split where it passes behind the camera). */
function ring(cam: Cam, c: V, r: number, n = 64): string[] {
  const out: string[] = []; let cur: string[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI, p = project(cam, [c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]);
    if (p) cur.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`); else if (cur.length) { out.push(cur.join(' ')); cur = []; }
  }
  if (cur.length > 1) out.push(cur.join(' '));
  return out;
}

/** The floor: hairlines one unit apart, faded by distance; the pop sends a bright wave out across them. */
const Floor: React.FC<{ cam: Cam; t: number }> = ({ cam, t }) => {
  const age = t - T.flash, waveR = age >= 0 ? 24 * easeOut(age / 1.8) : -99, waveK = age >= 0 ? 1 - clamp(age / 1.8) : 0;
  const segs: React.ReactNode[] = [];
  const seg = (a: V, b: V, key: string) => {
    const p = project(cam, a), q = project(cam, b);
    if (!p || !q) return;
    const m = mix(a, b, 0.5), d = Math.hypot(m[0] - POP_AT[0], m[2] - POP_AT[2]);
    const op = (0.11 + 0.75 * waveK * Math.exp(-(((d - waveR) / 1.1) ** 2))) * fog((p[2] + q[2]) / 2);
    if (op > 0.004) segs.push(<line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={C.ink} strokeWidth={1.2} opacity={op} />);
  };
  for (let x = -9; x <= 9; x++) for (let z = -8; z < 22; z++) seg([x, 0, z], [x, 0, z + 1], `x${x}:${z}`);
  for (let z = -8; z <= 22; z++) for (let x = -9; x < 9; x++) seg([x, 0, z], [x + 1, 0, z], `z${z}:${x}`);
  return <>{segs}</>;
};

/** A pad: a thin slab at its pitch's height on a hairline stem. It springs up just before the ball lands, flashes on the hit, ripples, sinks. */
function padItem(cam: Cam, t: number, n: TimedNote): Item | null {
  const grow = springAt(t, n.t - 0.14, POP);
  const sinkAt = T.collapse + 0.06 * n.order, sink = ramp(t, sinkAt, sinkAt + 0.35);
  const size = grow * (1 - sink);
  if (size < 0.02) return null;
  const c0 = at(n), c: V = [c0[0], c0[1] * (1 - sink), c0[2]], s = PAD * size, top = c[1], bot = c[1] - THICK * size;
  const flash = Math.max(0.85 * kick(t - n.t, 5), 0.7 * kick(t - (T.echo + 0.08 * n.order), 6));
  const corner = (dx: number, y: number, dz: number): V => [c[0] + dx * s, y, c[2] + dz * s];
  const faces: { n: V; v: V[]; fill: string; edge: number }[] = [
    { n: [0, 1, 0], v: [corner(-1, top, -1), corner(1, top, -1), corner(1, top, 1), corner(-1, top, 1)], fill: C.top, edge: 0.6 },
    { n: [0, -1, 0], v: [corner(-1, bot, -1), corner(1, bot, -1), corner(1, bot, 1), corner(-1, bot, 1)], fill: C.side, edge: 0.2 },
    { n: [0, 0, -1], v: [corner(-1, top, -1), corner(1, top, -1), corner(1, bot, -1), corner(-1, bot, -1)], fill: C.side, edge: 0.3 },
    { n: [0, 0, 1], v: [corner(-1, top, 1), corner(1, top, 1), corner(1, bot, 1), corner(-1, bot, 1)], fill: C.side, edge: 0.3 },
    { n: [-1, 0, 0], v: [corner(-1, top, -1), corner(-1, top, 1), corner(-1, bot, 1), corner(-1, bot, -1)], fill: C.side, edge: 0.3 },
    { n: [1, 0, 0], v: [corner(1, top, -1), corner(1, top, 1), corner(1, bot, 1), corner(1, bot, -1)], fill: C.side, edge: 0.3 },
  ];
  const pc = project(cam, c);
  if (!pc) return null;
  const f = fog(pc[2]);
  const stemTop = project(cam, [c[0], bot, c[2]]), stemBot = project(cam, [c[0], 0, c[2]]);
  const rings = (isBig(n) ? [0, 0.14] : [0]).map((d) => {
    const u = (t - n.t - d) / (isBig(n) ? 1.0 : 0.7);
    if (u < 0 || u >= 1) return null;
    return ring(cam, [c[0], top + 0.002, c[2]], 0.3 + (isBig(n) ? 2.6 : 1.3) * easeOut(u)).map((p, i) => <polyline key={`${d}-${i}`} points={p} fill="none" stroke={C.ink} strokeWidth={1.6} opacity={0.6 * (1 - u) * f} />);
  });
  const beam = n === LAST ? kick(t - n.t, 1.6) * (1 - ramp(t, T.collapse, T.collapse + 0.3)) : 0;
  const beamTop = beam > 0.01 ? project(cam, [c[0], top + 14, c[2]]) : null, beamBot = project(cam, [c[0], top, c[2]]);
  return {
    depth: pc[2],
    el: (
      <g key={`pad${n.order}`} opacity={f}>
        {stemTop && stemBot && <line x1={stemTop[0]} y1={stemTop[1]} x2={stemBot[0]} y2={stemBot[1]} stroke={C.ink} strokeWidth={1.2} opacity={0.22} />}
        {faces.filter((fc) => dot(fc.n, sub(cam.pos, fc.v[0])) > 0).map((fc, i) => {
          const p = pts(fc.v.map((v) => project(cam, v)));
          if (!p) return null;
          const lit = fc.n[1] > 0 ? flash : flash * 0.35;
          return <polygon key={i} points={p} fill={lit > 0.01 ? mixHex(fc.fill, C.ink, lit) : fc.fill} stroke={C.ink} strokeWidth={1.4} strokeOpacity={Math.min(1, fc.edge + 0.4 * flash)} strokeLinejoin="round" />;
        })}
        {rings}
        {beamTop && beamBot && <>
          <line x1={beamBot[0]} y1={beamBot[1]} x2={beamTop[0]} y2={beamTop[1]} stroke={C.ink} strokeWidth={14} opacity={0.07 * beam} />
          <line x1={beamBot[0]} y1={beamBot[1]} x2={beamTop[0]} y2={beamTop[1]} stroke={C.ink} strokeWidth={2} opacity={0.8 * beam} />
        </>}
      </g>
    ),
  };
}
const mixHex = (a: string, b: string, k: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], k))).join(',')})`;
};

/** The ball: a shaded sphere, stretched along its screen speed in the air, squashed flat against what it lands on, with a hairline
 *  drop-line and a contact ring on the floor under it so its height always reads. */
function ballItem(cam: Cam, key: string, p: V, prev: V, next: V, sq: number, scale: number, dt: number): Item | null {
  if (scale < 0.01) return null;
  const c = project(cam, [p[0], p[1] + R * scale, p[2]]);
  if (!c) return null;
  const r = (FOCAL * R * scale) / c[2], f = fog(c[2]);
  const a = project(cam, prev), b = project(cam, next);
  const vx = a && b ? (b[0] - a[0]) / (2 * dt) : 0, vy = a && b ? (b[1] - a[1]) / (2 * dt) : 0;
  const floor = project(cam, [p[0], 0, p[2]]);
  let body: React.ReactNode;
  if (Math.abs(sq) > 0.03) {
    const ry = r * (1 - sq), rx = r * (1 + 0.7 * sq);
    body = <ellipse cx={c[0]} cy={c[1] + r - ry} rx={rx} ry={ry} fill="url(#sphere)" />;
  } else {
    const s = 1 + Math.min(0.4, Math.hypot(vx, vy) / 5200), ang = (Math.atan2(vy, vx) * 180) / Math.PI;
    body = <ellipse cx={0} cy={0} rx={r * s} ry={r / s} fill="url(#sphere)" transform={`translate(${c[0]} ${c[1]}) rotate(${ang})`} />;
  }
  return {
    depth: c[2] - 0.5,                                   // drawn after the pad it stands on
    el: (
      <g key={key} opacity={f}>
        {floor && p[1] > 0.05 && <line x1={floor[0]} y1={floor[1]} x2={c[0]} y2={c[1] + r} stroke={C.ink} strokeWidth={1} strokeDasharray="3 5" opacity={0.3} />}
        {ring(cam, [p[0], 0.001, p[2]], 0.22 * scale, 32).map((q, i) => <polyline key={i} points={q} fill="none" stroke={C.ink} strokeWidth={1.4} opacity={0.45} />)}
        {body}
      </g>
    ),
  };
}

/** White specks thrown up by a hit, falling under gravity, in 3D. Seeded per hit, so every render is identical. */
function specks(cam: Cam, key: string, age: number, o: V, n: number, seed: number, power: number, life: number, g: number): Item[] {
  if (age < 0 || age > life) return [];
  const rnd = rng(seed);
  return Array.from({ length: n }, (_, i): Item | null => {
    const th = rnd() * 2 * Math.PI, up = 0.35 + 0.65 * rnd(), v = power * (0.5 + 0.5 * rnd());
    const p: V = [o[0] + Math.cos(th) * Math.sqrt(1 - up * up) * v * age, o[1] + up * v * age - 0.5 * g * age * age, o[2] + Math.sin(th) * Math.sqrt(1 - up * up) * v * age];
    const q = project(cam, p);
    if (!q) return null;
    return { depth: q[2], el: <circle key={`${key}${i}`} cx={q[0]} cy={q[1]} r={Math.max(1.2, (FOCAL * 0.028) / q[2])} fill={C.ink} opacity={(1 - age / life) * fog(q[2])} /> };
  }).filter((x): x is Item => x !== null);
}

/** The path the ball has taken: a dashed hairline in the air, newest brightest; it stays for the side view and goes as the pads sink. */
function trail(cam: Cam, t: number): React.ReactNode {
  if (t <= T.melodyAt) return null;
  const fade = 1 - ramp(t, T.collapse, T.collapse + 0.35), stop = Math.min(t, END);
  if (fade <= 0) return null;
  const out: React.ReactNode[] = [];
  let chunk: string[] = [], s0 = T.melodyAt;
  const flush = (s: number) => {
    if (chunk.length > 1) out.push(<polyline key={s} points={chunk.join(' ')} fill="none" stroke={C.ink} strokeWidth={1.6} strokeDasharray="2 6" strokeLinecap="round" opacity={fade * Math.max(0.22 + 0.5 * Math.exp(-(t - s0) * 1.4), 0.45 * ramp(t, T.orbit, T.orbit + 0.6))} />);
    chunk = chunk.slice(-1); s0 = s;
  };
  for (let s = T.melodyAt, i = 0; s <= stop + 1e-9; s += 1 / 120, i++) {
    const p = contact(s), q = project(cam, [p[0], p[1] + R, p[2]]);
    if (q) chunk.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`);
    if (i % 12 === 11) flush(s);
  }
  flush(stop);
  return out;
}

// --- the film ---------------------------------------------------------------------------------------------------------------------------
export const Mozart3D: React.FC<{ silent?: boolean }> = ({ silent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cam = camera(rig(t));
  const dt = 1 / 240;

  const items: Item[] = [];
  NOTES.forEach((n) => { const it = padItem(cam, t, n); if (it) items.push(it); });

  // the ball: on the floor, then pad to pad; after the last note it lifts, swells, pops
  if (t < T.flash) {
    const pos = t < T.collapse ? contact : ballEnd;
    const land = LANDINGS.filter((l) => t >= l.t).at(-1);
    let sq = land ? land.sq * wob(t - land.t, 16, 40) : 0;
    if (t >= IDLE_END && t < T.launch) sq = 0.34 * ramp(t, IDLE_END, T.launch);
    if (HOPS.some((h) => t > h.t0 + 0.03 && t < h.t1 - 0.03) || t >= T.collapse) sq = 0;
    const grow = 1 + 0.6 * ramp(t, T.collapse + 0.1, T.flash - 0.1) - 0.2 * ramp(t, T.flash - 0.1, T.flash);
    const it = ballItem(cam, 'ball', pos(t), pos(t - dt), pos(t + dt), sq, grow, dt);
    if (it) items.push(it);
  }
  const cb = ctaBall(t);
  if (cb) {
    const age = (t - T.comment) % BEAT, sq = t > T.comment && cb[1] < 0.12 ? 0.32 * wob(age, 18, 40) : 0;
    const prev = ctaBall(t - dt) ?? cb, next = ctaBall(t + dt) ?? cb;
    const it = ballItem(cam, 'cta', cb, prev, next, sq, springAt(t, T.comment - 0.45, POP), dt);
    if (it) items.push(it);
  }

  NOTES.forEach((n) => items.push(...specks(cam, `s${n.order}`, t - n.t, at(n), isBig(n) ? 16 : 7, n.order * 7919 + 13, isBig(n) ? 3.4 : 2.2, 0.8, 9)));
  const popAt = add(ballEnd(T.flash), [0, R * 1.5, 0]);
  items.push(...specks(cam, 'pop', t - T.flash, popAt, 48, 4242, 6.5, 0.9, 2.5));
  [0, 1, 2, 3].forEach((k) => {
    const u = (t - k * BEAT) / 0.6;
    if (u < 0 || u >= 1 || t > T.launch) return;
    const q = project(cam, HOME);
    if (q) items.push({ depth: q[2] + 0.1, el: <g key={`idle${k}`}>{ring(cam, [HOME[0], 0.001, HOME[2]], 0.25 + 0.9 * easeOut(u)).map((p, i) => <polyline key={i} points={p} fill="none" stroke={C.ink} strokeWidth={1.4} opacity={0.5 * (1 - u)} />)}</g> });
  });

  // the pop: a ring in the air where the ball was, and the floor wave (in Floor)
  const popAge = t - T.flash;
  const popRing = popAge >= 0 && popAge < 0.9 ? (() => {
    const c = project(cam, popAt);
    return c ? <circle cx={c[0]} cy={c[1]} r={(FOCAL * (R * 1.6 + 5 * easeOut(popAge / 0.9))) / c[2]} fill="none" stroke={C.ink} strokeWidth={3} opacity={0.85 * (1 - popAge / 0.9)} /> : null;
  })() : null;

  items.sort((a, b) => b.depth - a.depth);                // painter: far first

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="sphere" cx="0.36" cy="0.32" r="0.78">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.5" stopColor="#E4DEEE" />
            <stop offset="1" stopColor="#6F6684" />
          </radialGradient>
        </defs>
        <Floor cam={cam} t={t} />
        {trail(cam, t)}
        {items.map((it) => it.el)}
        {popRing}
      </svg>

      {/* scene 1 · the hook */}
      <Caps t={t} at={-0.5} outAt={1.35} y={420} text="MOZART — EINE KLEINE NACHTMUSIK" />
      <Hook t={t} top={560} />

      {/* scene 2 · hear it */}
      <Caps t={t} at={T.melodyAt - 0.25} outAt={T.collapse} y={420} text="LISTEN · ONE TIME" />
      <Pips t={t} y={1720} notes={NOTES} from={T.melodyAt - 0.2} to={T.orbit + 0.3} />

      {/* scene 3 · your turn */}
      <Line t={t} at={T.turn} y={560} size={128}>Your turn.</Line>
      <Line t={t} at={T.sub} y={700} size={42} weight={400} color="rgba(244,240,250,0.5)">No tabs. Just your ears.</Line>
      <Line t={t} at={T.comment} y={1560} size={44} weight={400}>Comment the notes ↓</Line>

      {!silent && <Audio src={staticFile('mozart-3d.wav')} />}
    </AbsoluteFill>
  );
};

/** The cover: the hook over the side view of the whole shape — pads, stems, the arcs the ball took — no notes.
 *  Everything sits inside the central 1080×1350 so the 4:5 grid crop keeps it. */
export const MozartCover: React.FC = () => {
  const t = T.orbit + 0.6;                                // every pad up, the top D's beam still standing
  const cam = camera({ target: [MID[0], 3.0, MID[2]], az: -1.55, el: 0.26, dist: 10.2, roll: 0 });
  const items = NOTES.map((n) => padItem(cam, t, n)).filter((x): x is Item => x !== null);
  const ball = ballItem(cam, 'ball', at(LAST), at(LAST), at(LAST), 0, 1, 1);
  if (ball) items.push(ball);
  items.sort((a, b) => b.depth - a.depth);
  const arc: string[] = [];
  for (let s = T.melodyAt; s <= END + 1e-9; s += 1 / 120) { const p = contact(s), q = project(cam, [p[0], p[1] + R, p[2]]); if (q) arc.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`); }
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="sphere" cx="0.36" cy="0.32" r="0.78">
            <stop offset="0" stopColor="#FFFFFF" /><stop offset="0.5" stopColor="#E4DEEE" /><stop offset="1" stopColor="#6F6684" />
          </radialGradient>
        </defs>
        <Floor cam={cam} t={t} />
        <polyline points={arc.join(' ')} fill="none" stroke={C.ink} strokeWidth={2} strokeDasharray="2 7" strokeLinecap="round" opacity={0.55} />
        {items.map((it) => it.el)}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', fontWeight: 500, fontSize: 32, letterSpacing: '0.3em', color: 'rgba(244,240,250,0.46)' }}>MOZART — EINE KLEINE NACHTMUSIK</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 400, textAlign: 'center', fontWeight: 300, fontSize: 132, lineHeight: 1.1, letterSpacing: '-0.015em', color: C.ink, whiteSpace: 'pre' }}>{'Can you play\nthis by ear?'}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1540, textAlign: 'center', fontWeight: 400, fontSize: 42, color: 'rgba(244,240,250,0.46)' }}>9 notes · one listen · no tabs</div>
    </AbsoluteFill>
  );
};
