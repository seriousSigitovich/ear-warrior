#!/usr/bin/env node
// Quality gate for a bouncing-ball cut's soundtrack: the pitch heard at every onset is the melody's, the notes are the checked source, the
// narrator stays out of the melody, levels are sane.   node spring/check.mjs  (after render-spring.mjs; mozart/check.mjs runs it for that cut)
// Sixteenths leave short windows, so the pitch is the semitone whose first four harmonics carry the most energy (an octave error loses).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SPRING from './story.mjs';
import { LINES as SPRING_LINES } from './voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
/** `ref` is the melody as the checked source spells it ("E4:.5 G♯4:.5 …"). Returns the number of failed checks. */
export function checkBounce({ S, LINES, wav, ref }) {
  const { NOTES, MELODY, T, DURATION, FPS } = S;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', wav, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
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

  ok(MELODY.map((n) => `${n.name}:${String(n.beats).replace(/^0/, '')}`).join(' ') === ref, `melody = ${ref}`);
  NOTES.forEach((n, i) => {
    const end = Math.min(n.t + 0.3, NOTES[i + 1] ? NOTES[i + 1].t - 0.01 : n.t + 0.3), got = heard(n.t + 0.04, end);
    ok(got === n.midi, `note ${i + 1} @ ${n.t.toFixed(3)} s: heard MIDI ${got}, expected ${n.name} (${n.midi})`);
  });
  ok(NOTES.every((n) => Math.abs(n.t * FPS - Math.round(n.t * FPS)) < 1e-6), `every onset falls on a whole frame at ${FPS} fps`);
  ok(x.length === DURATION * SR, `exactly ${DURATION} s of audio (${(x.length / SR).toFixed(3)} s)`);
  ok(NOTES.at(-1).t + 0.75 < T.collapse && T.flash + 3 <= DURATION, 'the last note rings out before the fold; the call to action gets ≥ 3 s');

  const rms = (a, b) => { let s = 0; const i0 = Math.round(a * SR), i1 = Math.round(b * SR); for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / (i1 - i0)); };
  const db = (v) => 20 * Math.log10(v);
  const mel = rms(NOTES[0].t, NOTES.at(-1).t + 0.4);
  ok(LINES.every((l) => l.until <= NOTES[0].t || l.at >= NOTES.at(-1).t + 0.5), 'the narrator never speaks over the melody');
  const voice = rms(LINES[1].at, LINES[1].at + 1.2);
  console.log(`      levels: melody ${db(mel).toFixed(1)} dBFS rms · narrator ${db(voice).toFixed(1)}`);
  ok(Math.abs(db(voice) - db(mel)) < 6, 'narrator sits within 6 dB of the melody');
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  ok(db(pk) < -1, `no clipping (peak ${db(pk).toFixed(2)} dBFS)`);
  console.log(fail ? `\n${fail} check(s) FAILED` : '\nall checks passed');
  return fail;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // the same notes as tunes/vivaldi-spring.json (listen + tour), which were checked against the Mutopia MIDI
  const tune = JSON.parse(readFileSync(join(here, '..', 'tunes', 'vivaldi-spring.json'), 'utf8'));
  const ref = `${tune.listen} ${tune.tour}`.replace(/#/g, '♯');
  process.exit(checkBounce({ S: SPRING, LINES: SPRING_LINES, wav: join(here, '..', 'public', 'spring-bounce.wav'), ref }) ? 1 : 0);
}
