#!/usr/bin/env node
// Quality gate for the Short's soundtrack: the pitch heard at every melody onset (first playback AND reveal) must be the pitch of the string/fret
// drawn on the board, the two playbacks must agree, and the timeline must be what the brief says.   node ten/check.mjs   (after render-ten.mjs)
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEARD, ANSWER, MELODY, STEP, T, DURATION, FPS, TUNING, STRING_NAMES, midiAt } from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', join(here, '..', 'public', 'ten-second.wav'), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function power(f, a, b) {
  const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) { const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - a * SR)) / ((b - a) * SR)); const s = x[i] * hann + c * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}
/** The semitone (MIDI) with the most energy in the window. */
function heard(a, b) {
  let best = 0, bp = -1;
  for (let m = 40; m <= 88; m++) { const p = power(hz(m), a, b) / Math.max(1e-9, 1); if (p > bp) { bp = p; best = m; } }
  return best;
}

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fail++; };

// 1. fretboard accuracy: every (string, fret) → the same MIDI as standard tuning, strings named as the brief says
ok(STRING_NAMES.join(' ') === 'E2 A2 D3 G3 B3 E4' && TUNING.join() === '40,45,50,55,59,64', 'standard tuning E2 A2 D3 G3 B3 E4');
ok(MELODY.every((n) => n.midi === midiAt(n.string, n.fret)), 'every displayed note maps string+fret → its MIDI');
const frets = MELODY.map((n) => n.fret);
ok(Math.max(...frets) - Math.min(...frets) <= 2, `one hand position (frets ${Math.min(...frets)}–${Math.max(...frets)}, span ${Math.max(...frets) - Math.min(...frets)})`);
ok(new Set(MELODY.map((n) => `${n.string}:${n.fret}`)).size === 5, 'five different fretboard positions');
// 2. audio ↔ picture: what the ear hears at each onset
for (const [label, list] of [['listen', HEARD], ['reveal', ANSWER]]) {
  const got = list.map((n) => heard(n.t + 0.16, n.t + 0.42));
  list.forEach((n, i) => ok(got[i] === n.midi, `${label} note ${i + 1}: heard MIDI ${got[i]}, board shows ${n.name} (${n.midi})`));
}
// 3. the reveal repeats the melody exactly (same offsets, same pitches)
ok(HEARD.every((n, i) => Math.abs(n.t - HEARD[0].t - (ANSWER[i].t - ANSWER[0].t)) < 1e-9 && n.midi === ANSWER[i].midi), 'reveal = same pitches, same timing as the first playback');
// 4. timeline
ok(DURATION === 18 && x.length === DURATION * SR, `exactly 18 s of audio (${(x.length / SR).toFixed(3)} s)`);
ok(T.listen === 2 && T.challenge === 5 && T.reveal === 12 && T.cta === 15, 'scene cuts at 2 / 5 / 12 / 15 s');
ok(T.clearAt > HEARD[4].t && T.clearAt < T.challenge, `highlights cleared at ${T.clearAt} s, right after the 5th note (${HEARD[4].t} s)`);
ok(ANSWER[4].t < T.cta, 'reveal finishes before the CTA');
// 5. levels: melody louder than every sound effect, countdown quieter than the melody
const rms = (a, b) => { let s = 0; const i0 = Math.round(a * SR), i1 = Math.round(b * SR); for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / (i1 - i0)); };
const db = (v) => 20 * Math.log10(v);
const mel = rms(HEARD[0].t, HEARD[4].t + 0.5), cd = rms(T.challenge + 0.6, T.reveal - 1.2), ctaR = rms(T.q, T.cta + 3 - 0.2);
console.log(`      levels: melody ${db(mel).toFixed(1)} dBFS rms · countdown ${db(cd).toFixed(1)} · call to action ${db(ctaR).toFixed(1)}`);
ok(db(cd) < db(mel) - 8, 'countdown is ≥ 8 dB quieter than the melody');
ok(db(ctaR) < db(mel) - 6, 'UI sounds under the call to action are ≥ 6 dB under the melody');
let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
ok(db(pk) < -1, `no clipping (peak ${db(pk).toFixed(2)} dBFS)`);
console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);
