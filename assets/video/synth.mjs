// Synthesis voices shared by the promo (music.mjs) and the challenge videos (challenge/score.mjs) —
// no samples, same spirit as the app's runtime audio.
// The plucked-string voice mirrors renderPluckedString() in src/services/audio/synth.ts (Karplus–Strong).
import { writeFileSync } from 'node:fs';

export const SR = 44100;
export const hz = m => 440 * Math.pow(2, (m - 69) / 12);

/** A mono buffer of `durSec` plus `mix(buf, startSec, gain)` to lay voices onto it. */
export function track(durSec) {
  const out = new Float32Array(SR * durSec);
  function mix(buf, start, gain = 1) {
    const o = Math.round(start * SR);
    for (let i = 0; i < buf.length && o + i < out.length; i++) out[o + i] += buf[i] * gain;
  }
  return { out, mix };
}

// --- voices -----------------------------------------------------------------------------------

/** Karplus–Strong pluck (guitar-ish). */
export function pluck(m, dur, seed = 0x9e3779b9) {
  const f = hz(m), total = Math.round(dur * SR), n = Math.max(2, Math.round(SR / f));
  const d = new Float32Array(n);
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 0xffffffff) * 2 - 1; };
  for (let i = 0; i < n; i++) d[i] = rnd();
  const o = new Float32Array(total);
  let idx = 0;
  for (let i = 0; i < total; i++) {
    const c = d[idx], nx = d[(idx + 1) % n];
    o[i] = c;
    d[idx] = 0.5 * (c + nx) * 0.996;
    idx = (idx + 1) % n;
  }
  const a = Math.min(total, Math.round(0.005 * SR)), r = Math.min(total, Math.round(0.05 * SR));
  for (let i = 0; i < a; i++) o[i] *= i / a;
  for (let i = 0; i < r; i++) o[total - 1 - i] *= i / r;
  return o;
}

/** Hummed "voice": sine + soft 2nd/3rd harmonic with gentle vibrato and a slow attack. */
export function voice(m, dur) {
  const f = hz(m), total = Math.round(dur * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.4 * t) * Math.min(1, t / 0.4);
    ph += (2 * Math.PI * f * vib) / SR;
    const env = Math.min(1, t / 0.07) * Math.min(1, (dur - t) / 0.12) * Math.exp(-0.5 * t);
    o[i] = env * (Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph));
  }
  return o;
}

/** Soft piano-ish tone: a few decaying partials. */
export function keys(m, dur) {
  const f = hz(m), total = Math.round(dur * SR), o = new Float32Array(total);
  const parts = [[1, 1, 2.2], [2, 0.5, 3.0], [3, 0.25, 4.0], [4, 0.12, 5.5]];
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    let v = 0;
    for (const [k, a, dec] of parts) v += a * Math.sin(2 * Math.PI * f * k * t) * Math.exp(-dec * t);
    o[i] = v * Math.min(1, t / 0.004) * Math.min(1, (dur - t) / 0.08);
  }
  return o;
}

/** Glassy bell for the "it landed" chime. */
export function bell(m, dur) {
  const f = hz(m), total = Math.round(dur * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    o[i] = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-4 * t)) *
      Math.exp(-2.6 * t) * Math.min(1, t / 0.003);
  }
  return o;
}

/** Pad: two slightly detuned sines per note, slow attack/release. */
export function pad(notes, dur) {
  const total = Math.round(dur * SR), o = new Float32Array(total);
  const A = 0.6, R = 0.7;
  for (const m of notes) {
    const f = hz(m);
    for (const det of [-0.0018, 0.0018]) {
      for (let i = 0; i < total; i++) {
        const t = i / SR;
        const env = Math.min(1, t / A) * Math.min(1, (dur - t) / R);
        o[i] += env * Math.sin(2 * Math.PI * f * (1 + det) * t) * 0.5;
      }
    }
  }
  return o;
}

export function sub(m, dur) {
  const f = hz(m), total = Math.round(dur * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    o[i] = Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.4);
  }
  return o;
}

/** Short unpitched-feeling click for the countdown: a fast-decaying sine at `freq` Hz. */
export function tick(freq, dur = 0.09) {
  const total = Math.round(dur * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    o[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-48 * t) * Math.min(1, t / 0.0015);
  }
  return o;
}

/** Rising noise swell (one-pole low-pass whose cutoff opens up), peaking at the end. */
export function whoosh(dur) {
  const total = Math.round(dur * SR), o = new Float32Array(total);
  let s = 0x2545f491, lp = 0;
  for (let i = 0; i < total; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const noise = ((s >>> 0) / 0xffffffff) * 2 - 1;
    const p = i / total;
    lp += (0.02 + 0.5 * p * p) * (noise - lp);
    o[i] = lp * Math.pow(p, 2) * Math.min(1, (total - i) / (0.03 * SR));
  }
  return o;
}

// --- master -----------------------------------------------------------------------------------

/** Peak-normalize to 0.8 FS and write a 16-bit mono WAV. Returns the pre-master peak. */
export function writeWav(path, out) {
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = 0.8 / (peak || 1);
  const pcm = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, out[i] * g)) * 32767);

  const buf = Buffer.alloc(44 + pcm.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(pcm.length * 2, 40);
  Buffer.from(pcm.buffer).copy(buf, 44);
  writeFileSync(path, buf);
  return peak;
}
