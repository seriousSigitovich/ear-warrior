// Soundtrack of the campfire episode: fire crackle and crickets, a dull "bonk" when the page will not load, two sour chords, whooshes on the
// cuts, then the app: the phrase it plays by itself, twelve guitar taps (the same notes as the picture), a buzzer on the miss, a bell on
// "Correct", a tick per day; back at camp the whole Rising Sun arpeggio, a room cheering, a bed under the end card. Voices (camp/voice/) and
// crowd clips (pain/voice/crowd-*) on top; the music ducks under every spoken line. −14 LUFS like the others.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { track, sub, tick, whoosh, pad, bell, guitarNote, writeWav, SR } from '../../synth.mjs';
import { noise } from '../jam/audio.mjs';
import { DURATION, T, LINES, REACTS, SOUR, STRUM_GAP, TAPS, HEARD, MOMENTS, PLAY, PLAY_END } from './story.mjs';
import { voicePath } from './voice.mjs';
import { crowdPath } from '../pain/voice.mjs';

function decode(file, af) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** Fire: a low rumble of filtered noise with random pops. */
function fire(dur, seed) {
  const n = Math.round(dur * SR), o = new Float32Array(n), r = rnd(seed);
  let lp = 0;
  for (let i = 0; i < n; i++) { lp += 0.012 * ((r() * 2 - 1) - lp); o[i] = lp * 2.2; }
  for (let k = 0; k < dur * 9; k++) {
    const at = Math.floor(r() * (n - 900)), len = 120 + Math.floor(r() * 500), g = 0.25 + r() * 0.6;
    for (let i = 0; i < len; i++) o[at + i] += (r() * 2 - 1) * g * Math.exp(-i / (len * 0.25)) * 0.35;
  }
  return o;
}
function cricket() {
  const total = Math.round(0.42 * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) { const t = i / SR, k = Math.floor(t / 0.07), u = t - k * 0.07; o[i] = k < 5 && u < 0.04 ? Math.sin(2 * Math.PI * 4600 * t) * Math.sin(Math.PI * u / 0.04) : 0; }
  return o;
}
function clap(seed) {
  const n = noise(0.16, 30, 0.8, seed), o = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) { const t = i / SR, burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.4 : 1) : 1; o[i] = n[i] * burst; }
  return o;
}
/** A buzzer for a miss: two close low tones beating against each other. */
function buzz(dur) {
  const n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.exp(-t * 6); o[i] = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 116.5 * t)) * 0.5 * e * Math.min(1, t / 0.005); }
  return o;
}

export function renderCampAudio(outPath) {
  const music = track(DURATION), voices = track(DURATION), mix = music.mix;

  // the fire under both camp scenes, a few crickets in the quiet
  mix(fire(T.day + 0.2, 0xf1e), 0, 0.16);
  mix(fire(DURATION - T.camp2 + 0.3, 0xf2e), T.camp2 - 0.3, 0.16);
  [T.sour2 + 0.7, T.sour2 + 1.1, T.camp2 + 0.2].forEach((t) => mix(cricket(), t, 0.06));

  // the phone: it will not load
  mix(sub(46, 0.3), T.songs + 0.15, 0.55); mix(tick(900, 0.12), T.songs + 0.15, 0.3);
  // two sour chords, strummed low → high
  SOUR.forEach((c, k) => c.notes.forEach((m, i) => mix(guitarNote(m, 0.9), c.t + i * STRUM_GAP, k ? 1.7 : 1.9)));

  // DAY 1
  mix(whoosh(0.35), T.day - 0.3, 0.22); mix(sub(40, 0.5), T.day, 0.7); mix(noise(0.5, 4, 0.9, 0x7a7a), T.day, 0.12);
  // cuts
  [T.gone - 0.05, T.camp2 - 0.05, T.hear - 0.1, T.later - 0.05].forEach((t) => mix(whoosh(0.22), t, 0.14));

  // the app. It plays the first phrase by itself …
  for (const n of HEARD) mix(guitarNote(n.midi, 0.4), n.t, 1.5);
  // … a miss …
  mix(buzz(0.5), MOMENTS.miss, 0.5);
  // … twelve taps, each one sounding …
  for (const n of TAPS) mix(guitarNote(n.midi, 0.35), n.t, 1.9);
  // … "Correct": a bell and a pop, +XP, a tick per day
  mix(bell(81, 1.2), MOMENTS.correct, 0.35); mix(bell(88, 1.4), MOMENTS.correct + 0.12, 0.3);
  mix(tick(2600, 0.04), MOMENTS.correct + 0.45, 0.25);
  for (let i = 0; i < 7; i++) mix(tick(1800 + i * 160, 0.05), T.later + 0.2 + i * 0.15, 0.3);

  // camp again: the whole arpeggio by ear, every note let ring
  for (const n of PLAY) mix(guitarNote(n.midi, 1.6, 0.5), n.t, 1.9);
  // the room
  mix(pad([45, 52, 57, 64], 3.5), PLAY_END - 0.2, 0.07);
  for (let i = 0; i < 8; i++) mix(clap(0x51ab + i * 7), PLAY_END + 0.3 + i * 0.16 + (i % 3) * 0.03, 0.2);
  mix(whoosh(0.3), T.card - 0.15, 0.2);
  mix(pad([45, 52, 57, 60], 2.5), T.card + 0.1, 0.07);

  // voices + crowd; the music ducks −7 dB under each line
  const duck = new Float32Array(music.out.length).fill(1);
  let voiced = 0;
  LINES.forEach((line, i) => {
    if (!existsSync(voicePath(i))) return;
    const v = decode(voicePath(i), 'highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80');
    voices.mix(v, line.at, line.who === 'friend' ? 1.0 : 1.1);
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
