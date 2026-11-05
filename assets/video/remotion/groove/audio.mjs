// Soundtrack of the disco jam loop (8 s, seamless): four-on-the-floor kick, claps on 2 and 4, open hats on the "and", 16th closed hats,
// a disco octave bass, a quiet string-machine pad, and the 16th guitar chop — plus, in the "call" cut, the guitar's two-bar phrase.
// The guitars are real-ish: guitar-rig's string model through its `clean` amp (groove/guitar.py); the rest is synthesized here.
// Rendered 2 s long and folded: whatever rings past the end (hat tails, the pad, the delay) is mixed onto the start, so the loop has no seam.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { track, pad, SR } from '../../synth.mjs';
import { writeAndMeasure } from '../ten/audio.mjs';
import { kick, noise, snare, bass } from '../jam/audio.mjs';
import * as G from './story.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const RIG_PY = join(here, '..', '..', '..', 'guitar-rig', '.venv', 'bin', 'python');
const OVER = 2;

/** A handclap: three quick noise bursts (the hands don't meet at once) then a short tail, band-limited around 1–2 kHz. */
function clap() {
  const len = 0.25, total = Math.round(len * SR), o = new Float32Array(total);
  [0, 0.011, 0.021].forEach((d, k) => { const n = noise(0.08, k === 2 ? 22 : 90, 0.6, 0xc1a9 + k); const at = Math.round(d * SR); for (let i = 0; i < n.length && at + i < total; i++) o[at + i] += n[i] * (k === 2 ? 1 : 0.7); });
  let lp = 0, hp = 0;
  for (let i = 0; i < total; i++) { lp += 0.35 * (o[i] - lp); hp += 0.06 * (lp - hp); o[i] = lp - hp; }
  return o;
}
function decode(file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}
const rmsDb = (x) => { let s = 0, n = 0; for (const v of x) { s += v * v; n++; } return (10 * Math.log10(s / n + 1e-12)).toFixed(1); };

/** The guitars, rendered once per run through guitar-rig. Returns { chop, call } as Float32 at SR. */
function guitars(tmp) {
  const chop = [];
  for (let b = 0; b < G.BARS; b++) {
    const c = G.CHORDS[b];
    [...G.CHOP].forEach((ch, k) => {
      if (ch === '.') return;
      const start = b * G.BAR + k * G.STEP, mute = ch === 'g';
      for (const pitch of c.voicing) chop.push({ start, dur: mute ? 0.045 : G.STEP * 0.75, pitch, vel: mute ? 0.5 : k % 4 === 0 ? 0.85 : 0.72, mute });
    });
  }
  const call = G.CALL.map((n) => ({ start: n.t, dur: n.dur * 0.94, pitch: n.midi, vel: 0.85 }));
  mkdirSync(tmp, { recursive: true });
  const json = join(tmp, 'groove-notes.json');
  writeFileSync(json, JSON.stringify({ bpm: G.BPM, chop, call }));
  execFileSync(RIG_PY, [join(here, 'guitar.py'), json, tmp], { stdio: 'inherit' });
  return { chop: decode(join(tmp, 'groove-chop.wav')), call: decode(join(tmp, 'groove-call.wav')) };
}

/** Writes both cuts' soundtracks: `jam` (the band) and `call` (the band + the phrase). Same band, sample for sample. */
export function renderGrooveAudio(paths, tmp) {
  const gt = guitars(tmp);
  const len = G.DURATION + OVER;
  const drums = track(len), low = track(len), keys = track(len);
  const k = kick(0.35), cl = clap(), sn = snare(), oh = noise(0.3, 13, 0.95, 0x0badf00d), ch = noise(0.04, 95, 0.95, 0x13579bd);

  for (const t of G.KICKS) drums.mix(k, t, 0.95);
  for (const t of G.CLAPS) drums.mix(cl, t, 0.55);
  for (const t of G.OPEN_HATS) drums.mix(oh, t, 0.16);
  for (const t of G.HATS) drums.mix(ch, t, 0.07);
  G.FILL.forEach((t, i) => drums.mix(sn, t, 0.25 + 0.12 * i));
  for (const n of G.BASS) low.mix(bass(n.midi, n.dur, 900), n.t, 0.5);
  G.CHORDS.forEach((c, b) => keys.mix(pad(c.voicing.map((m) => m - 12), G.BAR + 0.3), b * G.BAR, 0.035));

  const fold = (x) => { const n = Math.round(G.DURATION * SR), o = x.slice(0, n); for (let i = n; i < x.length; i++) o[i - n] += x[i]; return o; };
  const band = new Float32Array(Math.round(len * SR));
  for (let i = 0; i < band.length; i++) band[i] = drums.out[i] + low.out[i] + keys.out[i] + (gt.chop[i] ?? 0) * 2.0;
  const call = new Float32Array(band.length);
  for (let i = 0; i < call.length; i++) call[i] = band[i] + (gt.call[i] ?? 0) * 2.0;
  console.log(`groove: rms dB — drums ${rmsDb(drums.out)}, bass ${rmsDb(low.out)}, pad ${rmsDb(keys.out)}, chop ${rmsDb(gt.chop.map((v) => v * 2.0))}, call ${rmsDb(gt.call.map((v) => v * 2.0))}`);

  return { jam: writeAndMeasure(paths.jam, fold(band)), call: writeAndMeasure(paths.call, fold(call)) };
}
