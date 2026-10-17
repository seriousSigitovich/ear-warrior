// Soundtrack for one resolved tune: the melody on the recorded acoustic guitar (../synth.mjs) + a "janissary" pulse — kick every beat,
// shaker on the off-beats, a "tss" on the second beat — a riser, and at 6.0 s a chord stab with a crash.
import { track, guitarNote, pluck, writeWav, SR } from '../synth.mjs';
import { DURATION_SEC } from './tune.mjs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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

export function renderAudio(tune, outPath) {
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
