// Experiment H15 (docs/experiments.md): the same "97% of guitarists" Short, but with a moving picture instead of a static one — motion.html
// instead of slides.html (render.mjs reads `page`). Sound, melody timing and copy are those of the control; only the picture changes.
//
// The melody is Für Elise (the opening phrase of #9, reused from classics.mjs so the notes stay in one place), on the recorded acoustic guitar.
// Never named on screen. The "97 %" is a hook device (see H11), not a measured number.
import { CLASSICS, parse } from './classics.mjs';

const elise = CLASSICS.find(c => c.id === 9);

// Variant 3 (#42): the same "97% of guitarists" Short and picture as #40, on a different tune — the theme of Paganini's Caprice No. 24 (A minor, public domain).
// Notes checked against the Mutopia Project's edition (Caprice_24.ly + its MIDI, Ricordi 1836): the first strain, bars 1–4, no rests in the video so each
// rest is folded into the note before it (A4 8th + 16th rest = :.75), the last E4 held so it hangs. Tempo ♩ = 140 (the MIDI says 186; real players sit lower).
// 20 notes — more than #40's 9 — and 16ths at ~9 notes/s: a much harder quiz, "97 % can't" is easier to believe. Never named on screen.
const PAGANINI = {
  id: 42, title: 'Paganini Caprice 24 (motion)', page: 'motion.html', kind: 'quiz', coldOpen: true,
  timbre: 'acoustic', layout: 'fretboard', tag: 'Ear series', tempoBpm: 140, tonicPc: 9, minor: true, key: 'A minor',
  hook: '*97%*\nof guitarists\ncan\'t play this\nby *EAR*',
  notes: parse([
    'A4:.75 A4:.25 A4:.25 C5:.25 B4:.25 A4:.25',     // bar 1
    'E5:.75 E4:.25 E4:.25 G#4:.25 F#4:.25 E4:.25',   // bar 2: the octave drop
    'A4:.75 A4:.25 A4:.25 C5:.25 B4:.25 A4:.25',     // bar 3 = bar 1
    'E5:1 E4:1',                                      // bar 4
  ].join(' ')),
};

export const MOTION = [
  {
    ...elise, id: 40, title: 'Für Elise (motion)', page: 'motion.html',
    timbre: 'acoustic', layout: 'fretboard', tag: 'Ear series',
    hook: '*97%*\nof guitarists\ncan\'t play this\nby *EAR*',
  },
  // Variant 2: the same tune and sound, but the notes are SHOWN — a ♪ ball hops from fret to fret on the high E string (motion-notes.html).
  // Shows the pitches, so it is a "watch the frets" video, not a by-ear quiz.
  {
    ...elise, id: 41, title: 'Für Elise (hopping notes)', page: 'motion-notes.html',
    timbre: 'acoustic', layout: 'fretboard', tag: 'Ear series',
  },
  PAGANINI,
  // Variant 4: #42 with the sound swapped — an electric guitar played from this very MIDI (`node midi.mjs 42`) on a GarageBand instrument, two takes
  // (the tune at ♩ = 140, then at 98 for the slower second playing). Picture, hook, notes and timing are #42's, so only the sound differs.
  { ...PAGANINI, id: 43, title: 'Paganini Caprice 24 (motion, electric)', recorded: { first: 'guitar-electric/electric-42.wav', slow: 'guitar-electric/electric-42-slow.wav' } },
];
