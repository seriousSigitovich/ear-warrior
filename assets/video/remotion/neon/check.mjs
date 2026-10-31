#!/usr/bin/env node
// Quality gate for the neon cut's soundtrack: the pitch heard at every melody onset (first playback AND reveal) is the pitch of the
// string/fret drawn, the reveal repeats the first playback, the timeline holds together, levels are sane.   node neon/check.mjs  (after render-neon.mjs)
// Eighth notes leave short windows, so the pitch is the semitone whose first four harmonics carry the most energy (an octave error loses).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEARD, ANSWER, MELODY, T, DURATION, TUNING, PHRASE, TICKS, midiAt } from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', join(here, '..', 'public', 'ten-neon.wav'), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function power(f, a, b) {
  const w = (2 * Math.PI * f) / SR, c = 2 * Math.cos(w), i0 = Math.round(a * SR), n = Math.round(b * SR) - i0;
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const s = x[i0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)) + c * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}
const heard = (a, b) => {
  let best = 0, bp = -Infinity;
  for (let m = 40; m <= 84; m++) { const p = [1, 2, 3, 4].reduce((s, h) => s + Math.log(1e-12 + power(hz(m) * h, a, b)), 0); if (p > bp) { bp = p; best = m; } }
  return best;
};

let fail = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fail++; };

ok(TUNING.join() === '40,45,50,55,59,64', 'standard tuning E2 A2 D3 G3 B3 E4');
ok(MELODY.every((n) => n.midi === midiAt(n.string, n.fret)), 'every displayed note maps string+fret → its MIDI');
ok(MELODY.map((n) => n.name).join(' ') === 'F4 C4 D4 A3 C4 G3 A3 G3 F3 C3', `melody = ${MELODY.map((n) => n.name).join(' ')}`);
ok(Math.max(...MELODY.map((n) => n.fret)) <= 3, 'first position: frets 0–3');
for (const [label, list] of [['listen', HEARD], ['reveal', ANSWER]]) {
  list.forEach((n, i) => {
    const end = Math.min(n.t + 0.3, list[i + 1] ? list[i + 1].t - 0.01 : n.t + 0.3), got = heard(n.t + 0.05, end);
    ok(got === n.midi, `${label} note ${i + 1} @ ${n.t.toFixed(3)} s: heard MIDI ${got}, board shows ${n.name} (${n.midi})`);
  });
}
ok(HEARD.every((n, i) => Math.abs(n.t - HEARD[0].t - (ANSWER[i].t - ANSWER[0].t)) < 1e-9 && n.midi === ANSWER[i].midi), 'reveal = same pitches, same rhythm as the first playback');
ok(x.length === DURATION * SR, `exactly ${DURATION} s of audio (${(x.length / SR).toFixed(3)} s)`);
ok(HEARD.at(-1).t < T.clearAt && T.clearAt < T.challenge, `melody (${PHRASE.toFixed(2)} s) ends at ${HEARD.at(-1).t.toFixed(2)} s, cleared at ${T.clearAt}, before the countdown at ${T.challenge}`);
ok(TICKS.length === 7 && Math.abs(T.reveal - T.challenge - 7) < 1e-9, 'countdown is 7 whole seconds');
ok(ANSWER.at(-1).t + 0.4 < T.cta && T.cta + 3 <= DURATION, 'reveal finishes before the call to action, which gets ≥ 3 s');

const rms = (a, b) => { let s = 0; const i0 = Math.round(a * SR), i1 = Math.round(b * SR); for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / (i1 - i0)); };
const db = (v) => 20 * Math.log10(v);
const mel = rms(HEARD[0].t, HEARD.at(-1).t + 0.4), cd = rms(T.challenge + 0.6, T.reveal - 1.2), cta = rms(T.q, DURATION - 0.2);
console.log(`      levels: melody ${db(mel).toFixed(1)} dBFS rms · countdown ${db(cd).toFixed(1)} · call to action ${db(cta).toFixed(1)}`);
ok(db(cd) < db(mel) - 8, 'countdown is ≥ 8 dB quieter than the melody');
ok(db(cta) < db(mel) - 6, 'UI sounds under the call to action are ≥ 6 dB under the melody');
let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
ok(db(pk) < -1, `no clipping (peak ${db(pk).toFixed(2)} dBFS)`);
console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);
