// Node-only half of warrior/take.mjs (the Remotion bundle must not import child_process): finds the onsets in a recorded take.
import { execFileSync } from 'node:child_process';

const SR = 22050, HOP = 256;

/** Onsets of a take: [{ t, s }] (seconds, strength 0..1) plus its duration. Positive jumps of a smoothed log-energy envelope, peak-picked. */
export function analyzeTake(path) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const n = Math.floor(x.length / HOP), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < HOP; j++) e += x[i * HOP + j] ** 2; env[i] = Math.log(1e-6 + e / HOP); }
  const flux = new Float32Array(n);
  for (let i = 2; i < n; i++) flux[i] = Math.max(0, env[i] - Math.min(env[i - 1], env[i - 2]));
  const max = Math.max(...flux), floor = 0.18 * max, minGap = Math.round(0.07 * SR / HOP);
  const on = [];
  for (let i = 2; i < n - 2; i++) {
    if (flux[i] < floor || flux[i] < flux[i - 1] || flux[i] < flux[i + 1]) continue;
    if (on.length && i - on[on.length - 1].i < minGap) { if (flux[i] > on[on.length - 1].f) on[on.length - 1] = { i, f: flux[i] }; continue; }
    on.push({ i, f: flux[i] });
  }
  // loudness of each onset (peak envelope over the next 60 ms) decides "big"
  const loud = on.map(({ i }) => { let m = -Infinity; for (let k = i; k < Math.min(n, i + 5); k++) m = Math.max(m, env[k]); return m; });
  const lo = Math.min(...loud), hi = Math.max(...loud);
  return { duration: x.length / SR, onsets: on.map((o, k) => ({ t: +Math.max(0, (o.i * HOP) / SR - 0.02).toFixed(3), s: +((loud[k] - lo) / (hi - lo || 1)).toFixed(3) })) };
}

