// Synthesizes a challenge video's soundtrack to a mono WAV (voices live in ../synth.mjs).
// Usage: node score.mjs <challenge id> out.wav
//
// The melody is dry and alone while the viewer listens (no chord bed, no tonic cue — that would be a hint).
// Only the answer gets a warm tonic bed underneath.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { track, pluck, voice, keys, bell, pad, sub, tick, whoosh, writeWav } from '../synth.mjs';
import { timeline } from './timeline.mjs';

// `tail` is how long the tone is allowed to ring past the note's own length.
const TIMBRES = {
  pluck: { make: (m, dur, i) => pluck(m, dur, 0x1234567 + i), gain: 0.8, tail: 0.9 },
  keys: { make: (m, dur) => keys(m, dur), gain: 0.6, tail: 0.5 },
  voice: { make: (m, dur) => voice(m, dur), gain: 0.55, tail: 0.05 },
};

// Series videos: the melody sounds on frame 0 — no whoosh, no lead-in, nothing before the first note.
// Both playings are dry (a tonic bed would be a hint); the end card gets the tonic bell arpeggio.
function scoreSeries(c, tl, mix, playMelody) {
  const third = c.minor ? 3 : 4;
  playMelody(tl.listenAt);

  mix(whoosh(0.4), tl.againAt - 0.4, 0.1);
  playMelody(tl.againAt, tl.againNotes); // slower, so every note can be caught

  const top = 60 + c.tonicPc;
  [top, top + third, top + 7].forEach((m, i) => mix(bell(m, 2.2), tl.outroAt + 0.05 + i * 0.09, 0.3));
}

export function renderScore(c, path) {
  const tl = timeline(c);
  const { out, mix } = track(tl.dur);
  const T = TIMBRES[c.timbre];

  const playMelody = (at, timing = tl.notes) => c.notes.forEach((n, i) => {
    const { onset, dur } = timing[i];
    mix(T.make(n.midi, dur + T.tail, i), at + onset, T.gain);
  });

  if (c.kind === 'quiz') {
    scoreSeries(c, tl, mix, playMelody);
    return writeWav(path, out);
  }

  if (tl.listenAt >= 0.45) mix(whoosh(0.45), tl.listenAt - 0.45, 0.1);
  playMelody(tl.listenAt);

  // Countdown: one soft click per second, a brighter one when time is up.
  tl.ticks.forEach(t => mix(tick(900), t, 0.14));
  mix(tick(1350), tl.turnEnd, 0.16);

  // Answer: the same melody over the tonic triad, which then carries into the end card.
  const third = c.minor ? 3 : 4, root = 48 + c.tonicPc;
  mix(whoosh(0.4), tl.revealAt - 0.4, 0.1);
  playMelody(tl.revealAt);
  mix(pad([root, root + third, root + 7], tl.dur - tl.revealAt + 0.2), tl.revealAt - 0.2, 0.07);
  mix(sub(root - 12, tl.length + 0.4), tl.revealAt, 0.12);

  // End card: bell arpeggio of the tonic triad — "it landed".
  const top = 60 + c.tonicPc;
  [top, top + third, top + 7].forEach((m, i) => mix(bell(m, 2.2), tl.outroAt + 0.05 + i * 0.09, 0.3));

  return writeWav(path, out);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const [id, wav] = process.argv.slice(2);
  const c = JSON.parse(readFileSync(join(here, 'challenges.json'), 'utf8')).find(x => x.id === +id);
  if (!c) { console.error('usage: score.mjs <challenge id> out.wav'); process.exit(1); }
  const peak = renderScore(c, wav);
  console.log(`wrote ${wav} (challenge #${id}, pre-master peak ${peak.toFixed(2)})`);
}
