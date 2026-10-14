// Removes a metronome click that ended up in a DAW export: a ~1 ms spike on every beat of a known tempo.
//   node declick.mjs <in.wav> <bpm> <out.wav>
// Each beat's click window is replaced by a straight line between its neighbours (the hole is ~1.5 ms, inaudible even where a note attack sits on the
// beat). Prefer exporting without the click; this is for takes that already exist.
import { execFileSync } from 'node:child_process';

const [input, bpmArg, output] = process.argv.slice(2);
if (!output) { console.error('usage: declick.mjs <in.wav> <bpm> <out.wav>'); process.exit(1); }
const SR = 44100, CH = 2, bpm = +bpmArg, BEAT = Math.round(60 / bpm * SR);
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', input, '-ac', String(CH), '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 29 });
const x = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
const frames = x.length / CH, pre = Math.round(0.0003 * SR), post = Math.round(0.0012 * SR);
let n = 0;
for (let c = 0; c < frames; c += BEAT, n++) {
  const a = Math.max(1, c - pre), b = Math.min(frames - 2, c + post);
  for (let ch = 0; ch < CH; ch++) {
    const x0 = x[(a - 1) * CH + ch], x1 = x[(b + 1) * CH + ch];
    for (let i = a; i <= b; i++) x[i * CH + ch] = x0 + (x1 - x0) * (i - a + 1) / (b - a + 2);
  }
}
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', String(CH), '-i', '-', '-c:a', 'pcm_s24le', output], { input: Buffer.from(x.buffer) });
console.log(`cleaned ${n} beats → ${output}`);
