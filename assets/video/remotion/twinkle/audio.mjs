// Soundtrack of ep. 4: Emma's xylophone (a bright struck bar: three inharmonic partials, a click of mallet), Tab Guy's guitar (the app's nylon
// samples), two sour dyads, a paywall thud, the app (the phrase it plays, seven taps, a buzzer on the miss, a bell on "Correct"), whooshes on the
// camera moves, a soft boing on each hop. Voices (twinkle/voice/) on top; the narrator is highpassed and compressed, Emma is pitched up
// (voice.ai has no child voice). −14 LUFS like the others.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { track, sub, tick, whoosh, pad, bell, guitarNote, writeWav, SR, hz } from '../../synth.mjs';
import { noise } from '../jam/audio.mjs';
import { DURATION, T, LINES, EMMA1, EMMA2, REPLAY_E, REPLAY_G, GUITAR1, GUITAR2, SOUR, APP, APP_HEARD, APP_TAPS } from './story.mjs';
import { voicePath } from './voice.mjs';

const PITCH_EMMA = 1.3;   // a mild lift: Ellie is the youngest public voice, a bigger shift sounds like a chipmunk
function decode(file, af) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
/** A struck xylophone bar. */
function xylo(midi, dur = 0.9) {
  const f = hz(midi), n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    o[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 7) + 0.32 * Math.sin(2 * Math.PI * f * 3.97 * t) * Math.exp(-t * 16) + 0.12 * Math.sin(2 * Math.PI * f * 9.2 * t) * Math.exp(-t * 34)) * Math.min(1, t / 0.0015);
  }
  const click = noise(0.012, 3, 0.8, 0x77 + midi);
  for (let i = 0; i < click.length && i < n; i++) o[i] += click[i] * 0.35;
  return o;
}
/** A soft "boing": a short sine gliding up. */
function boing(dur = 0.28) {
  const n = Math.round(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur; ph += 2 * Math.PI * (260 + 520 * Math.sin(u * Math.PI * 0.5)) / SR; o[i] = Math.sin(ph) * Math.exp(-u * 4) * Math.min(1, t / 0.004) * 0.6; }
  return o;
}
/** A short sine beep with a soft edge. */
function beep(f, dur) {
  const n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.004, (dur - t) / 0.02); }
  return o;
}
/** The phone dying: a tone that slides down and fades (a power-down). */
function powerDown(dur) {
  const n = Math.round(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur; ph += 2 * Math.PI * (900 * Math.pow(0.08, u) + 60) / SR; o[i] = (Math.sin(ph) + 0.4 * Math.sin(2 * ph)) * Math.pow(1 - u, 1.5) * Math.min(1, t / 0.005); }
  return o;
}
function buzz(dur) {
  const n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(2 * Math.PI * 110 * t) + Math.sin(2 * Math.PI * 116.5 * t)) * 0.5 * Math.exp(-t * 6) * Math.min(1, t / 0.005); }
  return o;
}
function clank(dur = 0.5) {
  const n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(2 * Math.PI * 520 * t) + 0.7 * Math.sin(2 * Math.PI * 1370 * t) + 0.5 * Math.sin(2 * Math.PI * 2290 * t)) * Math.exp(-t * 12) * Math.min(1, t / 0.001) * 0.4; }
  return o;
}

export function renderTwinkleAudio(outPath) {
  const music = track(DURATION), voices = track(DURATION), mix = music.mix;

  // Emma's xylophone (bars ring), Tab Guy's guitar
  for (const n of [...EMMA1, ...EMMA2, ...REPLAY_E]) mix(xylo(n.midi, Math.max(0.9, n.dur + 0.4)), n.t, 0.62);
  for (const n of [...GUITAR1, ...GUITAR2, ...REPLAY_G]) mix(guitarNote(n.midi, n.dur + 0.9, 0.4), n.t, 1.9);
  // the two sour dyads, strummed low → high
  SOUR.forEach((c, k) => c.notes.forEach((m, i) => mix(guitarNote(m, 0.9), c.t + i * 0.02, k ? 1.7 : 1.9)));

  // the phone: the paywall slams (a thud and a clank)
  mix(beep(1040, 0.11), T.paywall - 0.5, 0.3); mix(beep(1040, 0.11), T.paywall - 0.34, 0.3);   // the low-battery warning, then the phone dies
  mix(powerDown(0.5), T.paywall, 0.5); mix(sub(44, 0.3), T.paywall + 0.05, 0.45);
  // camera moves, hops and the cheer
  [T.toEmma - 0.1, T.night - 0.1, T.nextSun - 0.05, 12.0].forEach((t) => mix(whoosh(0.4), t, 0.2));
  mix(whoosh(0.3), 3.55, 0.1);
  // Emma runs in (soft patter), the close-ups punch in with a low hit, the fade to black swells out
  for (let i = 0; i < 5; i++) mix(tick(260 + 40 * (i % 2), 0.05), 0.12 + i * 0.145, 0.22);
  mix(whoosh(0.25), 0.1, 0.12);
  mix(sub(52, 0.35), T.face, 0.55); mix(bell(84, 1.0), T.emmaFace + 0.25, 0.22);
  mix(whoosh(0.3), T.again - 0.65, 0.14); mix(whoosh(0.3), T.laugh - 0.05, 0.12); mix(whoosh(0.5), T.fade, 0.14);
  [5.55, T.duet - 0.85].forEach((t) => mix(boing(), t + 0.05, 0.45)); mix(boing(0.34), T.cheer, 0.55);

  // the app's name: a soft chime as the phone lights up
  mix(bell(76, 1.1), T.brand + 0.3, 0.25);
  // night: a low pad under the app
  mix(pad([45, 52, 57], 4.2), T.night, 0.045);

  // the app: the phrase it plays by itself, seven taps, a buzzer on the miss, "Correct" with a bell
  for (const n of APP_HEARD) mix(guitarNote(n.midi, 0.4), n.t, 1.5);
  for (const n of APP_TAPS) { mix(n.miss ? buzz(0.4) : guitarNote(n.midi, 0.35), n.t, n.miss ? 0.45 : 1.9); }
  mix(tick(1700, 0.05), APP.check, 0.35);
  mix(bell(81, 1.2), APP.ok, 0.35); mix(bell(88, 1.4), APP.ok + 0.12, 0.3);

  // voices; the music ducks under each line
  const duck = new Float32Array(music.out.length).fill(1);
  let voiced = 0;
  LINES.forEach((line, i) => {
    if (!existsSync(voicePath(i))) return;
    const af = line.who === 'emma'
      ? `rubberband=pitch=${PITCH_EMMA}:formant=shifted:pitchq=quality,highpass=f=200,acompressor=threshold=-18dB:ratio=3:attack=5:release=80`
      : 'highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=80';
    const v = decode(voicePath(i), af);
    voices.mix(v, line.at, line.who === 'emma' ? 1.1 : 1.1);
    const a = Math.round(line.at * SR), b = a + v.length;
    for (let s = a - 0.04 * SR; s < b + 0.2 * SR; s++) if (s >= 0 && s < duck.length) duck[s] = Math.min(duck[s], 0.5);
    voiced++;
  });
  let g = 1;
  const out = new Float32Array(music.out.length);
  for (let s = 0; s < out.length; s++) { g += (duck[s] - g) * (duck[s] < g ? 0.0006 : 0.00012); out[s] = music.out[s] * g + voices.out[s]; }
  const fade = Math.round(0.35 * SR);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;

  const raw = outPath + '.raw.wav';
  const peak = writeWav(raw, out);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9', '-ar', String(SR), '-ac', '1', outPath]);
  execFileSync('rm', [raw]);
  return { peak, voiced };
}
