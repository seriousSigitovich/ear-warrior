// Soundtrack of ep. 3: party chatter, the motif on the bass (jam/audio.mjs bass), his answers on a nylon guitar — the app's own note clips
// (assets/app/audio/notes/<midi>.m4a), so the guitar he trains on is the guitar he plays — a sour E with a thud, crickets while he's frozen;
// that night the app's real sounds at the times in learn/app.mjs (the first-melody clip on Listen, one note clip per tap, a soft tick on
// Check, a chime when it's right); a ticking day counter; the second take with claps and a crash on the last note. Voices + crowd on top,
// music ducks under each line. −14 LUFS like the others.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { track, sub, tick, whoosh, pad, bell, writeWav, SR } from '../../synth.mjs';
import { kick, noise, snare, bass } from '../jam/audio.mjs';
import { DURATION, T, CALL, CALL2, TRY, ANSWER, LINES, REACTS } from './story.mjs';
import { voicePath } from './voice.mjs';
import { crowdPath } from '../pain/voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const APP_AUDIO = join(here, '..', '..', '..', 'app', 'audio');
import APP from './app.mjs';

function decode(file, af) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
const noteCache = new Map();
/** The app's nylon clip for `midi`, cut to `dur` s with a 60 ms release. */
function nylon(midi, dur = 1.2) {
  if (!noteCache.has(midi)) noteCache.set(midi, decode(join(APP_AUDIO, 'notes', `${midi}.m4a`)));
  const src = noteCache.get(midi), n = Math.min(src.length, Math.round((dur + 0.06) * SR)), o = new Float32Array(n), rel = Math.round(0.06 * SR);
  for (let i = 0; i < n; i++) o[i] = src[i] * (i > n - rel ? (n - i) / rel : 1);
  return o;
}
function cricket() {
  const total = Math.round(0.42 * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) { const t = i / SR, k = Math.floor(t / 0.07), u = t - k * 0.07; o[i] = k < 5 && u < 0.04 ? Math.sin(2 * Math.PI * 4600 * t) * Math.sin(Math.PI * u / 0.04) : 0; }
  return o;
}
function clap(seed) {
  const n = noise(0.16, 30, 0.8, seed), o = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) { const t = i / SR; o[i] = n[i] * (t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.4 : 1) : 1); }
  return o;
}

export function renderLearnAudio(outPath) {
  const music = track(DURATION), voices = track(DURATION), mix = music.mix;
  const k = kick(), sn = snare();

  // first take: the call on the bass, his answer on nylon — three right, a sour E (+ a semitone rub and a thud)
  for (const n of CALL) mix(bass(n.midi, n.dur, 1300), n.t, 1.0);
  TRY.forEach((n, i) => {
    mix(nylon(n.midi, n.dur + 0.3), n.t, 1.4);
    if (i === 3) { mix(nylon(n.midi + 1, 0.7), n.t + 0.006, 0.9); mix(sub(28, 0.4), n.t, 0.5); }
  });
  [T.freeze + 0.4, T.freeze + 1.05].forEach((t) => mix(cricket(), t, 0.07));

  // that night: the app's sounds, from the recording's marks
  mix(whoosh(0.4), T.night - 0.2, 0.18);
  for (const s of APP.sounds) {
    const at = T.app + s.at;
    if (s.clip) mix(decode(join(APP_AUDIO, 'melodies', `${s.clip}.m4a`)), at, 1.3);
    else if (s.midi) mix(nylon(s.midi, 0.9), at, 1.3);
    else if (s.tick) mix(tick(2600, 0.04), at, 0.25);
    else if (s.right) { mix(bell(84, 0.5), at, 0.12); mix(bell(88, 0.7), at + 0.09, 0.12); }
    else if (s.wrong) mix(sub(40, 0.25), at, 0.35);
  }
  mix(pad([51, 55, 58], APP_LEN_PAD()), T.night, 0.045);                                    // a quiet E♭ bed under the night
  // DAY 1 → 14: a tick per day
  for (let d = 0; d < 13; d++) mix(tick(3000 + 80 * d, 0.03), T.days + 1.3 * Math.pow(d / 13, 0.75), 0.2);

  // second take: the call, his answer (right, on nylon), a soft kick under every note, claps from the second half, crash on the last
  mix(whoosh(0.4), T.back - 0.2, 0.18);
  for (const n of CALL2) mix(bass(n.midi, n.dur, 1300), n.t, 1.0);
  ANSWER.forEach((n, i) => { mix(nylon(n.midi, n.dur + 0.3), n.t, 1.5); if (i === 3 || i === 7) mix(k, n.t, 0.5); });
  mix(k, T.cheer, 1.0); mix(sn, T.cheer, 0.7); mix(noise(1.6, 2.4, 0.9, 0x777777), T.cheer, 0.3); mix(pad([43, 50, 55, 59], 1.6), T.cheer, 0.08);
  for (let i = 0; i < 10; i++) mix(clap(0x51ab + i * 7), T.cheer + 0.15 + i * 0.16 + 0.03 * Math.sin(i * 3), 0.25);
  // end card: the motif once more on nylon, quiet
  ANSWER.forEach((n) => mix(nylon(n.midi, n.dur + 0.2), T.card + 0.5 + (n.t - T.answer), 0.9));

  // voices + crowd; music ducks −7 dB under each line
  const duck = new Float32Array(music.out.length).fill(1);
  let voiced = 0;
  LINES.forEach((line, i) => {
    if (!existsSync(voicePath(i))) return;
    const v = decode(voicePath(i), 'highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80');
    voices.mix(v, line.at, line.who === 'bassist' ? 1.0 : 1.1);
    const a = Math.round(line.at * SR), b = a + v.length;
    for (let s = a - 0.04 * SR; s < b + 0.2 * SR; s++) if (s >= 0 && s < duck.length) duck[s] = Math.min(duck[s], 0.45);
    voiced++;
  });
  for (const r of REACTS) if (existsSync(crowdPath(r.crowd))) voices.mix(decode(crowdPath(r.crowd), 'highpass=f=140,lowpass=f=6000,aecho=0.8:0.7:70|140:0.3|0.18'), r.t, r.gain);
  let g = 1;
  const out = new Float32Array(music.out.length);
  for (let s = 0; s < out.length; s++) { g += (duck[s] - g) * (duck[s] < g ? 0.0006 : 0.00012); out[s] = music.out[s] * g + voices.out[s]; }
  const fade = Math.round(0.4 * SR);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;

  const raw = outPath + '.raw.wav';
  const peak = writeWav(raw, out);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', String(SR), '-ac', '1', outPath]);
  execFileSync('rm', [raw]);
  return { peak, voiced };
}
const APP_LEN_PAD = () => T.back - T.night;
