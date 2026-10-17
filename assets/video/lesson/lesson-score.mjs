// Soundtrack for the lesson: guitar notes on the high E string, D / Dm strums, hummed melody, a closing bell. NO voice-over —
// the author records that on top, so everything here is sparse and sits under speech.
// Usage: node lesson-score.mjs out.wav
import { track, pluck, guitarNote, voice, bell, writeWav } from '../synth.mjs';
import { SCENES, DUR } from './script.mjs';
import { fileURLToPath } from 'node:url';

// Open D and D minor, strummed low → high: D3 A3 D4 and F#4 (D) / F4 (Dm). Both go through the same plucked-string
// voice on purpose, so the only difference the ear can hear is the one finger.
const CHORDS = { D: [50, 57, 62, 66], Dm: [50, 57, 62, 65] };

/** `skip` lists event kinds to leave out (e.g. ['note', 'chord'] when the author's own guitar recording replaces them). */
export function renderLesson(path, skip = []) {
  const { out, mix } = track(DUR + 2);
  for (const s of SCENES) {
    s.audio.forEach((e, n) => {
      if (skip.includes(e.kind)) return;
      const at = s.start + e.at;
      if (e.kind === 'note') mix(guitarNote(e.midi, e.dur), at, e.gain ?? 0.9);
      else if (e.kind === 'hum') mix(voice(e.midi, e.dur), at, e.gain ?? 0.45);
      else if (e.kind === 'bell') mix(bell(e.midi, e.dur), at, 0.3);
      else if (e.kind === 'chord') CHORDS[e.name].forEach((m, k) => mix(pluck(m, e.dur + 0.5, 0x1234567 + n * 31 + k), at + k * 0.04, (e.gain ?? 0.9) * 0.42));
    });
  }
  return writeWav(path, out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const peak = renderLesson(process.argv[2] ?? 'lesson.wav');
  console.log(`wrote ${process.argv[2] ?? 'lesson.wav'} (${DUR}s, pre-master peak ${peak.toFixed(2)})`);
}
