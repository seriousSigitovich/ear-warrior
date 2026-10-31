// A tiny 3-D camera for SVG: world → screen with a real pinhole projection and near-plane clipping, so the neck can be a road that runs
// into the distance and the camera can fly over it. World: x along the neck, y up, z across the strings. Pure functions, no state.
export type V3 = readonly [number, number, number];
export type P2 = readonly [number, number];
/** Where the camera is and where it looks. yaw 0 = looking down +x; pitch < 0 = looking down; f = focal length in px. */
export type Pose = { pos: V3; yaw: number; pitch: number; roll: number; f: number };
export type Cam = Pose & { r: V3; u: V3; fw: V3 };

export const CX = 540, CY = 960;
const NEAR = 0.12;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const v3 = { add, mul, sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], lerp: (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] };

/** Basis from yaw/pitch/roll: pitch about the right axis, roll about forward, then yaw about world up. */
export function makeCam(p: Pose): Cam {
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch), cr = Math.cos(p.roll), sr = Math.sin(p.roll), cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  const fw0: V3 = [cp, sp, 0], u0: V3 = [-sp, cp, 0], r0: V3 = [0, 0, 1];
  const u1 = add(mul(u0, cr), mul(r0, sr)), r1 = add(mul(r0, cr), mul(u0, -sr));
  const yaw = (v: V3): V3 => [v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy];
  return { ...p, fw: yaw(fw0), u: yaw(u1), r: yaw(r1) };
}

/** yaw/pitch that look from `pos` at `target`. */
export const aim = (pos: V3, target: V3) => {
  const d = v3.sub(target, pos);
  return { yaw: Math.atan2(-d[2], d[0]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])) };
};

export const lerpPose = (a: Pose, b: Pose, k: number): Pose => ({
  pos: v3.lerp(a.pos, b.pos, k), yaw: a.yaw + (b.yaw - a.yaw) * k, pitch: a.pitch + (b.pitch - a.pitch) * k, roll: a.roll + (b.roll - a.roll) * k, f: a.f + (b.f - a.f) * k,
});

const toCam = (c: Cam, p: V3): V3 => { const d = v3.sub(p, c.pos); return [dot(d, c.r), dot(d, c.u), dot(d, c.fw)]; };
const scr = (c: Cam, q: V3): P2 => [CX + (c.f * q[0]) / q[2], CY - (c.f * q[1]) / q[2]];

/** Screen point, or null behind the near plane. */
export const project = (c: Cam, p: V3): P2 | null => { const q = toCam(c, p); return q[2] < NEAR ? null : scr(c, q); };
/** Depth along the view axis (for sizing and fog). */
export const depth = (c: Cam, p: V3) => toCam(c, p)[2];
/** Pixels per world unit at p (0 behind the camera). */
export const pxPerUnit = (c: Cam, p: V3) => { const z = depth(c, p); return z < NEAR ? 0 : c.f / z; };
/** A point at infinity in direction d (stars, the sun, the horizon). */
export const projectDir = (c: Cam, d: V3): P2 | null => { const q: V3 = [dot(d, c.r), dot(d, c.u), dot(d, c.fw)]; return q[2] <= 1e-4 ? null : scr(c, q); };

/** A segment clipped to the near plane. */
export function segment(c: Cam, a: V3, b: V3): [P2, P2] | null {
  let p = toCam(c, a), q = toCam(c, b);
  if (p[2] < NEAR && q[2] < NEAR) return null;
  if (p[2] < NEAR) p = v3.lerp(p, q, (NEAR - p[2]) / (q[2] - p[2]));
  else if (q[2] < NEAR) q = v3.lerp(q, p, (NEAR - q[2]) / (p[2] - q[2]));
  return [scr(c, p), scr(c, q)];
}

/** A convex polygon clipped to the near plane (Sutherland–Hodgman against one plane), as an SVG points string ('' if gone). */
export function polygon(c: Cam, pts: V3[]): string {
  const q = pts.map((p) => toCam(c, p));
  const out: V3[] = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length], ina = a[2] >= NEAR, inb = b[2] >= NEAR;
    if (ina) out.push(a);
    if (ina !== inb) out.push(v3.lerp(a, b, (NEAR - a[2]) / (b[2] - a[2])));
  }
  return out.length < 3 ? '' : out.map((p) => scr(c, p).map((v) => v.toFixed(1)).join(',')).join(' ');
}

/** A flat circle lying on the plane y = y0 (a disc or ring on the board), as polygon points. */
export const circleOnPlane = (c: Cam, x: number, z: number, r: number, y0 = 0, n = 28) =>
  polygon(c, Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [x + Math.cos(a) * r, y0, z + Math.sin(a) * r] as V3; }));
