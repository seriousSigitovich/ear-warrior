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
    const len = beats.includes('/') ? beats.split('/').reduce((a, b) => a / b) : +beats; // "2/3" = a triplet third
    const m = name.match(/^([A-G][#b]?)(\d)$/);
    if (!m) throw new Error('bad note ' + tok);
    return { midi: PC[m[1]] + 12 * (+m[2] + 1), name, beats: len };
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
  // Experiment H7 (docs/experiments.md): a *dance* tune — Can-Can (Offenbach, "Galop infernal") — with the #12 hook, on piano.
  // Notes read off an Allegro easy-piano score the author supplied (C major, 4/4, bars 1–4 of the right hand, staccato quarters).
  {
    id: 15, title: 'Can-Can (Galop infernal)', timbre: 'keys', tempoBpm: 140, tonicPc: 0, minor: false, key: 'C major',
    hook: 'Everyone\nknows this one.\n*Can you play it?*',
    notes: 'G4:1 D5:1 D5:1 E5:1  D5:1 C5:1 C5:1 E5:1  F5:1 A5:1 C6:1 A5:1  A5:1 G5:1 G5:2',
  },
  // Experiment H8 (docs/experiments.md): #12's exact format (guitar, keyboard, hook, 120 bpm, two playings) with only the melody changed to a
  // very short popular tune — Happy Birthday (public domain in the US since 2016). 3/4: pickup "Hap-py" (dotted 8th + 16th), "birth-day to", "you" held.
  // (The `once` / `speed` options in timeline.mjs — a single playing at a fraction of the tempo — were built for an earlier cut of this and are currently unused.)
  {
    id: 16, title: 'Happy Birthday', timbre: 'grand', tempoBpm: 120, tonicPc: 0, minor: false, key: 'C major',
    hook: 'Everyone\nknows this one.\n*Can you play it?*',
    notes: 'G4:.75 G4:.25 A4:1 G4:1 C5:1 B4:2',
  },
  // Experiment H10 (docs/experiments.md): probe guitarists — #12's format (hook, 120 bpm, two playings, cold open) but the picture is a 12-fret neck with
  // all six strings, grey, except the string the melody is on (white; the high E). Mary Had a Little Lamb (public domain), moved to G so it lies on that
  // string: B A G A B B B = frets 7 5 3 5 7 7 7. (A first cut used Seven Nation Army — dropped: a copyrighted tune.) Real acoustic-guitar samples.
  {
    id: 18, title: 'Mary Had a Little Lamb (G, one string)', timbre: 'acoustic', layout: 'string', stringIdx: 0, tempoBpm: 120, tonicPc: 7, minor: false, key: 'G major',
    hook: 'Can you *PLAY*\nwithout *TABS*?',
    sub: 'Everyone knows this tune · by ear',
    notes: 'B4:1 A4:1 G4:1 A4:1 B4:1 B4:1 B4:2',
  },
  // Experiment H11 (docs/experiments.md): a statement hook ("97% can't…", from the #8 re-cut that held 40 % vs ~30 % for question hooks)
  // on new tunes. All four: guitar neck + recorded acoustic guitar, so inside each pair only the hook differs. The "97%" is, like #8's "90%",
  // a hook device and NOT a measured number. Melodies from memory — listen once before posting.
  // #19 vs #20: same tune, generic vs guitarist hook. #21 vs #22: same, order swapped (guitarist hook first) to cancel the posting-order confound.
  // Jingle Bells (public domain, 1857), the chorus up to "jingle all the way".
  {
    id: 19, title: 'Jingle Bells', timbre: 'acoustic', layout: 'fretboard', tempoBpm: 150, tonicPc: 0, minor: false, key: 'C major',
    hook: '*97%* can\'t\nplay this\nby *EAR*',
    notes: 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:.5 E4:2',
  },
  {
    id: 20, title: 'Jingle Bells', timbre: 'acoustic', layout: 'fretboard', tempoBpm: 150, tonicPc: 0, minor: false, key: 'C major',
    hook: '*97%* of guitarists\ncan\'t play this\nby *EAR*',
    notes: 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:.5 E4:2',
  },
  // Amazing Grace (public domain), G major 3/4: pickup D, then "-ma-zing grace, how sweet the sound".
  {
    id: 21, title: 'Amazing Grace', timbre: 'acoustic', layout: 'fretboard', tempoBpm: 110, tonicPc: 7, minor: false, key: 'G major',
    hook: '*97%* of guitarists\ncan\'t play this\nby *EAR*',
    notes: 'D4:1 G4:2 B4:.5 G4:.5 B4:2 A4:1 G4:2 E4:1 D4:2',
  },
  {
    id: 22, title: 'Amazing Grace', timbre: 'acoustic', layout: 'fretboard', tempoBpm: 110, tonicPc: 7, minor: false, key: 'G major',
    hook: '*97%* can\'t\nplay this\nby *EAR*',
    notes: 'D4:1 G4:2 B4:.5 G4:.5 B4:2 A4:1 G4:2 E4:1 D4:2',
  },
].map(s => ({ kind: 'quiz', coldOpen: true, layout: 'keyboard', ...s, notes: parse(s.notes) }));

// Experiment H9 (docs/experiments.md): "guess the KEY" quiz instead of "play the melody back". kind "key", 10 s:
//   I–IV–V–I strummed on guitar from frame 0 → the same cadence again under four answer cards (A–D) → end card.
// `notes` are the chord ROOTS (only for timing/pulse — one entry per chord, `beats` = chord length); `chords` are the voicings (MIDI, low → high).
// `options` are the four answer cards, `answer` is the index of the right one — the answer is NEVER on screen, it goes in the pinned comment.
const KEYQUIZ = [
  {
    id: 17, kind: 'key', tag: 'Key quiz #1', timbre: 'pluck', layout: 'fretboard', coldOpen: true, tempoBpm: 75, tonicPc: 7, minor: false, key: 'G major',
    hook: 'Can you figure\nout the *KEY*\nby ear?',
    sub: 'of this song · on guitar',
    // open G · C · D · G (G2 B2 D3 G3 B3 G4 / C3 E3 G3 C4 E4 / D3 A3 D4 F#4 / G again)
    chordNames: ['G', 'C', 'D', 'G'],   // recorded strums in samples/guitar; `chords` is the synthesized fallback
    chords: [[43, 47, 50, 55, 59, 67], [48, 52, 55, 60, 64], [50, 57, 62, 66], [43, 47, 50, 55, 59, 67]],
    // One recorded fingerstyle take (Freesound 527783, CC0; samples/guitar/README.md), G → C → G → D → G, sped up 1.35×. `changes` = when each chord starts.
    audio: { file: 'cadence-gcdg.wav', length: 15.33, changes: [0, 1.89, 5.48, 9.07, 12.67], optionsAt: 5.2 },
    notes: 'G2:1 C3:1 G2:1 D3:1 G2:1',
    options: ['D', 'C', 'G', 'A'], answer: 2,
  },
].map(s => ({ ...s, notes: parse(s.notes) }));

export const CLASSICS = [...SERIES, ...KEYQUIZ];
