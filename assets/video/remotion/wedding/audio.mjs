// Soundtrack of the wedding episode: reception chatter + the band's last bar (groove, roll, hit), the newlyweds' entrance, two sour tries on the
// electric guitar, a quiet room with a few crickets while the bouquet wilts, then the Wedding March by ear on the bass — alone for the first
// line, with a march (kick, snare, claps) from bar 3, a big C chord and crash on the reprise — and the first notes again on an acoustic guitar
// under the end card. Voices (wedding/voice/) and crowd clips (pain/voice/crowd-*) on top; the band ducks under every spoken line. −14 LUFS.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { track, pluck, sub, tick, whoosh, pad, guitarNote, writeWav, SR } from '../../synth.mjs';
import { kick, noise, snare, bass } from '../jam/audio.mjs';
import { DURATION, T, OPEN_KICKS, OPEN_SNARES, OPEN_HATS, OPEN_FILL, OPEN_BASS, LEAD, W_KICKS, W_SNARES, W_HATS, CLAPS, HIT_CHORDS, TRIES, REPLAY, LINES, REACTS } from './story.mjs';
import { voicePath } from './voice.mjs';
import { crowdPath } from '../pain/voice.mjs';

/** Amp + cabinet: tanh drive, two one-pole low-pass stages, a thin low cut (as in ep. 1). */
function amp(buf, drive, cab = 0.42) {
  const o = new Float32Array(buf.length);
  let a = 0, b = 0, hp = 0;
  for (let i = 0; i < buf.length; i++) { a += cab * (Math.tanh(drive * buf[i]) - a); b += cab * (a - b); hp += 0.006 * (b - hp); o[i] = b - hp; }
  return o;
}
/** A hand clap: three quick noise bursts, band-passed. */
function clap(seed) {
  const n = noise(0.16, 30, 0.8, seed), o = new Float32Array(n.length);
  for (let i = 0; i < n.length; i++) { const t = i / SR, burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 ? 0.4 : 1) : 1; o[i] = n[i] * burst; }
  return o;
}
/** A cricket: a few 4.6 kHz chirps. */
function cricket() {
  const total = Math.round(0.42 * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) { const t = i / SR, k = Math.floor(t / 0.07), u = t - k * 0.07; o[i] = k < 5 && u < 0.04 ? Math.sin(2 * Math.PI * 4600 * t) * Math.sin(Math.PI * u / 0.04) : 0; }
  return o;
}
/** Petals: a soft breath of noise. */
function blow() {
  const n = noise(0.6, 4, 0.3, 0xb10b), o = new Float32Array(n.length);
  let lp = 0;
  for (let i = 0; i < n.length; i++) { const t = i / SR; lp += 0.08 * (n[i] - lp); o[i] = lp * Math.min(1, t / 0.08); }
  return o;
}
/** An mp3 (voice line / crowd clip) → mono Float32 at SR, through an optional ffmpeg filter. */
function decode(file, af) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

export function renderWeddingAudio(outPath) {
  const band = track(DURATION), voices = track(DURATION);
  const mix = band.mix, k = kick(), sn = snare(), hat = noise(0.05, 80, 0.93, 0x13579bd);

  // the band's last bar: groove, roll, hit + crash
  for (const t of OPEN_KICKS) mix(k, t, 0.85);
  for (const t of OPEN_SNARES) mix(sn, t, 0.55);
  for (const t of OPEN_HATS) mix(hat, t, 0.11);
  for (const n of OPEN_BASS) mix(bass(n.midi, n.dur), n.t, 0.75);
  OPEN_FILL.forEach((t, i) => mix(sn, t, 0.45 + 0.12 * i));
  mix(k, T.endHit, 1.0); mix(sn, T.endHit, 0.7); mix(bass(36, 0.9, 900), T.endHit, 0.9); mix(noise(1.2, 3.2, 0.9, 0x777777), T.endHit, 0.26);
  mix(whoosh(0.35), T.couple - 0.05, 0.1);                                                      // the newlyweds step in

  // the two tries: clean-ish single notes on the electric, the last one sour, a low thud under it
  for (const tr of TRIES) tr.notes.forEach(([o, m], i) => {
    mix(amp(pluck(m, i === 2 ? 0.7 : 0.3, 0xbad + i * 131), 3.0, 0.5), tr.t + o, i === 2 ? 0.75 : 0.55);
    if (i === 2) { mix(amp(pluck(m + 1, 0.7, 0xfeed), 3.0, 0.5), tr.t + o + 0.004, 0.45); mix(sub(28, 0.4), tr.t + o, 0.45); }   // a semitone rub = sour
  });

  // the phone: taps while he types (Phone in WeddingScene types from phone+0.35 for 0.35 s), a dull 'bonk' when the sign-up wall pops
  for (let i = 0; i < 9; i++) mix(tick(3400 + 300 * (i % 3), 0.03), T.phone + 0.36 + i * 0.038, 0.18);
  mix(sub(40, 0.25), T.phone + 1.15, 0.5); mix(tick(900, 0.12), T.phone + 1.15, 0.35);
  // the quiet room: crickets
  [T.freeze + 0.5, T.freeze + 1.15].forEach((t) => mix(cricket(), t, 0.07));

  // the Wedding March on the bass, brighter than a walk so it speaks on a phone
  for (const n of LEAD) mix(bass(n.midi, n.dur, 1300), n.t, 1.0);
  // from bar 3: the march + claps
  for (const t of W_KICKS) mix(k, t, 0.65);
  for (const t of W_SNARES) mix(sn, t, 0.32);
  for (const t of W_HATS) mix(hat, t, 0.08);
  CLAPS.forEach((t, i) => mix(clap(0x51ab + i * 7), t, 0.24));
  // the reprise: whoosh, kick + snare, crash, the room's chord, the bouquet's petals
  mix(whoosh(0.5), T.hit - 0.5, 0.22);
  mix(k, T.hit, 1.0); mix(sn, T.hit, 0.7); mix(sub(36, 0.8), T.hit, 0.5);
  mix(noise(1.6, 2.4, 0.9, 0x777777), T.hit, 0.3);
  for (const c of HIT_CHORDS) mix(pad(c.notes, c.dur), c.t, 0.09);
  mix(blow(), T.hit - 0.05, 0.25);

  // the end card: the first notes on an acoustic guitar
  for (const n of REPLAY) mix(guitarNote(n.midi, n.dur + 0.25), n.t, 3.2);
  mix(pad([48, 52, 55], 4.6), T.card + 0.2, 0.08);                                           // a quiet bed so the card isn't a hole

  // voices + crowd; the band ducks −7 dB under each line
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
