// Silent Night "find it by ear" lesson — one source of truth for scene timing, narration, and the guitar/voice cues.
// lesson.mjs hands this to lesson.html (window.LESSON), lesson-score.mjs lays audio on it, voiceover.mjs prints the narration
// from it, so picture, sound and the text the author reads cannot drift.
//
// Narration is a list of lines, each with the scene-local second it STARTS. The picture and guitar are timed to those starts, so the author
// begins each line at its timecode and gets sync for free (voiceover.mjs checks every line finishes before the next at ~150 wpm).
//
// Melody: Franz Gruber, Stille Nacht — bars 1–8 of the Mutopia Project hymn edition (stille_nacht.ly, public domain, 6/8, B♭ major),
// transposed up a major third to D major so every note lies on the high E string (frets 0–12 = E4–E5). Rhythm in quarter-note beats.
export const W = 1920, H = 1080, FPS = 30;

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const midi = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] ? 1 : 0); };
const OPEN_E4 = 64; // high E string, open


const B1 = [['A4', .75], ['B4', .25], ['A4', .5], ['F#4', 1.5]];
const B3 = [['E5', 1], ['E5', .5], ['C#5', 1.5]];
const B4 = [['D5', 1], ['D5', .5], ['A4', 1.5]];
const B5 = [['B4', 1], ['B4', .5], ['D5', .75], ['C#5', .25], ['B4', .5]];
export const BARS = { 1: B1, 2: B1, 3: B3, 4: B4, 5: B5, 6: B1, 7: B5, 8: B1 };

/** Note events for the given bars, starting at `at` seconds (scene-local), played `speed`× faster than ♩ = 60. Returns the events and the onset of each note. */
function seq(bars, at, speed = 1, o = {}) {
  const ev = [];
  let t = at;
  const flat = bars.flatMap(b => BARS[b]);
  flat.forEach(([name, beats], i) => {
    const dur = beats / speed;
    ev.push({
      kind: o.kind ?? 'note', at: t, midi: midi(name), dur: dur + (i === flat.length - 1 ? (o.tail ?? 0.6) : 0.04),
      fret: midi(name) - OPEN_E4, label: String(midi(name) - OPEN_E4), vis: o.vis ?? true, gain: o.gain,
    });
    t += dur;
  });
  return ev;
}
const note = (at, m, dur, o = {}) => ({ kind: 'note', at, midi: m, dur, fret: m - OPEN_E4, vis: false, ...o });

export const SCENES = [
  {
    id: 'hook', title: null, dur: 12,
    lines: [
      [0.3, 'You know this tune, but without a tab your hands don’t know where to go.'],
      [7.0, 'Let’s fix that, on Silent Night, using just the high E string.'],
    ],
    cue: { titleIn: 0.3, subIn: 1.0, titleOut: 6.2, focus: 7.0, label: 8.0, nums: 8.2, tagline: 9.6 },
    audio: [...seq([1, 2], 0.4)],
  },
  {
    id: 'listen', title: 'Listen first', dur: 10,
    lines: [
      [0.3, 'First, hum the first four bars.'],
      [4.4, 'Bars one and two are the same:'],
      [7.4, 'only three bars to work out.'],
    ],
    cue: { same: 4.4, three: 7.6 },
    audio: [...seq([1, 2, 3, 4], 0.2, 1.5)],
  },
  {
    id: 'home', title: 'Step 1 · Find home', dur: 15,
    lines: [
      [0.3, 'Step one: find home, the note where the song feels finished.'],
      [5.0, 'Hum the last note of the song,'],
      [8.0, 'then slide up until the guitar matches your voice.'],
      [12.0, 'Fret ten, a D. That’s home.'],
    ],
    cue: { humText: 4.8, slideText: 8.0, slide: 8.4, step: 0.55, home: 11.15, label: 12.0, octave: 13.4 },
    audio: [
      { kind: 'hum', at: 5.4, midi: 62, dur: 2.4, gain: 0.5 },
      ...[69, 70, 71, 72, 73].map((m, i) => note(8.4 + i * 0.55, m, 0.52)),
      note(11.15, 74, 3.4),
    ],
  },
  {
    id: 'chords', title: 'Step 2 · Bright or dark', dur: 17,
    lines: [
      [0.2, 'Step two: bright or dark.'],
      [2.4, 'Play a D chord, then D minor.'],
      [5.6, 'One finger moves.'],
      [7.2, 'Hum the tune over each one. One fits.'],
      [10.8, 'The other doesn’t.'],
      [13.9, 'Silent Night is the bright one: major.'],
    ],
    cue: { dIn: 0.4, dmIn: 4.2, diff: 5.6, diffOut: 7.4, fits: 10.4, notFit: 13.8, concl: 14.0 },
    audio: [
      { kind: 'chord', name: 'D', at: 3.2, dur: 1.6 },
      { kind: 'chord', name: 'Dm', at: 4.8, dur: 1.6 },
      { kind: 'chord', name: 'D', at: 7.4, dur: 3.2, gain: 0.55 }, ...seq([1, 2], 7.4, 2, { kind: 'hum', tail: 0.2 }),
      { kind: 'chord', name: 'Dm', at: 10.8, dur: 3.2, gain: 0.55 }, ...seq([1, 2], 10.8, 2, { kind: 'hum', tail: 0.2 }),
    ],
  },
  {
    id: 'ladder', title: 'Step 3 · The frets of the key', dur: 17,
    lines: [
      [0.2, 'Step three: walk down from home.'],
      [3.0, 'Ten, nine, seven, five, three, two, zero, and twelve above home.'],
      [8.0, 'These frets belong to the key.'],
      [11.4, 'Only these frets sound right. Skip the others.'],
      [14.8, 'The search gets much smaller.'],
    ],
    cue: { start: 3.0, step: 0.5, twelve: 6.7, key: 8.0, skip: 11.4 },
    audio: [...[74, 73, 71, 69, 67, 66, 64].map((m, i) => note(3.0 + i * 0.5, m, 0.48)), note(6.7, 76, 0.8)],
  },
  {
    id: 'pick', title: 'Step 4 · Pick it note by note', dur: 30,
    lines: [
      [0.3, 'Step four: pick it note by note.'],
      [3.4, 'Sing the first words: Silent night.'],
      [6.2, 'Try fret five.'],
      [7.8, 'Up one step: fret six?'],
      [10.2, 'Not quite. Not in the key.'],
      [12.8, 'Fret seven.'],
      [14.0, 'Back to five, then down to two.'],
      [17.2, 'Bar two repeats.'],
      [19.4, 'Bar three leaps up to fret twelve.'],
      [22.4, 'Fret nine leans up to home.'],
      [25.0, 'Bar four: ten, ten, five.'],
      [27.4, 'Now you have your own tab.'],
    ],
    cue: { tries: [[6.2, 5, 'ok'], [8.4, 6, 'bad'], [12.8, 7, 'ok'], [14.4, 5, 'ok'], [16.0, 2, 'ok']], notQuite: 10.2, notQuiteOut: 12.6, leap: 19.5, octave: 21.0, pull: 22.4, noTab: 27.4 },
    audio: [
      note(6.2, 69, 1.0), note(8.4, 70, 1.0), note(12.8, 71, 1.0), note(14.4, 69, 1.0), note(16.0, 66, 1.0),
      ...seq([2], 17.3, 1.5),
      ...seq([3], 19.5, 1.2),
      note(22.4, 73, 0.7, { vis: true, label: '9' }), note(23.2, 74, 0.6, { vis: true, label: '10' }),
      ...seq([4], 25.0, 1.2, { tail: 0.6 }),
    ],
  },
  {
    id: 'outro', title: null, dur: 9,
    lines: [
      [0.3, 'Find home. Bright or dark. Key frets. Pick by ear.'],
      [5.0, 'Which song can’t you find tabs for? Comment it.'],
    ],
    cue: { cards: 0.3, cardStep: 1.0, cta: 5.0, comment: 5.6, brand: 7.0 },
    audio: [74, 78, 81].map((m, i) => ({ kind: 'bell', at: 5.0 + i * 0.1, midi: m, dur: 2.2, vis: false })),
  },
];

let t0 = 0;
for (const s of SCENES) { s.start = t0; t0 += s.dur; }
export const DUR = t0;
