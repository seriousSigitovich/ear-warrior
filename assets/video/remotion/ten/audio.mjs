// Soundtrack of the "10-second challenge" Short — rendered ahead of time to a WAV (no Web Audio, no browser autoplay, nothing at render time).
// The melody is the recorded acoustic guitar (../synth.mjs `guitarNote`, Iowa MIS samples) through a small room reverb; the UI sounds are
// synthesized and sit well under it. Every time comes from story.mjs, the same file the picture reads.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { SR, track, guitarNote, pluck, bell, tick, whoosh, writeWav } from '../../synth.mjs';
import { DURATION, T, HEARD, ANSWER, HOOK_NOTE, STEP, NOTE_RING, TICKS } from './story.mjs';

// --- small voices -----------------------------------------------------------------------------------------------------------------------
/** Pitch-dropping sine: the "thump" under a board snap, a countdown pulse, the time's-up boom. */
function thump(f0, f1, dur, k = 7) {
  const total = Math.round(dur * SR), o = new Float32Array(total);
  let ph = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t * 24);
    ph += (2 * Math.PI * f) / SR;
    o[i] = Math.sin(ph) * Math.exp(-t * k) * Math.min(1, t / 0.002);
  }
  return o;
}
/** High-passed noise burst: a pick/string "snap", a soft crash. */
function noise(dur, decay, seed = 0x2545f491) {
  const total = Math.round(dur * SR), o = new Float32Array(total);
  let s = seed, prev = 0;
  for (let i = 0; i < total; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const n = ((s >>> 0) / 0xffffffff) * 2 - 1;
    o[i] = (n - prev * 0.92) * Math.exp(-(i / SR) * decay) * Math.min(1, i / (0.001 * SR));
    prev = n;
  }
  return o;
}
/** Sustained low drone (root + fifth), slow swell: the room tone under the countdown. */
function drone(dur) {
  const total = Math.round(dur * SR), o = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR, u = t / dur;
    const env = Math.min(1, t / 0.8) * Math.min(1, (dur - t) / 0.25) * (0.55 + 0.45 * u);   // swells towards zero
    o[i] = env * (Math.sin(2 * Math.PI * 55 * t) + 0.5 * Math.sin(2 * Math.PI * 82.41 * t + 0.4 * Math.sin(2 * Math.PI * 0.3 * t)));
  }
  return o;
}

/** Schroeder room: four combs into two all-passes. Returns the wet signal only, `tail` seconds longer than the input. */
function room(x, tail = 1.4) {
  const n = x.length + Math.round(tail * SR);
  const inp = new Float32Array(n); inp.set(x);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => ({ d: Math.round(d * SR), g: 0.8 }));
  const wet = new Float32Array(n);
  for (const { d, g } of combs) {
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = inp[i] + (i >= d ? buf[i - d] * g : 0);
    for (let i = 0; i < n; i++) wet[i] += buf[i] * 0.25;
  }
  for (const [d, g] of [[Math.round(0.005 * SR), 0.7], [Math.round(0.0017 * SR), 0.7]]) {
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = -g * wet[i] + (i >= d ? wet[i - d] + g * y[i - d] : 0);
    wet.set(y);
  }
  return wet;
}

// --- the mix ----------------------------------------------------------------------------------------------------------------------------
export function renderTenAudio(path) {
  const { out, mix: raw } = track(DURATION);
  const SFX = 0.5;                                                 // every UI sound sits ~6 dB under where it was designed: the guitar leads
  const mix = (buf, start, gain = 1) => raw(buf, start, gain * SFX);
  const gtr = track(DURATION);                                    // everything that goes through the reverb

  // scene 1 — the hook, on frame 0: a hard pluck of a low string, a pick snap, the board "thock"
  gtr.mix(pluck(HOOK_NOTE.midi, 1.5), 0, 1.1);
  gtr.mix(pluck(HOOK_NOTE.midi + 12, 0.8, 0x1234abcd), 0, 0.4);
  mix(noise(0.05, 90), 0, 0.5);
  mix(thump(95, 52, 0.4, 9), 0, 0.55);
  mix(whoosh(0.34), T.listen - 0.34, 0.1);                        // into scene 2

  // scene 2 — the melody, note for note
  HEARD.forEach((n, i) => {
    const hold = i === HEARD.length - 1 ? 1.4 : NOTE_RING;
    gtr.mix(guitarNote(n.midi, hold, i === HEARD.length - 1 ? 0.5 : 0.14), n.t, 1.0);
  });

  // scene 3 — quiet: a room-tone drone, a soft pulse every second that speeds up, a riser into zero
  mix(thump(80, 46, 0.5, 6), T.challenge, 0.3);                   // the scene lands
  mix(whoosh(0.3), T.challenge - 0.3, 0.07);
  mix(drone(T.reveal - T.challenge - 0.1), T.challenge + 0.1, 0.05);
  TICKS.forEach((t, i) => {
    if (i === 0) return;                                          // 7 is already on screen; the next 6 numbers pulse
    mix(thump(120, 60, 0.18, 14), t, 0.13 + 0.01 * i);
    mix(tick(1400 + 90 * i, 0.07), t, 0.05 + 0.006 * i);
  });
  for (let t = T.challenge + 4.5; t < T.reveal - 0.01; t += 1) mix(tick(900, 0.05), t, 0.028);   // off-beats in the last 3 s
  for (let t = T.reveal - 0.75; t < T.reveal - 0.01; t += 0.25) mix(tick(2000, 0.04), t, 0.04);   // the last second goes to 16ths
  mix(whoosh(1.5), T.reveal - 1.5, 0.2);

  // scene 4 — time's up, then the same melody again, each note with a glassy confirm
  mix(thump(70, 34, 0.9, 4.5), T.reveal, 0.62);
  mix(noise(0.45, 12), T.reveal, 0.1);
  mix(whoosh(0.3), T.answerAt - 0.34, 0.1);
  ANSWER.forEach((n, i) => {
    const hold = i === ANSWER.length - 1 ? 1.3 : NOTE_RING;
    gtr.mix(guitarNote(n.midi, hold, i === ANSWER.length - 1 ? 0.5 : 0.14), n.t, 1.0);
    mix(bell(n.midi + 24, 0.55), n.t + 0.003, 0.05);
    mix(tick(2600, 0.05), n.t, 0.04);
  });

  // scene 5 — the call to action: a whoosh as the board lifts, pops for each line and chip, a soft closing chord
  mix(whoosh(0.4), T.cta - 0.42, 0.1);
  mix(thump(160, 90, 0.2, 14), T.q, 0.18);
  mix(tick(1100, 0.08), T.q, 0.07);
  mix(thump(180, 100, 0.18, 14), T.comment, 0.13);
  mix(tick(1500, 0.08), T.comment, 0.06);
  T.chips.forEach((t, i) => mix(tick(1700 + 260 * i, 0.07), t, 0.07));
  mix(whoosh(0.28), T.sweep - 0.28, 0.09);
  [72, 76, 79].forEach((m, i) => mix(bell(m, 1.1), T.sweep + 0.02 + i * 0.03, 0.05));

  // the reverb: just the guitars, ~16 % wet
  const wet = room(gtr.out);
  for (let i = 0; i < gtr.out.length; i++) out[i] += gtr.out[i] + wet[i] * 0.16;

  mkdirSync(dirname(path), { recursive: true });
  const peak = writeWav(path, out);

  // social-video loudness (−14 LUFS, true peak −1.5): measure first, then apply the gain linearly so the loud melody and the quiet countdown keep their balance
  const meas = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  return { peak, measureText: meas.stderr, path };
}
export function finalizeLoudness(path, measureText) {
  const j = JSON.parse(measureText.slice(measureText.lastIndexOf('{'), measureText.lastIndexOf('}') + 1));
  const tmp = path + '.norm.wav';
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path, '-af', af, '-ar', String(SR), '-ac', '1', tmp]);
  copyFileSync(tmp, path); rmSync(tmp);
  return j;
}
