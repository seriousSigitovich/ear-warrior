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

// Variant 5 (#48): the same Short and picture on the user's own GarageBand riff — `assets/solo/garage/01-chug-gallop-e.mid` played on a distorted guitar
// (E minor, ♩ = 148, 4 bars + a power-chord stab). The notes below are that MIDI; the audio export (`1 galop.mp3`) was checked against it by pitch tracking
// per 16th (every slot matches). Palm-muted E2 chugs, a G / Bb / A turnaround, then the same shape a fifth up on B2 (B–D–E–D–C–Bb–A). The last E2 stands
// for the E5 power chord (E2 B2 E3), held a beat and a half. 54 note onsets in 6.3 s — a riff to PLAY, not to write down, so the page swaps the count
// ("54 notes") and the comment box for "Listen again. Slower." and "Play it back" (`riff: true`). Second playing = the same take time-stretched to 0.7×.
const GALLOP = {
  id: 48, title: 'Gallop riff (motion, electric)', page: 'motion.html', kind: 'quiz', coldOpen: true, riff: true,
  timbre: 'acoustic', layout: 'fretboard', tag: 'Ear series', tempoBpm: 148, tonicPc: 4, minor: true, key: 'E minor',
  hook: '*97%*\nof guitarists\ncan\'t play this\nby *EAR*',
  recorded: { first: 'guitar-electric/galop-48.wav', slow: 'guitar-electric/galop-48-slow.wav' },
  notes: parse([
    'E2:.25 E2:.25 E2:.25 G2:.25 E2:.25 E2:.25 Bb2:.25 A2:.25 E2:.25 E2:.25 E2:.25 G2:.25 A2:.5 G2:.25 E2:.25',     // A
    'B2:.25 B2:.25 B2:.25 D3:.25 B2:.25 B2:.25 E3:.25 D3:.25 B2:.25 B2:.25 B2:.25 D3:.25 C3:.5 Bb2:.25 A2:.25',    // B: a fifth up
    'E2:.25 E2:.25 E2:.25 G2:.25 E2:.25 E2:.25 Bb2:.25 A2:.25 E2:.25 E2:.25 E2:.25 G2:.25 A2:.5 G2:.25 E2:.25',     // A again
    'E2:.25 E2:.25 E2:.25 G2:.25 E2:.25 E2:.25 Bb2:.25 A2:.25',                                                       // A, cut short by the stab
    'E2:1.5',                                                                                                         // power chord
  ].join(' ')),
};

// Variant 6 (#51): the same Short and picture, one playing only (`once: true` — no slower second pass, so the page skips the "N notes / Listen again" beat and
// goes straight from "No tabs. Just your ear." to "Write them in the comments"). The tune is the Menuet in G (BWV Anh. 114, Petzold, public domain): bars 1–4 of
// the Mutopia Project's edition (anna-magdalena-04.ly + its MIDI, checked note by note: D5 G4 A4 B4 C5 · D5 G4 G4 · E5 C5 D5 E5 F#5 · G5 G4 G4, 3/4), written an
// octave down to sit on the 12-fret neck. Medium difficulty: 16 notes, mostly stepwise in G major, with the leaps down to the low G and the E–F#–G climb in bar 3.
// The last G is held two beats. Ornaments (the printed mordents) are left out. Never named on screen.
const MINUET = {
  id: 51, title: 'Menuet in G (motion, one listen)', page: 'motion.html', kind: 'quiz', coldOpen: true, once: true,
  timbre: 'acoustic', layout: 'fretboard', tag: 'Ear series', tempoBpm: 132, tonicPc: 7, minor: false, key: 'G major',
  hook: '*97%*\nof guitarists\ncan\'t play this\nby *EAR*',
  notes: parse([
    'D4:1 G3:.5 A3:.5 B3:.5 C4:.5',     // bar 1
    'D4:1 G3:1 G3:1',                   // bar 2
    'E4:1 C4:.5 D4:.5 E4:.5 F#4:.5',    // bar 3: the climb
    'G4:1 G3:1 G3:2',                   // bar 4: held so it hangs
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
  GALLOP,
  MINUET,
];
