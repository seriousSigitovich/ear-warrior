// New tunes for #60's cut (the most-viewed Reel so far): the picture, hook, camera and sound of king/story.mjs unchanged, only the melody
// differs, and the timeline stretches or shrinks around it. Each entry is a whole story in king/story.mjs's shape, so king/audio.mjs and
// src/king/KingNeon.tsx (prop `tune`) take it as is.   node render-king.mjs --tune=<id>
// Notes are an octave down from the app's curated set (src/services/melody/candidates.ts) or #14's `classics.mjs`; the Bumblebee is from memory.
import { FPS, TUNING, noteName, midiAt } from './story.mjs';

/** A story from a melody: the same scene gaps as the Mountain King cut, measured from the melody's last note. */
function story({ id, title, notes, melody, bpm, hook, chord, maxFret = 4, ring, letRing = false, strum }) {
  const MELODY = melody.map(([string, fret, beats]) => ({ string, fret, beats, midi: midiAt(string, fret), name: noteName(midiAt(string, fret)) }));
  const BEAT = 60 / bpm;
  const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
  const PHRASE = OFFSETS.at(-1);
  const listenAt = 2.75, hold = listenAt + PHRASE + 0.35;
  const T = { hook: 0, listen: 2.4, listenAt, hold, cta: hold + 0.45, sub: hold + 0.95, comment: hold + 1.45, sweep: hold + 2.3 };
  return {
    id, title, NOTES: notes, MAX_FRET: maxFret, FPS, TUNING, noteName, midiAt, MELODY, BPM: bpm, BEAT, PHRASE,
    STEP: Math.min(BEAT, 0.5), NOTE_RING: ring ?? BEAT + 0.12,       // `ring`: a sung, legato line lets each note ring into the next
    LET_RING: letRing,                                              // an arpeggio: each note rings on until its string plays again
    END_STRUM: strum,                                               // the last note sounds as this chord (MIDI), ringing into "your turn"
    DURATION: Math.round((T.sweep + 1.6) * 10) / 10,
    T,
    HEARD: MELODY.map((n, i) => ({ ...n, t: listenAt + OFFSETS[i], order: i })),
    HOOK_NOTE: { string: hook[0], fret: hook[1], midi: midiAt(hook[0], hook[1]) },
    CHORD: chord,
  };
}

export const TUNES = {
  // Korobeiniki (Russian folk song, public domain; the Tetris tune), A minor, the whole 8-bar theme as #14 (`classics.mjs`), 37 notes,
  // ♩ = 144. G, B and high E strings; the top A is fret 5 on the high E, so this one reaches past first position.
  koro: story({
    id: 'koro', title: 'Korobeiniki', maxFret: 5,
    notes: 'E4 B3 C4 D4 C4 B3 A3 A3 C4 E4 D4 C4 B3 C4 D4 E4 C4 A3 A3 D4 F4 A4 G4 F4 E4 C4 E4 D4 C4 B3 B3 C4 D4 E4 C4 A3 A3',
    melody: [
      [5, 0, 1], [4, 0, 0.5], [4, 1, 0.5], [4, 3, 1], [4, 1, 0.5], [4, 0, 0.5],
      [3, 2, 1], [3, 2, 0.5], [4, 1, 0.5], [5, 0, 1], [4, 3, 0.5], [4, 1, 0.5],
      [4, 0, 1.5], [4, 1, 0.5], [4, 3, 1], [5, 0, 1],
      [4, 1, 1], [3, 2, 1], [3, 2, 2],
      [4, 3, 1.5], [5, 1, 0.5], [5, 5, 1], [5, 3, 0.5], [5, 1, 0.5],
      [5, 0, 1.5], [4, 1, 0.5], [5, 0, 1], [4, 3, 0.5], [4, 1, 0.5],
      [4, 0, 1], [4, 0, 0.5], [4, 1, 0.5], [4, 3, 1], [5, 0, 1],
      [4, 1, 1], [3, 2, 1], [3, 2, 2],
    ],
    bpm: 144, hook: [2, 2], chord: [69, 72, 76],                  // hit E3, the key's fifth · closing chord A minor
  }),
  // Beethoven, Symphony No. 5 (1808), the motto twice, C minor, `beethoven8`. D and G strings.
  fifth: story({
    id: 'fifth', title: 'Beethoven’s Fifth',
    notes: 'G3 G3 G3 D#3 F3 F3 F3 D3',
    melody: [[3, 0, 0.5], [3, 0, 0.5], [3, 0, 0.5], [2, 1, 2], [2, 3, 0.5], [2, 3, 0.5], [2, 3, 0.5], [2, 0, 1]],
    bpm: 112, hook: [0, 3], chord: [72, 75, 79],                  // hit G2 · C minor
  }),
  // Joplin, The Entertainer (1902), `entertainer8`, C major. D and B strings.
  entertainer: story({
    id: 'entertainer', title: 'The Entertainer',
    notes: 'D3 D#3 E3 C4 E3 C4 E3 C4',
    melody: [[2, 0, 0.5], [2, 1, 0.5], [2, 2, 0.5], [4, 1, 1.5], [2, 2, 0.5], [4, 1, 0.5], [2, 2, 0.5], [4, 1, 2]],
    bpm: 100, hook: [0, 3], chord: [72, 76, 79],                  // hit G2, the fifth · C major
  }),
  // Rimsky-Korsakov, Flight of the Bumblebee (1900), the opening chromatic run (from memory, check by ear): 16ths, D, G, B and E strings.
  bumblebee: story({
    id: 'bumblebee', title: 'Flight of the Bumblebee',
    notes: 'E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 B3 A#3 A3 G#3 G3 F#3 F3',
    melody: [[5, 0, 0.5], [4, 4, 0.5], [4, 3, 0.5], [4, 2, 0.5], [4, 3, 0.5], [4, 2, 0.5], [4, 1, 0.5], [4, 0, 0.5],
      [4, 1, 0.5], [4, 0, 0.5], [3, 3, 0.5], [3, 2, 0.5], [3, 1, 0.5], [3, 0, 0.5], [2, 4, 0.5], [2, 3, 1]],
    bpm: 168, hook: [1, 2], chord: [69, 72, 76],                  // hit B2 · A minor
  }),
  // The House of the Rising Sun (traditional, public domain), the guitar arpeggio everyone knows rather than the vocal line (the author:
  // the sung melody is recognised worse than the harmony): Am C D F Am E, one bar of 6/8 each — bass, then G B e B G — and home on an
  // Am strum (the author: ending on F/Am alone feels cut off; the E → Am cadence closes it). Open first-position shapes, frets 0–3,
  // let ring. Beats are quarters; ♪ ≈ 0.21 s.
  rising: story({
    id: 'rising', title: 'The House of the Rising Sun', ring: 1.6, letRing: true,
    notes: 'Am: A2 A3 C4 E4 C4 A3 · C: C3 G3 C4 E4 C4 G3 · D: D3 A3 D4 F#4 D4 A3 · F: F3 A3 C4 F4 C4 A3 · Am · E: E2 G#3 B3 E4 B3 G#3 · Am (strum)',
    melody: [
      [1, 0, 0.5], [3, 2, 0.5], [4, 1, 0.5], [5, 0, 0.5], [4, 1, 0.5], [3, 2, 0.5],    // Am  x02210
      [1, 3, 0.5], [3, 0, 0.5], [4, 1, 0.5], [5, 0, 0.5], [4, 1, 0.5], [3, 0, 0.5],    // C   x32010
      [2, 0, 0.5], [3, 2, 0.5], [4, 3, 0.5], [5, 2, 0.5], [4, 3, 0.5], [3, 2, 0.5],    // D   xx0232
      [2, 3, 0.5], [3, 2, 0.5], [4, 1, 0.5], [5, 1, 0.5], [4, 1, 0.5], [3, 2, 0.5],    // F   xx3211
      [1, 0, 0.5], [3, 2, 0.5], [4, 1, 0.5], [5, 0, 0.5], [4, 1, 0.5], [3, 2, 0.5],    // Am
      [0, 0, 0.5], [3, 1, 0.5], [4, 0, 0.5], [5, 0, 0.5], [4, 0, 0.5], [3, 1, 0.5],    // E   022100
      [1, 0, 1.5],                                                                     // Am, home: sounds as the strum below
    ],
    strum: [45, 52, 57, 60, 64],                                   // Am x02210 strummed, so the ending is not silence
    bpm: 142, hook: [0, 0], chord: [69, 72, 76],                  // hit E2, the fifth · A minor
  }),
};
