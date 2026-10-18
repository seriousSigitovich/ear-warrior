// Soundtrack of the pain sketch: recorded acoustic guitar (../synth.mjs) for every note, synthesized room tone, chatter, cheer, a cricket.
// The notes come from story.mjs — the same list the picture reads — so every wrong note is heard when it is seen.
import { track, guitarNote, writeWav, SR } from '../../synth.mjs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DURATION, T, RIFF, ATTEMPTS, QUIET_MELODY, QUIET_LINE2, QUIET_HARMONY, QUIET_CHORD_AT, END_MELODY, END_CHORD_AT, WRONG_AT, RESTARTS
} from './story.mjs';

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 0xffffffff) * 2 - 1; };
}
/** Piecewise-linear envelope: env([[t,v],…])(t). */
const env = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
  return pts[pts.length - 1][1];
};

function kick(len = 0.28) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR, f = 48 + 120 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.002);
  }
  return o;
}
function noiseBurst(len, decay, hp = 0.9, seed = 0x1234567) {
  const r = rand(seed), total = Math.round(len * SR), o = new Float32Array(total);
  let prev = 0;
  for (let i = 0; i < total; i++) { const n = r(); o[i] = (n - prev * hp) * Math.exp(-(i / SR) * decay); prev = n; }
  return o;
}
/** A fret that does not ring: a dull "thunk" with a bit of string buzz. */
function deadNote(len = 0.22) {
  const total = Math.round(len * SR), o = new Float32Array(total), r = rand(77);
  let lp = 0;
  for (let i = 0; i < total; i++) { const t = i / SR; lp += 0.16 * (r() - lp); o[i] = lp * 2.2 * Math.exp(-t * 20) + Math.sin(2 * Math.PI * 138 * t) * Math.exp(-t * 28) * 0.4; }
  return o;
}
/** Chatter: several "voices" of low-passed noise, each opened and closed at a syllable rate, scaled by level(t). */
function babble(out, level, from, to, seed) {
  const r = rand(seed);
  for (let v = 0; v < 5; v++) {
    const f1 = 2.2 + 1.6 * Math.abs(r()), f2 = 0.35 + 0.5 * Math.abs(r()), p1 = r() * 6, p2 = r() * 6, a = 0.07 + 0.1 * Math.abs(r());
    let y = 0, z = 0;
    for (let i = Math.round(from * SR); i < Math.min(out.length, Math.round(to * SR)); i++) {
      const t = i / SR;
      y += a * (r() - y); z += 0.5 * (y - z);                              // two one-pole low-passes ≈ a muffled vowel
      const syl = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * f1 * t + p1), 2) * (0.35 + 0.65 * Math.max(0, Math.sin(2 * Math.PI * f2 * t + p2)));
      out[i] += z * syl * level(t) * 0.55;
    }
  }
}
function cheer(out, from, to) {
  const r = rand(5);
  let y = 0, z = 0;
  const e = env([[from, 0], [from + 0.5, 1], [to - 0.6, 1], [to, 0.6]]);
  for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) {
    const t = i / SR;
    y += 0.2 * (r() - y); z += 0.3 * (y - z);
    out[i] += (z * 1.1 + (r() - y) * 0.06) * e(t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5.3 * t) * Math.sin(2 * Math.PI * 1.7 * t));
  }
}

export function renderPainAudio(outPath) {
  const { out, mix } = track(DURATION);
  const note = (n, gain = 0.9, rel = 0.12) => mix(guitarNote(n.midi, Math.max(0.1, n.dur * 1.05), rel), n.t, gain);

  // 0–11: the riff (the template's pulse joins at 3 s, once the "legend" part starts)
  for (const n of RIFF) note(n, 0.85, 0.08);
  const k = kick(), hat = noiseBurst(0.07, 60);
  for (let b = 0; T.legend + b * 0.5 < T.party; b++) {
    const t = T.legend + b * 0.5;
    mix(k, t, b % 2 === 0 ? 0.55 : 0.35);
    mix(hat, t + 0.25, 0.14);
  }

  // 11–17: party. Chatter is loud until someone asks, then everyone goes quiet.
  const crowd = env([
    [T.party, 0.7], [T.ask - 0.1, 0.9], [T.ask + 0.5, 0.12], [T.phone + 2, 0.12], [T.fail, 0.18], [20.2, 0.18], [20.6, 0.4], [21.5, 0.22], [26.2, 0.2], [26.8, 0.42],
    [28, 0.22], [34.6, 0.14], [35.2, 0.28], [36.4, 0.1], [T.silence, 0], [T.quiet - 0.4, 0], [T.quiet + 1.2, 0.18], [48, 0.28], [49, 0.12], [T.end, 0],
  ]);
  babble(out, crowd, T.party, T.end, 42);
  // phone: low-battery double blip then a falling "no signal" tone
  const blip = (f, len) => { const n = Math.round(len * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.sin((2 * Math.PI * f * i) / SR) * Math.min(1, i / 200) * Math.min(1, (n - i) / 400); return o; };
  mix(blip(988, 0.09), T.phone + 0.15, 0.25); mix(blip(988, 0.09), T.phone + 0.3, 0.25);
  mix(blip(392, 0.16), T.phone + 1.25, 0.28); mix(blip(294, 0.28), T.phone + 1.45, 0.28);

  // 17–37: his attempts. A wrong note is a real note a semitone off; each ends with a dead-string thunk.
  for (const n of ATTEMPTS) note(n, n.ok ? 0.85 : 0.95, n.ok ? 0.12 : 0.3);
  for (const t of WRONG_AT) mix(deadNote(), t + 0.55, 0.5);
  for (const t of RESTARTS) mix(noiseBurst(0.09, 40, 0.3, 91), t, 0.25);      // palm on the strings
  mix(noiseBurst(0.12, 30, 0.2, 14), 30.9, 0.12);                            // a throat clearing somewhere in the crowd

  // 37–41: silence — a fridge, a cricket, a cough
  const r = rand(3);
  for (let i = Math.round(T.silence * SR); i < Math.round(T.quiet * SR); i++) out[i] += Math.sin((2 * Math.PI * 58 * i) / SR) * 0.006 + r() * 0.0015;
  for (let c = 0; T.silence + 0.4 + c * 1.1 < T.quiet - 0.3; c++) {
    for (let p = 0; p < 3; p++) {
      const t0 = T.silence + 0.4 + c * 1.1 + p * 0.07, n = Math.round(0.035 * SR);
      for (let i = 0; i < n; i++) out[Math.round(t0 * SR) + i] += Math.sin((2 * Math.PI * 4300 * i) / SR) * Math.sin((Math.PI * i) / n) * 0.02;
    }
  }
  mix(noiseBurst(0.22, 14, 0.5, 8), 38.4, 0.2);

  // 41–53: Quiet Guy. Slightly softer, steadier; second voice a third below on the second line; a chord to finish.
  for (const n of QUIET_MELODY) note(n, 0.85, 0.1);
  for (const n of QUIET_LINE2) note(n, 0.85, 0.1);
  for (const n of QUIET_HARMONY) note(n, 0.55, 0.1);
  for (const m of [48, 55, 60, 64, 67]) mix(guitarNote(m, 1.2, 0.5), QUIET_CHORD_AT + [48, 55, 60, 64, 67].indexOf(m) * 0.02, 0.5);
  cheer(out, 49.4, T.end + 0.4);
  const clap = noiseBurst(0.05, 70, 0.5, 12);
  const rc = rand(21);
  for (let t = 50.2; t < 53.2; t += 0.07 + Math.abs(rc()) * 0.14) mix(clap, t, 0.06 + 0.08 * Math.abs(rc()));

  // 53–60: end card — a chord, the phrase on the app's fretboard, a resolving chord
  mix(kick(0.4), T.end, 0.9);
  for (const m of [48, 55, 60, 64, 67]) mix(guitarNote(m, 1.4, 0.6), T.end + [48, 55, 60, 64, 67].indexOf(m) * 0.02, 0.45);
  for (const n of END_MELODY) note(n, 0.8, 0.1);
  for (const m of [48, 55, 60, 64, 67]) mix(guitarNote(m, 2.6, 1.2), END_CHORD_AT + [48, 55, 60, 64, 67].indexOf(m) * 0.018, 0.65);
  mix(kick(0.4), END_CHORD_AT, 0.8);

  mkdirSync(dirname(outPath), { recursive: true });
  return writeWav(outPath, out);
}
