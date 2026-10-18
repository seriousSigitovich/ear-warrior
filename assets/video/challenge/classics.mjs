// Famous public-domain melodies for the "series" quiz Shorts. Hand-transcribed,
// NOT from the app's generator, so they live here and not in challenges.json (gen-melodies.mjs rewrites that file).
// Same shape as a challenges.json entry, plus `title` (which tune it is — never shown on screen).
//
// `notes` is a compact string: "E4:1 D#4:0.5" = pitch:beats. No rests — the video shows only the phrase's notes.
// Keep every melody ≤ ~5 s: the video plays it twice and the whole Short should stay under ~15 s (see timeline.mjs).

const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function parse(str) {
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
  // Experiment H12 (docs/experiments.md): #21's guitarist "97%" hook, fretboard and recorded acoustic guitar, on a new tune — Grieg, In the Hall of the
  // Mountain King (public domain). The guitar-friendly E minor transposition (original: B minor): E F# G A B G B | A# F# A# | A F# A, eighths with the
  // last note of each figure a quarter. Slower than the piece's usual ~138 bpm so 13 notes are catchable. From memory — listen before posting.
  {
    id: 23, title: 'In the Hall of the Mountain King', timbre: 'acoustic', layout: 'fretboard', tempoBpm: 104, tonicPc: 4, minor: true, key: 'E minor',
    hook: '*97%* of guitarists\ncan\'t play this\nby *EAR*',
    notes: 'E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 G4:.5 B4:1 A#4:.5 F#4:.5 A#4:1 A4:.5 F#4:.5 A4:1',
  },
  // #24: same tune and format as #23, only the hook differs — an instruction ("No tabs. No chords. Just your EAR. Play this.", two lines, neon accent word via `neon: true`) instead of the "97%" statement.
  {
    id: 24, title: 'In the Hall of the Mountain King', timbre: 'acoustic', layout: 'fretboard', tempoBpm: 104, tonicPc: 4, minor: true, key: 'E minor',
    hook: 'No tabs. No chords.\nJust your *EAR*. Play this.',
    neon: true,
    notes: 'E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 G4:.5 B4:1 A#4:.5 F#4:.5 A#4:1 A4:.5 F#4:.5 A4:1',
  },
  // Experiment H13 (docs/experiments.md): Callaway's four-step loop in one 10 s Short. Ode to Joy (public domain), the exact 8 notes of #8, but the
  // 6th is wrong (F4 → F#4). ONE playing at normal speed (`once`): hook = stakes ("you", your ear at risk, "one listen") + big question (which note?);
  // the wrong note = the head fake (the viewer knows the tune, so the prediction F is broken); the headline swap = re-hook (names the wrong note,
  // which closes loop 1, and asks for the right one, which opens loop 2); the Short loops back into the melody. The right note is never played.
  {
    id: 25, title: 'Ode to Joy, 6th note wrong', once: true, timbre: 'acoustic', layout: 'fretboard', tempoBpm: 120, tonicPc: 0, minor: false, key: 'C major',
    hook: 'You know this tune.\nOne note is *wrong.*\n*One listen.*',
    ask: 'The *6th note*\nwas wrong.', askSub: 'What should it be? Comment it.',
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F#4:1 E4:1 D4:1',
  },
  // #26: #25's melody and format, but the hook does NOT warn about the wrong note — so the F# is a real head fake (a broken prediction), not a spot-the-difference task.
  // Callaway's loop, simplified: hook = stakes (guitarists, one try) + big question ("play this by ear?"); head fake = the wrong 6th note;
  // re-hook = "Wait. One note was wrong. Which one?" (closes the first question, opens the second); a short last slide asks for the comment.
  {
    id: 26, title: 'Ode to Joy, 6th note wrong (hidden)', once: true, timbre: 'acoustic', layout: 'fretboard', tempoBpm: 120, tonicPc: 0, minor: false, key: 'C major',
    hook: 'Guitarists: *play this*\n*by ear?* *One try.*',
    ask: 'Wait. One note\nwas *wrong.*', askSub: 'Which one?',
    cta: { title: 'Comment the\n*right note*', sub: 'The one that replaces the wrong one.' },
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F#4:1 E4:1 D4:1',
  },
  // Experiment H16 (docs/experiments.md): not a quiz — a direct ask for early-access signups. The melody is only the demo: the theme of Mozart's Eine kleine Nachtmusik
  // (K. 525, public domain), G major, ONE playing, then the headline swap names the product loop, then a slide points to the link in the profile (the comment-"BETA" ask was dropped 2026-10-18).
  // Notes read from the Mutopia Project's public-domain MIDI (first violin, bars 1–2: G5 D5 G5 D5 | G5 D5 G5 B5 D6), dropped an octave to fit the neck (E2–E5);
  // rests folded into the previous note, the last D held. No stat, no promise but the one already on the landing (first 100 get lifetime access).
  {
    id: 44, title: 'Eine kleine Nachtmusik (early access)', once: true, neon: true, timbre: 'acoustic', layout: 'fretboard', tag: 'Early access',
    tempoBpm: 120, tonicPc: 7, minor: false, key: 'G major',
    hook: 'Guitarists —\nI need *testers.*', sub: 'An app that trains playing by ear',
    ask: 'Hear it once.\n*Play it back.*', askSub: 'The app shows which notes landed.',
    cta: { title: 'Early access\n*link in profile*', sub: 'First 100 get lifetime access.' },
    notes: 'G4:1.5 D4:.5 G4:1.5 D4:.5 G4:.5 D4:.5 G4:.5 B4:.5 D5:2',
  },
  // Experiment H14 (docs/experiments.md): ONE tune taught across four Shorts — Greensleeves (traditional, public domain), E minor, 6/8, eighth note = 1 beat.
  // Notes checked programmatically against the Mutopia Project's public-domain edition (greensleeves.ly: key signature G major, melody centred on E = E minor):
  // every part is a slice of that score, rests folded into the previous note (these videos have none), the last note of a part held longer so it hangs.
  // Each part STARTS on the note where the previous one stopped, and its hook says so; parts 1 and 3 end unresolved (low B) — the music itself is the
  // "to be continued". The tune is never named on screen.
  //   1 verse, first half (lines one + two)  2 line one again + the verse's ending  3 the chorus  4 the whole tune
  ...[
    {
      id: 27, hook: 'Learn a famous tune\n*by ear.*\nPart 1 of 4', sub: 'The first half of the verse · you know it',
      ask: 'Write the notes\n*in the comments*', askSub: 'It ends low and unfinished. Part 2 starts on the last note.',
      notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1  G4:2 E4:1 E4:1.5 D#4:.5 E4:1 F#4:3 B3:3',
    },
    {
      id: 28, hook: 'Part 2 of 4\nThe first line is *back.*\nThen it turns.', sub: 'Starts where Part 1 stopped · the verse ends here',
      ask: 'Write the notes\n*in the comments*', askSub: 'Home at last. Part 3: the big leap.',
      notes: 'B3:2 E4:1 G4:2 A4:1 B4:1.5 C5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1 G4:1.5 F#4:.5 E4:1 D#4:1.5 C#4:.5 D#4:1 E4:3 E4:3',
    },
    {
      id: 29, hook: 'Part 3 of 4\nHome… then a\n*huge leap up*', sub: 'The chorus · the part everyone sings',
      ask: 'Write the notes\n*in the comments*', askSub: 'One part left: the whole tune, start to finish.',
      notes: 'E4:2 D5:3 D5:1.5 C#5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1  G4:2 E4:1 E4:1.5 D#4:.5 E4:1 F#4:2 D#4:1 B3:3',
    },
    {
      // The whole score once (71 notes, 96 eighths = 38 s at 150), single playing: the finale is a memory test, not a transcription drill.
      id: 30, once: true, hook: 'Part 4 of 4\nNow play it all.\n*From memory.*', sub: 'Verse and chorus · one listen',
      ask: 'Write it down\n*in the comments*', askSub: 'Every note you got. You learned three parts of this.',
      notes: [
        'E4:1 G4:2 A4:1 B4:1.5 C5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1',                                  // line one
        'G4:2 E4:1 E4:1.5 D#4:.5 E4:1 F#4:3 B3:2',                                                            // line two
        'E4:1 G4:2 A4:1 B4:1.5 C5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1',                                  // line one again
        'G4:1.5 F#4:.5 E4:1 D#4:1.5 C#4:.5 D#4:1 E4:3 E4:3',                                                 // the verse's ending (+ the rest before the chorus)
        'D5:3 D5:1.5 C#5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1',                                            // chorus: the leap
        'G4:2 E4:1 E4:1.5 D#4:.5 E4:1 F#4:2 D#4:1 B3:3',                                                      // chorus line two (+ rest)
        'D5:3 D5:1.5 C5:.5 B4:1 A4:2 F#4:1 D4:1.5 E4:.5 F#4:1',                                             // chorus again, C♮ this time
        'G4:1.5 F#4:.5 E4:1 D#4:1.5 C#4:.5 D#4:1 E4:3 E4:2',                                                 // the ending
      ].join(' '),
    },
  ].map(g => ({ title: `Greensleeves, part ${g.id - 26} of 4`, timbre: 'acoustic', layout: 'fretboard', tag: `Ear series · ${g.id - 26}/4`, tempoBpm: 150, tonicPc: 4, minor: true, key: 'E minor', ...g })),
].map(s => ({ kind: 'quiz', coldOpen: true, layout: 'keyboard', ...s, notes: parse(s.notes) }));

// Experiment H9 (docs/experiments.md): "guess the KEY" quiz instead of "play the melody back". kind "key", 10 s:
//   I–IV–V–I strummed on guitar from frame 0 → the same cadence again under four answer cards (A–D) → ends.
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

// #27–#30 re-cut per platform (docs/experiments.md, "Hook variants for #27–#30"): same notes, tag and timing, only the hook (and `sub`) differs.
//   #31–#34 YouTube, variant A = the form of #12 ("Everyone knows this one. Can you play it?"); #35–#38 Instagram, variant B = the form of #24
//   (an instruction, no number, accent on EAR, `neon`). The "Part N of 4" label lives in `sub`, so the hook itself stays pure. #27–#30 keep the neutral first cut.
const GS_PLATFORM = [
  { from: 27, yt: ['Everyone\nknows this one.\n*Can you play it?*', 'Part 1 of 4 · the first half of the verse'],
              ig: ['No tabs. No chords.\nLearn it by *EAR*. 4 parts.', 'Part 1 · the first half of the verse'] },
  { from: 28, yt: ['You know\nthis line.\n*Where does it turn?*', 'Part 2 of 4 · starts where Part 1 stopped'],
              ig: ['No tabs. No chords.\nPart 2. Just your *EAR*.', 'Starts where Part 1 stopped'] },
  { from: 29, yt: ['Everyone\nsings this part.\n*Can you play it?*', 'Part 3 of 4 · the chorus'],
              ig: ['Still no tabs.\nNow the big leap.\nJust your *EAR*.', 'Part 3 of 4 · the chorus'] },
  { from: 30, yt: ['Everyone\nknows this one.\n*Play all of it?*', 'Part 4 of 4 · verse and chorus · one listen'],
              ig: ['No tabs. No chords.\nPlay it all. *From memory.*', 'Part 4 of 4 · verse and chorus · one listen'] },
];
const GS_VARIANTS = [
  ...GS_PLATFORM.map(({ from, yt }, i) => ({ ...SERIES.find(c => c.id === from), id: 31 + i, hook: yt[0], sub: yt[1], title: `Greensleeves, part ${i + 1} of 4 (YouTube hook A)` })),
  ...GS_PLATFORM.map(({ from, ig }, i) => ({ ...SERIES.find(c => c.id === from), id: 35 + i, hook: ig[0], sub: ig[1], neon: true, title: `Greensleeves, part ${i + 1} of 4 (Instagram hook B)` })),
];

export const CLASSICS = [...SERIES, ...GS_VARIANTS, ...KEYQUIZ];
