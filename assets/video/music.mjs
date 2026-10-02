// Synthesizes the promo soundtrack to a mono WAV — no samples, same spirit as the app's runtime audio.
// The plucked-string voice mirrors renderPluckedString() in src/services/audio/synth.ts (Karplus–Strong).
// Usage: node music.mjs out.wav
//
// Timeline is on a 0.5 s grid (120 BPM) and must stay in step with slides.html:
//   0–4 hook · 4–8 problem · 8–12 call (S3) · 12–20 call → reply → result (S4) · 20–24 instruments · 24–30 close
import { writeFileSync } from 'node:fs';

const SR = 44100;
const DUR = 30;
const out = new Float32Array(SR * DUR);
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function mix(buf, start, gain = 1) {
  const o = Math.round(start * SR);
  for (let i = 0; i < buf.length && o + i < out.length; i++) out[o + i] += buf[i] * gain;
}

// --- voices -----------------------------------------------------------------------------------

/** Karplus–Strong pluck (guitar-ish). */
function pluck(m, dur, seed = 0x9e3779b9) {
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
function voice(m, dur) {
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
function keys(m, dur) {
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
function bell(m, dur) {
  const f = hz(m), total = Math.round(dur * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    o[i] = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-4 * t)) *
      Math.exp(-2.6 * t) * Math.min(1, t / 0.003);
  }
  return o;
}

/** Pad: two slightly detuned sines per note, slow attack/release. */
function pad(notes, dur) {
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

function sub(m, dur) {
  const f = hz(m), total = Math.round(dur * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    o[i] = Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.4);
  }
  return o;
}

// --- score ------------------------------------------------------------------------------------

// Chord bed: [startSec, durSec, bassMidi, padMidis]. Am | F | C | G | Am | F | C | G | Am
const Am = [45, [57, 60, 64]], F = [41, [53, 57, 60]], C = [48, [55, 60, 64]], G = [43, [55, 59, 62]];
const chords = [[0, 4, Am], [4, 4, F], [8, 4, C], [12, 4, G], [16, 4, Am], [20, 2, F], [22, 2, C], [24, 2, G], [26, 4, Am]];
for (const [t, d, [bass, notes]] of chords) {
  mix(pad(notes, d + 0.7), t, 0.075);
  mix(sub(bass, d), t, 0.2);
}

// S1 + S2: sparse, slightly unresolved melody.
[[0.0, 64], [1.0, 69], [2.0, 67], [3.0, 64], [4.5, 69], [5.5, 72], [6.5, 69], [7.5, 67]]
  .forEach(([t, m]) => mix(pluck(m, 2.2), t, 0.5));

// Melody the viewer is asked to reproduce (E3 G3 A3 C4 A3), then the hummed reply with one wrong note (F3).
const TARGET = [52, 55, 57, 60, 57];
const REPLY = [52, 53, 57, 60, 57];
TARGET.forEach((m, i) => mix(pluck(m, i === 4 ? 2.4 : 1.4, 0x1234567 + i), 8.5 + i * 0.5, 0.75));   // S3 call
TARGET.forEach((m, i) => mix(pluck(m, i === 4 ? 2.4 : 1.4, 0x7654321 + i), 12.5 + i * 0.5, 0.75)); // S4 call
REPLY.forEach((m, i) => mix(voice(m, i === 4 ? 1.8 : 0.9), 15.0 + i * 0.5, 0.3));                  // S4 reply

// S4 result chime (Am arpeggio of bells) — "it landed".
[69, 72, 76].forEach((m, i) => mix(bell(m, 2.2), 17.5 + i * 0.09, 0.3));

// S5: three timbres, one per word.
mix(pluck(57, 2.0), 20.5, 0.8);                                   // Guitar
[60, 64].forEach(m => mix(keys(m + 12, 2.0), 21.5, 0.38));         // Piano (open third)
mix(voice(67, 1.9), 22.5, 0.55);                                  // Voice

// S6: logo bell, then a rising Am arpeggio as the tagline lands.
mix(bell(74, 2.5), 24.4, 0.22);
[57, 60, 64, 69].forEach((m, i) => mix(pluck(m, 2.4, 0xabc + i), 26.0 + i * 0.5, 0.7));
mix(bell(81, 3.0), 28.0, 0.18);

// --- master -----------------------------------------------------------------------------------
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
writeFileSync(process.argv[2] ?? 'music.wav', buf);
console.log(`wrote ${process.argv[2] ?? 'music.wav'} (${DUR}s, pre-master peak ${peak.toFixed(2)})`);
