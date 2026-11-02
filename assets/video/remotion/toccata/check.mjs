#!/usr/bin/env node
// Quality gate for the Toccata cut's soundtrack: the pitch heard at every melody onset is the note in the timeline, the timeline holds
// together, levels are sane.   node toccata/check.mjs  (after render-toccata.mjs --audio-only)
// Eighth notes leave short windows, so the pitch is the semitone whose first four harmonics carry the most energy (an octave error loses).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEARD, MELODY, T, DURATION, TUNING, midiAt } from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', join(here, '..', 'public', 'toccata-minimal.wav'), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
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
ok(MELODY.every((n) => n.midi === midiAt(n.string, n.fret)), 'every note maps string+fret → its MIDI');
ok(MELODY.map((n) => n.name).join(' ') === 'A3 G3 A3 G3 F3 E3 D3 C#3 D3', `melody = ${MELODY.map((n) => n.name).join(' ')}`);
ok(Math.max(...MELODY.map((n) => n.fret)) <= 4, 'first position: frets 0–4');
HEARD.forEach((n, i) => {
  const end = Math.min(n.t + 0.3, HEARD[i + 1] ? HEARD[i + 1].t - 0.01 : n.t + 0.3), got = heard(n.t + 0.05, end);
  ok(got === n.midi, `note ${i + 1} @ ${n.t.toFixed(3)} s: heard MIDI ${got}, timeline says ${n.name} (${n.midi})`);
});
ok(x.length === Math.round(DURATION * SR), `exactly ${DURATION} s of audio (${(x.length / SR).toFixed(3)} s)`);
ok(HEARD.at(-1).t + 0.3 < T.hold && T.hold < T.cta, `last note at ${HEARD.at(-1).t.toFixed(2)} s rings before the swing at ${T.hold}`);
ok(T.comment + 1.6 <= DURATION, 'the comment call stays ≥ 1.6 s on screen (the loop shows it again)');

const rms = (a, b) => { let s = 0; const i0 = Math.round(a * SR), i1 = Math.round(b * SR); for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / (i1 - i0)); };
const db = (v) => 20 * Math.log10(v);
const mel = rms(HEARD[0].t, HEARD.at(-1).t + 0.4), cta = rms(T.cta + 0.6, DURATION - 0.2);
console.log(`      levels: melody ${db(mel).toFixed(1)} dBFS rms · call to action ${db(cta).toFixed(1)}`);
ok(db(cta) < db(mel) - 6, 'UI sounds under the call to action are ≥ 6 dB under the melody');
let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
ok(db(pk) < -1, `no clipping (peak ${db(pk).toFixed(2)} dBFS)`);
console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);
