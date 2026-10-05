// Famous public-domain melodies for the "series" quiz Shorts. Hand-transcribed,
// NOT from the app's generator, so they live here and not in challenges.json (gen-melodies.mjs rewrites that file).
// Same shape as a challenges.json entry, plus `title` (which tune it is — never shown on screen).
//
// `notes` is a compact string: "E4:1 D#4:0.5" = pitch:beats. No rests — the video shows only the phrase's notes.
// Keep every melody ≤ ~5 s: the video plays it twice and the whole Short should stay under ~15 s (see timeline.mjs).

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

function parse(str) {
  return str.trim().split(/\s+/).map(tok => {
    const [name, beats] = tok.split(':');
    const m = name.match(/^([A-G][#b]?)(\d)$/);
    if (!m) throw new Error('bad note ' + tok);
    return { midi: PC[m[1]] + 12 * (+m[2] + 1), name, beats: +beats };
  });
}

// `hook` : first-frame headline ("\n" = line break, *word* = accent). A dare, never naming the tune.
// `timbre`: keys / pluck / voice (see score.mjs). Folk tunes get the guitar so the pair reads as "folk".
const TWINKLE = {
  id: 12, title: 'Twinkle, Twinkle', timbre: 'pluck', tempoBpm: 120, tonicPc: 0, minor: false, key: 'C major',
  hook: 'Everyone\nknows this one.\n*Can you play it?*',
  notes: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2',
};

const SERIES = [
  {
    id: 8, title: 'Ode to Joy', timbre: 'keys', tempoBpm: 120, tonicPc: 0, minor: false, key: 'C major',
    // Deliberately the user's own wording, incl. the "90%" claim — see docs/experiments.md (H4): it is not a measured number.
    hook: 'Can you play\nthis by ear?\n*90% get it wrong*',
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1',
  },
  {
    id: 9, title: 'Für Elise', timbre: 'keys', tempoBpm: 66, tonicPc: 9, minor: true, key: 'A minor',
    hook: 'You know it.\nBut can you\n*play it by ear?*',
    notes: 'E5:0.25 D#5:0.25 E5:0.25 D#5:0.25 E5:0.25 B4:0.25 D5:0.25 C5:0.25 A4:1',
  },
  {
    id: 10, title: 'Beethoven’s 5th', timbre: 'keys', tempoBpm: 100, tonicPc: 0, minor: true, key: 'C minor',
    hook: 'You\'ll know it\nin one second.\n*Can you play it?*',
    notes: 'G4:0.5 G4:0.5 G4:0.5 Eb4:2 F4:0.5 F4:0.5 F4:0.5 D4:2',
  },
  {
    id: 11, title: 'Frère Jacques', timbre: 'pluck', tempoBpm: 120, tonicPc: 0, minor: false, key: 'C major',
    hook: 'Sounds\neasy?\n*Play it by ear*',
    notes: 'C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1',
  },
  TWINKLE,
  // Experiment H5 (docs/experiments.md): #12 re-made with a guitar neck instead of the keyboard — only the picture differs.
  { ...TWINKLE, id: 13, title: 'Twinkle, Twinkle (fretboard)', layout: 'fretboard' },
  // Experiment H6 (docs/experiments.md): the FULL tune (8 bars, 37 notes, ~13 s) instead of a 7–8 note phrase — the one deliberate
  // exception to the ≤ ~5 s rule above; the Short runs ~37 s. Guitar sound + fretboard picture like #13; the difficulty is what's new.
  {
    id: 14, title: 'Korobeiniki', timbre: 'pluck', layout: 'fretboard', tempoBpm: 144, tonicPc: 9, minor: true, key: 'A minor',
    hook: 'You know it.\nNow play\n*the whole thing*',
    notes: [
      'E5:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5',
      'A4:1 A4:.5 C5:.5 E5:1 D5:.5 C5:.5',
      'B4:1.5 C5:.5 D5:1 E5:1',
      'C5:1 A4:1 A4:2',
      'D5:1.5 F5:.5 A5:1 G5:.5 F5:.5',
      'E5:1.5 C5:.5 E5:1 D5:.5 C5:.5',
      'B4:1 B4:.5 C5:.5 D5:1 E5:1',
      'C5:1 A4:1 A4:2',
    ].join(' '),
  },
].map(s => ({ kind: 'quiz', coldOpen: true, layout: 'keyboard', ...s, notes: parse(s.notes) }));

export const CLASSICS = SERIES;
