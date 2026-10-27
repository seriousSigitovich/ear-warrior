// Soundtrack of the "warrior riff" film: a distorted power-chord riff (Karplus–Strong strings through a tanh amp and a speaker-cabinet low-pass),
// a sustained lead lick in the second bar, bass, drums, and a big E chord with a crash on the last hit. Every time comes from story.mjs.
import { track, pluck, sub, hz, writeWav, SR } from '../../synth.mjs';
import { RIFF } from './story.mjs';

/** Amp + cabinet: hard tanh saturation, then a ~3.2 kHz roll-off (two one-pole stages) and a thin low cut. */
function amp(buf, drive = 9, cab = 0.42) {
  const o = new Float32Array(buf.length);
  let a = 0, b = 0, hp = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = Math.tanh(drive * buf[i]);
    a += cab * (x - a);
    b += cab * (a - b);
    hp += 0.012 * (b - hp);
    o[i] = b - hp;
  }
  return o;
}

/** A power chord (root + fifth + octave), played as a quick down-strum. `mute` = palm-muted chug (short, damped). */
function powerChord(root, dur, mute) {
  const total = Math.round((dur + 0.05) * SR), o = new Float32Array(total);
  [0, 7, 12].forEach((iv, k) => {
    const p = pluck(root + iv, dur, 0x9e3779b9 + k * 977);
    const off = Math.round(k * 0.006 * SR);
    for (let i = 0; i < p.length && off + i < total; i++) o[off + i] += p[i] * (k === 0 ? 1 : 0.75);
  });
  const rel = Math.round((mute ? 0.05 : 0.18) * SR);
  for (let i = 0; i < rel && i < total; i++) o[Math.min(total - 1, Math.round(dur * SR)) - i] *= i / rel;
  if (mute) for (let i = 0; i < total; i++) o[i] *= Math.exp(-(i / SR) * 9);   // palm mute: the string dies fast
  return amp(o, mute ? 11 : 8);
}

/** The lead voice: a bright saw-ish tone with a late vibrato and a bit of pitch scoop at the start, through the amp. */
function lead(midi, dur) {
  const total = Math.round(dur * SR), o = new Float32Array(total), f = hz(midi);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const scoop = 1 - 0.035 * Math.exp(-t * 28);
    const vib = 1 + 0.008 * Math.sin(2 * Math.PI * 5.8 * t) * Math.min(1, t / 0.18);
    ph += (2 * Math.PI * f * scoop * vib) / SR;
    let s = 0;
    for (let h = 1; h <= 6; h++) s += Math.sin(h * ph) / h;
    o[i] = s * Math.min(1, t / 0.006) * Math.min(1, (dur - t) / 0.05);
  }
  return amp(o, 6, 0.5);
}

function kick(len = 0.28) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR, f = 46 + 130 * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.002);
  }
  return o;
}
function noise(len, decay, hp, seed = 0x1234567) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let s = seed, prev = 0;
  for (let i = 0; i < total; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const n = ((s >>> 0) / 0xffffffff) * 2 - 1;
    o[i] = (n - prev * hp) * Math.exp(-(i / SR) * decay); prev = n;
  }
  return o;
}
function snare() {
  const n = noise(0.2, 22, 0.55, 0x2468ace), total = n.length, o = new Float32Array(total);
  for (let i = 0; i < total; i++) { const t = i / SR; o[i] = n[i] * 0.9 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 24) * 0.6; }
  return o;
}

export function renderWarriorAudio(path, story = RIFF) {
  const { DURATION, CHUGS, LEAD, KICKS, SNARES, FILL, HATS, T } = story;
  const { out, mix } = track(DURATION);
  const k = kick(), sn = snare(), hat = noise(0.06, 70, 0.92, 0x13579bd);

  for (const c of CHUGS) {
    mix(powerChord(c.midi, 0.22, true), c.t, c.big ? 0.95 : 0.75);
    mix(sub(c.midi - 12, 0.2), c.t, 0.5);                                       // bass doubling the root
  }
  for (const n of LEAD) mix(lead(n.midi, n.dur), n.t, 0.5);

  for (const t of KICKS) mix(k, t, 0.9);
  for (const t of SNARES) mix(sn, t, 0.7);
  for (const t of FILL) mix(sn, t, 0.55 + 0.12 * FILL.indexOf(t));              // the roll gets louder into the hit
  for (const t of HATS) mix(hat, t, 0.2);

  // the big hit: a ringing E5 chord (open voicing), kick + snare, a crash, a low boom
  const rise = noise(0.5, 1.4, 0.6, 0xabcdef);
  for (let i = 0; i < rise.length; i++) rise[i] *= i / rise.length;
  mix(rise, T.chord - 0.5, 0.16);
  [40, 47, 52, 59, 64].forEach((m, i) => mix(amp(pluck(m, 0.85, 0x51ed + i), 7, 0.4), T.chord + i * 0.012, 0.55));
  mix(k, T.chord, 1.0);
  mix(sn, T.chord, 0.8);
  mix(sub(28, 0.7), T.chord, 0.7);
  mix(noise(1.1, 3.2, 0.9, 0x777777), T.chord, 0.3);                            // crash

  return writeWav(path, out);
}
