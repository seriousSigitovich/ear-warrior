// Synthesizes a challenge video's soundtrack to a mono WAV (voices live in ../synth.mjs).
// Usage: node score.mjs <challenge id> out.wav
//
// The melody is dry and alone while the viewer listens (no chord bed, no tonic cue — that would be a hint).
// Only the answer gets a warm tonic bed underneath.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { track, pluck, guitarNote, guitarChord, guitarClip, voice, keys, grand, bell, pad, sub, tick, whoosh, writeWav } from '../synth.mjs';
import { timeline } from './timeline.mjs';

// `tail` is how long the tone is allowed to ring past the note's own length.
const TIMBRES = {
  pluck: { make: (m, dur, i) => pluck(m, dur, 0x1234567 + i), gain: 0.8, tail: 0.9 },
  keys: { make: (m, dur) => keys(m, dur), gain: 0.6, tail: 0.5 },
  grand: { make: (m, dur) => grand(m, dur), gain: 0.9, tail: 1.2 },
  // Recorded acoustic guitar, one string: each note is damped when the next lands, the last one rings out (lastTail).
  acoustic: { make: (m, dur) => guitarNote(m, dur), gain: 0.9, tail: 0.04, lastTail: 1.6 },
  voice: { make: (m, dur) => voice(m, dur), gain: 0.55, tail: 0.05 },
};

// Series videos: the melody sounds on frame 0 — no whoosh, no lead-in, nothing before the first note.
// Both playings are dry (a tonic bed would be a hint); the end card gets the tonic bell arpeggio.
function scoreSeries(c, tl, mix, playMelody) {
  const third = c.minor ? 3 : 4;
  playMelody(tl.listenAt);

  if (!tl.once) {
    mix(whoosh(0.4), tl.againAt - 0.4, 0.1);
    playMelody(tl.againAt, tl.againNotes); // slower, so every note can be caught
  }

  const top = 60 + c.tonicPc;
  [top, top + third, top + 7].forEach((m, i) => mix(bell(m, 2.2), tl.outroAt + 0.05 + i * 0.09, 0.3));
}

// Key quiz: real recorded open-chord strums (`chordNames`, samples/guitar) when the entry has them; otherwise each chord is
// strummed (low → high, 35 ms apart) on the synthesized plucked-string voice; the cadence plays twice and nothing else
// does — no bell, no tonic bed: the pinned comment holds the answer.
function scoreKey(c, tl, mix) {
  if (c.audio) return mix(guitarClip(c.audio.file), 0, 0.9); // one recorded take of the whole cadence, nothing else
  const play = at => c.chords.forEach((chord, i) => {
    const { onset, dur } = tl.notes[i];
    if (c.chordNames) { // damp each chord when the next one lands (a player mutes the strings); the last one rings out
      const last = i === c.chords.length - 1;
      return mix(guitarChord(c.chordNames[i], last ? dur + 1.4 : dur + 0.05, last ? 0.4 : 0.18), at + onset, 0.9);
    }
    chord.forEach((m, k) => mix(pluck(m, dur + 1.1, 0x1234567 + i * 31 + k), at + onset + k * 0.035, 0.42));
  });
  play(tl.listenAt);
  mix(whoosh(0.4), tl.againAt - 0.4, 0.1);
  play(tl.againAt);
}

export function renderScore(c, path) {
  const tl = timeline(c);
  const { out, mix } = track(tl.dur);
  const T = TIMBRES[c.timbre];

  if (c.kind === 'key') {
    scoreKey(c, tl, mix);
    return writeWav(path, out);
  }

  const playMelody = (at, timing = tl.notes) => c.notes.forEach((n, i) => {
    const { onset, dur } = timing[i];
    const tail = i === c.notes.length - 1 && T.lastTail != null ? T.lastTail : T.tail;
    mix(T.make(n.midi, dur + tail, i), at + onset, T.gain);
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
