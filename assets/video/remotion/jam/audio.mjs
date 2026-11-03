// Soundtrack of the jam episode: stick count-in, a shuffle (kick/snare/swung hats), a walking boogie bass, two wrong guitar strums, the bassist's
// lick, a drum roll and a big A hit with a crash — all at the times in story.mjs — plus the voices (jam/voice/) and crowd reactions from the pain
// sketch (pain/voice/crowd-*), ducking the band under every spoken line. Loudness-normalised to −14 LUFS like the other Shorts.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { track, pluck, sub, tick, whoosh, writeWav, SR } from '../../synth.mjs';
import { DURATION, T, BASS, LEAD, KICKS, SNARES, HATS, FILL, MISSES, LINES, REACTS } from './story.mjs';
import { voicePath } from './voice.mjs';
import { crowdPath } from '../pain/voice.mjs';

/** Amp + cabinet: tanh drive, two one-pole low-pass stages, a thin low cut (same voicing as the warrior riff). */
function amp(buf, drive, cab = 0.42) {
  const o = new Float32Array(buf.length);
  let a = 0, b = 0, hp = 0;
  for (let i = 0; i < buf.length; i++) {
    a += cab * (Math.tanh(drive * buf[i]) - a);
    b += cab * (a - b);
    hp += 0.006 * (b - hp);
    o[i] = b - hp;
  }
  return o;
}
export function kick(len = 0.3) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) { const t = i / SR; ph += (2 * Math.PI * (46 + 120 * Math.exp(-t * 30))) / SR; o[i] = Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.002); }
  return o;
}
export function noise(len, decay, hp, seed) {
  const total = Math.round(len * SR), o = new Float32Array(total);
  let s = seed, prev = 0;
  for (let i = 0; i < total; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; const n = ((s >>> 0) / 0xffffffff) * 2 - 1; o[i] = (n - prev * hp) * Math.exp(-(i / SR) * decay); prev = n; }
  return o;
}
export function snare() {
  const n = noise(0.22, 20, 0.5, 0x2468ace), o = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) { const t = i / SR; o[i] = n[i] * 0.85 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 22) * 0.6; }
  return o;
}
/**
 * Fingered electric bass: the fundamental + 2nd/3rd harmonics with a plucked envelope, a short finger thump, soft saturation and a two-stage
 * low-pass (`fc` Hz) so nothing rings above the bass register. No Karplus pluck: an octave-up plucked string read as a second guitar.
 * The lick uses a higher `fc` and more 2nd harmonic so it speaks on phone speakers, but stays a bass.
 */
export function bass(midi, dur, fc = 650) {
  const f = 440 * Math.pow(2, (midi - 69) / 12), len = dur + 0.06, total = Math.round(len * SR), o = new Float32Array(total);
  const h2 = fc > 900 ? 0.55 : 0.35, a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let s = 0x5eed + midi, lp1 = 0, lp2 = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR, env = Math.min(1, t / 0.004) * Math.exp(-t * 2.2) * Math.min(1, (len - t) / 0.05);
    const ph = 2 * Math.PI * f * t;
    let x = (Math.sin(ph) + h2 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph)) * env;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    x += (((s >>> 0) / 0xffffffff) * 2 - 1) * 0.5 * Math.exp(-t * 180);                // finger thump
    x = Math.tanh(1.6 * x);
    lp1 += a * (x - lp1); lp2 += a * (lp1 - lp2);
    o[i] = lp2;
  }
  return o;
}
/** A clean-ish electric strum (low to high, 9 ms apart). */
function strum(notes, dur) {
  const total = Math.round((dur + 0.1) * SR), o = new Float32Array(total);
  notes.forEach((m, k) => { const p = pluck(m, dur, 0xbad + k * 131), off = Math.round(k * 0.009 * SR); for (let i = 0; i < p.length && off + i < total; i++) o[off + i] += p[i]; });
  return amp(o, 3.5, 0.5);
}
/** An mp3 (voice line / crowd clip) → mono Float32 at SR, through an optional ffmpeg filter. */
function decode(file, af) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

export function renderJamAudio(outPath) {
  const band = track(DURATION), voices = track(DURATION);
  const mix = band.mix, k = kick(), sn = snare(), hat = noise(0.05, 80, 0.93, 0x13579bd), ride = noise(0.1, 26, 0.93, 0x7531);

  T.count.forEach((t, i) => mix(tick(i === 3 ? 2600 : 2200, 0.08), t, 0.55));                       // sticks
  for (const t of KICKS) mix(k, t, 0.85);
  for (const t of SNARES) mix(sn, t, 0.55);
  HATS.forEach((t, i) => mix(i % 2 ? hat : ride, t, i % 2 ? 0.11 : 0.09));
  FILL.forEach((t, i) => mix(sn, t, 0.45 + 0.12 * i));
  for (const n of BASS) mix(bass(n.midi, n.dur * 0.95), n.t, 0.75);

  // the two misses: a sour strum, a low thud under it, the strings choked after a beat
  for (const m of MISSES) { mix(strum(m.notes, 0.55), m.t, 0.7); mix(sub(28, 0.4), m.t, 0.5); }

  // the lick: the same bass, a little brighter and louder than the walk
  for (const n of LEAD) mix(bass(n.midi, n.dur, 1100), n.t, 1.0);

  // the hit: whoosh into it, bass octave A, kick + snare, crash, sub boom
  mix(whoosh(0.5), T.hit - 0.5, 0.25);
  mix(bass(33, 1.4, 900), T.hit, 1.0);
  mix(bass(45, 1.2, 900), T.hit + 0.01, 0.6);
  mix(k, T.hit, 1.0); mix(sn, T.hit, 0.8); mix(sub(28, 0.8), T.hit, 0.6);
  mix(noise(1.4, 2.8, 0.9, 0x777777), T.hit, 0.32);

  // voices + crowd; the band ducks −7 dB under each line (40 ms attack, 200 ms release)
  const duck = new Float32Array(band.out.length).fill(1);
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
  const out = new Float32Array(band.out.length);
  for (let s = 0; s < out.length; s++) { g += (duck[s] - g) * (duck[s] < g ? 0.0006 : 0.00012); out[s] = band.out[s] * g + voices.out[s]; }
  const fade = Math.round(0.4 * SR);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;

  const raw = outPath + '.raw.wav';
  const peak = writeWav(raw, out);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', String(SR), '-ac', '1', outPath]);
  execFileSync('rm', [raw]);
  return { peak, voiced };
}
