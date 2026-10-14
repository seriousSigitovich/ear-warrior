// Writes the melody of a challenge as MIDI, for playing it with a better instrument than the built-in synth (GarageBand etc.).
//   node midi.mjs <id> [outDir]   → <outDir>/ear-challenge-<id>.mid (the tune at its tempo) and …-slow.mid (the second, slower playing)
// The two playings must be two files: the video plays the tune at `tempoBpm` and again at SERIES_SLOW × that (timeline.mjs), and stretching
// recorded audio would change its sound. Gate lengths follow the printed phrasing: a 16th is slightly detached, a dotted 8th (8th + 16th rest, which
// classics.mjs folds into the note) sounds as an 8th, a note of a beat or more is held, the last note rings (it hangs in the video too).
// Output files are what you drag into GarageBand: bar 1 starts with the first note, no count-in, no pickup.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSICS } from './classics.mjs';
import { MOTION } from './motion.mjs';

const PPQ = 480, SERIES_SLOW = 0.7; // keep in step with timeline.mjs
const gate = (beats, last) => (last ? beats * 1.5 : beats <= 0.25 ? 0.22 : beats < 1 ? 0.5 : beats * 0.96);

const vlq = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
const u32 = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function smf(c, bpm) {
  const ev = [];                                                // [tick, order, bytes] — offs sort before ons at the same tick
  let beat = 0;
  c.notes.forEach((n, i) => {
    const on = Math.round(beat * PPQ), off = on + Math.round(gate(n.beats, i === c.notes.length - 1) * PPQ);
    const accent = n.beats >= 0.75 ? 112 : 96;
    ev.push([on, 1, [0x90, n.midi, accent]], [off, 0, [0x80, n.midi, 0]]);
    beat += n.beats;
  });
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const us = Math.round(60e6 / bpm);
  const tr = [
    0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255,     // tempo
    0, 0xff, 0x58, 4, 2, 2, 24, 8,                                        // 2/4
    0, 0xc0, 27,                                                          // clean electric guitar (a hint; the DAW picks its own instrument)
  ];
  let t = 0;
  for (const [tick, , bytes] of ev) { tr.push(...vlq(tick - t), ...bytes); t = tick; }
  tr.push(0, 0xff, 0x2f, 0);
  return Buffer.from([0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, PPQ >> 8, PPQ & 255, 0x4d, 0x54, 0x72, 0x6b, ...u32(tr.length), ...tr]);
}

const [id, outArg] = process.argv.slice(2);
const c = [...CLASSICS, ...MOTION].find(x => x.id === +id);
if (!c) { console.error('usage: midi.mjs <id> [outDir]  (ids of classics.mjs / motion.mjs)'); process.exit(1); }
const dir = outArg ?? join(dirname(fileURLToPath(import.meta.url)), 'midi');
mkdirSync(dir, { recursive: true });
for (const [suffix, bpm] of [['', c.tempoBpm], ['-slow', c.tempoBpm * SERIES_SLOW]]) {
  const file = join(dir, `ear-challenge-${id}${suffix}.mid`);
  writeFileSync(file, smf(c, bpm));
  console.log(`wrote ${file}  (${c.notes.length} notes, ♩ = ${+bpm.toFixed(1)})`);
}
