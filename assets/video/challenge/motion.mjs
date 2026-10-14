// Experiment H15 (docs/experiments.md): the same "97% of guitarists" Short, but with a moving picture instead of a static one — motion.html
// instead of slides.html (render.mjs reads `page`). Sound, melody timing and copy are those of the control; only the picture changes.
//
// The melody is Für Elise (the opening phrase of #9, reused from classics.mjs so the notes stay in one place), on the recorded acoustic guitar.
// Never named on screen. The "97 %" is a hook device (see H11), not a measured number.
import { CLASSICS } from './classics.mjs';

const elise = CLASSICS.find(c => c.id === 9);

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
];
