// Soundtrack for one resolved tune: the melody on the recorded acoustic guitar (../synth.mjs) + a "janissary" pulse — kick every beat,
// shaker on the off-beats, a "tss" on the second beat — a riser, and at 6.0 s a chord stab with a crash.
import { track, guitarNote, pluck, writeWav, SR } from '../synth.mjs';
import { DURATION_SEC, SCENE } from './tune.mjs';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function kick(len = 0.28) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR, f = 48 + 120 * Math.exp(-t * 28);          // pitch drop = the "thump"
    ph += (2 * Math.PI * f) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.002);
  }
  return o;
}
function noiseBurst(len, decay, hp = 0.9) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let s = 0x1234567, prev = 0;
  for (let i = 0; i < total; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const n = ((s >>> 0) / 0xffffffff) * 2 - 1;
    o[i] = (n - prev * hp) * Math.exp(-(i / SR) * decay); prev = n;   // crude high-pass → "tsss"
  }
  return o;
}

/** A rendered band take (mp3/wav, any rate) → mono Float32 at SR. */
function decode(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

/** Seconds [a, b) of `x`, with short fades at both ends so a cut never clicks. */
function slice(x, a, b, fadeIn = 0.004, fadeOut = 0.04) {
  const o = x.slice(Math.round(a * SR), Math.round(b * SR));
  const ni = Math.min(o.length >> 1, Math.round(fadeIn * SR)), no = Math.min(o.length >> 1, Math.round(fadeOut * SR));
  for (let i = 0; i < ni; i++) o[i] *= i / ni;
  for (let i = 0; i < no; i++) o[o.length - 1 - i] *= i / no;
  return o;
}

/**
 * A tune with `band: { file, bpm }` is played by a rendered band take (guitar + drums, assets/solo/beautiful, rendered at the tune's own tempo so
 * one bar is one 2 s scene). It plays in ONE piece through scenes 1 and 2 — no cuts, no gaps — then the learner's answer is acoustic taps on the same
 * 8th grid (what the app plays when you tap a fret), and the rest of the take lands on the very next 8th at the stinger as the reward.
 */
function renderBandAudio(tune, outPath) {
  const sp = 60 / tune.band.bpm, intro = 8 * sp;
  const take = decode(join(dirname(fileURLToPath(import.meta.url)), tune.band.file));
  const { out, mix } = track(tune.durationSec);
  mix(slice(take, 0, intro + 0.12, 0.002, 0.12), 0, 0.9);                       // scenes 1–2; the last note rings under the first tap
  for (const n of tune.notes) if (n.phase === 'answer') mix(guitarNote(n.midi, n.dur * 1.1, 0.12), n.t, 1.3);
  const end = tune.durationSec - tune.stingerAt, reward = slice(take, intro, Math.min(take.length / SR, intro + end), 0.002, 0.6);
  mix(reward, tune.stingerAt, 0.9);
  mkdirSync(dirname(outPath), { recursive: true });
  const peak = writeWav(outPath, out);
  // a band take has quiet taps between loud hits: bring the whole soundtrack to social-video loudness
  const raw = outPath + '.raw.wav';
  execFileSync('mv', [outPath, raw]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', String(SR), outPath]);
  execFileSync('rm', [raw]);
  return peak;
}

export function renderAudio(tune, outPath) {
  if (tune.band) return renderBandAudio(tune, outPath);
  const { out, mix } = track(DURATION_SEC);
  for (const n of tune.notes) {
    const short = n.dur < 0.2;
    mix(guitarNote(n.midi, n.dur * (short ? 1.05 : 1.1), short ? 0.03 : 0.2), n.t, 0.9);
    if (n.dur >= 0.4) mix(pluck(n.midi + 12, 0.5), n.t, 0.12);  // quiet octave sparkle on the long notes
  }
  const k = kick(), hat = noiseBurst(0.07, 60), clap = noiseBurst(0.12, 28);
  for (let b = 0; b * tune.beat < tune.stingerAt - 1e-6; b++) {
    const t = b * tune.beat;
    mix(k, t, b % 2 === 0 ? 0.95 : 0.6);
    mix(hat, t + tune.beat / 2, 0.22);
    if (b % 2 === 1) mix(clap, t, 0.18);
  }
  const rise = noiseBurst(0.5, 1.5, 0.6);
  for (let i = 0; i < rise.length; i++) rise[i] *= i / rise.length;
  mix(rise, tune.stingerAt - 0.5, 0.25);
  tune.chord.forEach((m, i) => mix(guitarNote(m, 1.0, 0.45), tune.stingerAt + i * 0.018, 0.7));
  mix(kick(0.4), tune.stingerAt, 1.0);
  mix(noiseBurst(0.9, 5, 0.85), tune.stingerAt, 0.28);
  mkdirSync(dirname(outPath), { recursive: true });
  return writeWav(outPath, out);
}
