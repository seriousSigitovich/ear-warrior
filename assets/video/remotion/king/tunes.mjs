// New tunes for #60's cut (the most-viewed Reel so far): the picture, hook, camera and sound of king/story.mjs unchanged, only the melody
// differs, and the timeline stretches or shrinks around it. Each entry is a whole story in king/story.mjs's shape, so king/audio.mjs and
// src/king/KingNeon.tsx (prop `tune`) take it as is.   node render-king.mjs --tune=<id>
// Notes are an octave down from the app's curated set (src/services/melody/candidates.ts) or #14's `classics.mjs`; the Bumblebee is from memory.
import { FPS, TUNING, noteName, midiAt } from './story.mjs';

/** The scene gaps of the Mountain King cut: the hold after the last note, then each line of "your turn" after the hold, and the tail. */
const GAPS = { hold: 0.35, cta: 0.45, sub: 0.95, comment: 1.45, sweep: 2.3, end: 1.6 };
/** Seconds between the strings of the opening chord's downstroke (`hookChord`): king/audio.mjs strums it, src/rising/RisingWood.tsx lands its notes so. */
export const STRUM_GAP = 0.018;
/** A story from a melody: the same scene gaps as the Mountain King cut, measured from the melody's last note. */
function story({ id, title, notes, melody, bpm, hook, hookChord, chord, maxFret = 4, ring, letRing = false, strum, listenAt = 2.75, gaps = GAPS, hookText = '97', endText = 'next', score, loop = false, slots = false }) {
  const MELODY = melody.map(([string, fret, beats]) => ({ string, fret, beats, midi: midiAt(string, fret), name: noteName(midiAt(string, fret)) }));
  const BEAT = 60 / bpm;
  const OFFSETS = MELODY.reduce((acc, n, i) => [...acc, i ? acc[i - 1] + MELODY[i - 1].beats * BEAT : 0], []);
  const PHRASE = OFFSETS.at(-1);
  const hold = listenAt + PHRASE + gaps.hold;
  const T = { hook: 0, listen: listenAt - 0.35, listenAt, hold, cta: hold + gaps.cta, sub: hold + gaps.sub, comment: hold + gaps.comment, sweep: hold + gaps.sweep };
  return {
    id, title, NOTES: notes, MAX_FRET: maxFret, FPS, TUNING, noteName, midiAt, MELODY, BPM: bpm, BEAT, PHRASE,
    STEP: Math.min(BEAT, 0.5), NOTE_RING: ring ?? BEAT + 0.12,       // `ring`: a sung, legato line lets each note ring into the next
    LET_RING: letRing,                                              // an arpeggio: each note rings on until its string plays again
    END_STRUM: strum,                                               // the last note sounds as this chord (MIDI), ringing into "your turn"
    DURATION: Math.round((T.sweep + gaps.end) * 10) / 10,
    T,
    HEARD: MELODY.map((n, i) => ({ ...n, t: listenAt + OFFSETS[i], order: i })),
    HOOK_NOTE: { string: hook[0], fret: hook[1], midi: midiAt(hook[0], hook[1]) },
    // `hookChord`: the opening hit strums the key's chord ([string, fret] each, low to high) in place of one low note, so the ear has the
    // key before the tune; `hook` is then the chord's root, where the camera sits
    HOOK_CHORD: hookChord?.map(([string, fret]) => ({ string, fret, midi: midiAt(string, fret) })),
    HOOK_TEXT: hookText,                                            // '97': "97% of guitarists can't play this by ear" · 'tabs': "can you play this without tabs?" · 'guitarist': 'tabs' under "guitarists only" · 'byear': "can you play this by ear?" under "guitarists only"
    END_TEXT: endText,                                              // 'next': "which song next?" · 'follow': follow for the next tunes
    CHORD: chord,
    SCORE: score,                                                   // the melody as written music (score() below), drawn as a staff
    LOOP: loop,                                                     // a looping cut: the melody from frame 0 (no hook hit), the neck clears before the end so the last frame leads into the first
    SLOTS: slots,                                                   // "? ? ?" slots that fill as the notes sound, in place of the staff or beads
  };
}

// The House of the Rising Sun (traditional, public domain), the guitar arpeggio everyone knows rather than the vocal line (the author:
// the sung melody is recognised worse than the harmony): Am C D F Am E, one bar of 6/8 each — bass, then G B e B G — and home on an
// Am strum (the author: ending on F/Am alone feels cut off; the E → Am cadence closes it). Open first-position shapes, frets 0–3,
// let ring. Beats are quarters; ♪ ≈ 0.21 s.
const RISING = {
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
};

/** Entry of the Gladiators: the four-bar phrase the theme opens with and comes back to (`gladiators` below). */
const PHRASE_GLADIATORS = [
  [4, 1, 1], [4, 0, 1], [3, 3, 0.5], [4, 0, 0.5], [3, 3, 0.5], [3, 2, 0.5],
  [3, 1, 1], [3, 0, 1], [2, 4, 1], [3, 0, 1],
  [3, 2, 1], [3, 1, 1], [3, 0, 0.5], [3, 1, 0.5], [3, 0, 0.5], [2, 4, 0.5],
  [2, 3, 1], [2, 2, 1], [2, 1, 1], [2, 2, 1],
];

/** Durations of `score()` tokens, in quarter beats. */
const DUR = { 16: 0.25, 8: 0.5, '8.': 0.75, q: 1, 'q.': 1.5, h: 2, 'h.': 3, w: 4, '8t': 1 / 3, '16t': 1 / 6 };   // 8t/16t: triplets, three in the time of two
/**
 * A melody written as guitar music: bars of `<pitch><octave>:<dur>[~]` tokens (B♭ as Bb, sharps as #; `~` ties into the next token), written
 * an octave above the sound as guitar parts are. Gives story() its `melody` (a tied note is one attack; each on the lowest fret it has) and
 * `notes`, and the bars themselves as SCORE for the staff. The first bar may be a pickup.
 */
function score({ key, time, bars, maxFret = 4 }) {
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const parsed = bars.map((bar) => bar.split(/\s+/).map((tok) => {
    const r = tok.match(/^r:(16|8\.?|q\.?|h\.?|w)$/);              // a rest: silence that lengthens the note before it in time
    if (r) return { step: 'r', acc: '', octave: 0, dur: r[1], beats: DUR[r[1]], tie: false, midi: NaN, rest: true };
    const m = tok.match(/^([A-G])(#|b)?(\d):(16t?|8t|8\.?|q\.?|h\.?|w)(~)?$/);
    if (!m) throw new Error(`score: bad token ${tok}`);
    const written = 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return { step: m[1], acc: m[2] ?? '', octave: Number(m[3]), dur: m[4], beats: DUR[m[4]], tie: !!m[5], midi: written - 12 };
  }));
  const flat = parsed.flat();
  const melody = [];
  flat.forEach((n, i) => {
    if (n.rest) { if (!melody.length) throw new Error('score: a rest before the first note'); melody.at(-1)[2] += n.beats; n.order = melody.length - 1; return; }
    if (i > 0 && flat[i - 1].tie) { melody.at(-1)[2] += n.beats; n.order = melody.length - 1; return; }
    const [string, fret] = TUNING.map((open, s) => [s, n.midi - open]).filter(([, f]) => f >= 0 && f <= maxFret).sort((a, b) => a[1] - b[1])[0] ?? [];
    if (string === undefined) throw new Error(`score: ${noteName(n.midi)} is off the first ${maxFret} frets`);
    n.order = melody.length;
    melody.push([string, fret, n.beats]);
  });
  const notes = melody.map(([s, f]) => noteName(midiAt(s, f))).join(' ');
  return { melody, notes, maxFret, score: { key, time, bars: parsed } };
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
  // Bella ciao (Italian folk song, public domain), A minor, ♩ = 140: "Una mattina / mi son svegliato / o bella ciao, bella ciao, bella
  // ciao ciao ciao", 22 notes, the hook "can you play this without tabs?". Notes and rhythm from the Wikibooks Liederbuch score (LilyPond,
  // `de.wikibooks.org/wiki/Liederbuch/_Bella_Ciao`), an octave down: E A B C A · E A B C A · E A B C B A C B A and up to the high E for
  // "ciao ciao ciao". #73 had piano-keyboard-guide.com's version (B A E for the third "bella ciao", ending low) — wrong, the author deleted it.
  // E3–E4 on the D, G, B and high E strings, frets 0–2.
  bella: story({
    id: 'bella', title: 'Bella ciao', hookText: 'tabs',
    notes: 'E3 A3 B3 C4 A3 E3 A3 B3 C4 A3 E3 A3 B3 C4 B3 A3 C4 B3 A3 E4 E4 E4',
    melody: [
      [2, 2, 0.5], [3, 2, 0.5], [4, 0, 0.5], [4, 1, 0.5], [3, 2, 2],                       // u-na mat-ti-na
      [2, 2, 0.5], [3, 2, 0.5], [4, 0, 0.5], [4, 1, 0.5], [3, 2, 2],                       // mi son sve-glia-to
      [2, 2, 0.5], [3, 2, 0.5], [4, 0, 0.5], [4, 1, 1], [4, 0, 0.5], [3, 2, 0.5], [4, 1, 1],   // o bel-la ciao, bel-la ciao,
      [4, 0, 0.5], [3, 2, 0.5], [5, 0, 1], [5, 0, 1], [5, 0, 1.5],                          // bel-la ciao, ciao, ciao
    ],
    bpm: 140, hook: [0, 0], chord: [69, 72, 76],                  // hit E2, the fifth · A minor
  }),
  // The House of the Rising Sun arpeggio (RISING above), #71.
  rising: story(RISING),
  // New tunes for #71's warm-wood cut (src/rising/RisingWood.tsx, `node render-rising.mjs --tune=<id>`), the next untested tunes at the top of
  // docs/tune-ranking.md. Notes and rhythm from real scores, an octave down, as guitar music is written; each ends on its home chord strummed.
  // Pachelbel, Canon in D (public domain): violin I's entry over the ground bass, bars 3–4 of the Mutopia score (`PachelbelJ/
  // Canon_per_3_Violini_e_Basso`, violin_common.ily + violoncello.ily): F# E D C# B A B C# over D A B F# G D G A, all quarters. Played
  // as a guitarist would: each bass note, then its melody note, let ring; home on a D strum. Frets 0–3.
  canon: story({
    id: 'canon', title: 'Canon in D', hookText: 'tabs', letRing: true, ring: 1.6,
    notes: 'D3 F#4 A2 E4 B2 D4 F#2 C#4 G2 B3 D3 A3 G2 B3 A2 C#4 D3',
    melody: [
      [2, 0, 1], [5, 2, 1], [1, 0, 1], [5, 0, 1], [1, 2, 1], [4, 3, 1], [0, 2, 1], [4, 2, 1],    // D–F#  A–E  Bm–D  F#m–C#
      [0, 3, 1], [4, 0, 1], [2, 0, 1], [3, 2, 1], [0, 3, 1], [4, 0, 1], [1, 0, 1], [4, 2, 1],    // G–B   D–A  G–B   A–C#
      [2, 0, 1.5],                                                                             // D, home: sounds as the strum below
    ],
    strum: [50, 57, 62, 66],                                       // D xx0232
    bpm: 112, hook: [1, 0], chord: [74, 78, 81],                  // hit A2, the fifth · D major
  }),
  // Scarborough Fair (English traditional, public domain), D dorian, 6/8, the first two lines: "Are you going to Scarborough Fair? / Parsley,
  // sage, rosemary and thyme". Wikibooks Liederbuch score (LilyPond, `de.wikibooks.org/wiki/Liederbuch/_Scarborough_Fair`):
  // d4 d8 a a a | e8. f16 e8 d4. | r8 a c d4 c8 | a b g a4.~a8. D3–D4 on the D, G and B strings, frets 0–3; home on a Dm strum.
  scarborough: story({
    id: 'scarborough', title: 'Scarborough Fair', hookText: 'tabs', letRing: true, ring: 1.6,
    notes: 'D3 D3 A3 A3 A3 E3 F3 E3 D3 A3 C4 D4 C4 A3 B3 G3 A3',
    melody: [
      [2, 0, 1], [2, 0, 0.5], [3, 2, 0.5], [3, 2, 0.5], [3, 2, 0.5],                       // Are you go-ing to
      [2, 2, 0.75], [2, 3, 0.25], [2, 2, 0.5], [2, 0, 2],                                  // Scar-bo-rough Fair (and the rest)
      [3, 2, 0.5], [4, 1, 0.5], [4, 3, 1], [4, 1, 0.5],                                    // Pars-ley, sage, rose-
      [3, 2, 0.5], [4, 0, 0.5], [3, 0, 0.5], [3, 2, 2],                                    // -ma-ry and thyme: sounds as the strum
    ],
    strum: [50, 57, 62, 65],                                       // Dm xx0231
    bpm: 80, hook: [1, 0], chord: [74, 77, 81],                   // hit A2, the fifth · D minor
  }),
  // Greensleeves (English traditional, public domain), A dorian, 6/8, the pickup and bars 5–8 ("For I have loved you well and long, delighting
  // in your company" — bars 1–2 again, then the cadence). Wikibooks Liederbuch score (LilyPond, `de.wikibooks.org/wiki/Liederbuch/_Greensleeves`):
  // a8 | c4 d8 e8. fis16 e8 | d4 h8 g8. a16 h8 | c8. h16 a8 gis8. fis16 gis8 | a4 a8 a4. F#3–F#4, frets 0–4; home on an Am strum.
  greensleeves: story({
    id: 'greensleeves', title: 'Greensleeves', hookText: 'tabs', letRing: true, ring: 1.6,
    notes: 'A3 C4 D4 E4 F#4 E4 D4 B3 G3 A3 B3 C4 B3 A3 G#3 F#3 G#3 A3 A3 A3',
    melody: [
      [3, 2, 0.5],
      [4, 1, 1], [4, 3, 0.5], [5, 0, 0.75], [5, 2, 0.25], [5, 0, 0.5],
      [4, 3, 1], [4, 0, 0.5], [3, 0, 0.75], [3, 2, 0.25], [4, 0, 0.5],
      [4, 1, 0.75], [4, 0, 0.25], [3, 2, 0.5], [3, 1, 0.75], [2, 4, 0.25], [3, 1, 0.5],
      [3, 2, 1], [3, 2, 0.5], [3, 2, 1.5],                                                 // the last A sounds as the strum
    ],
    strum: [45, 52, 57, 60, 64],                                   // Am x02210
    bpm: 90, hook: [0, 0], chord: [69, 72, 76],                   // hit E2, the fifth · A minor
  }),
  // Happy Birthday to You (Hill sisters, public domain), the whole tune, 3/4. Wikibooks Liederbuch score (LilyPond, `de.wikibooks.org/wiki/
  // Liederbuch/_Happy_Birthday_to_You`), there in E major, here moved to C so it sits in first position (G3–G4, frets 0–3): G G A G C B ·
  // G G A G D C · G G G' E C B A · F F E C D C. Home on a C strum.
  birthday: story({
    id: 'birthday', title: 'Happy Birthday', hookText: 'tabs', letRing: true, ring: 1.6,
    notes: 'G3 G3 A3 G3 C4 B3 G3 G3 A3 G3 D4 C4 G3 G3 G4 E4 C4 B3 A3 F4 F4 E4 C4 D4 C4',
    melody: [
      [3, 0, 0.5], [3, 0, 0.5], [3, 2, 1], [3, 0, 1], [4, 1, 1], [4, 0, 2],
      [3, 0, 0.5], [3, 0, 0.5], [3, 2, 1], [3, 0, 1], [4, 3, 1], [4, 1, 2],
      [3, 0, 0.5], [3, 0, 0.5], [5, 3, 1], [5, 0, 1], [4, 1, 1], [4, 0, 1], [3, 2, 1],
      [5, 1, 0.5], [5, 1, 0.5], [5, 0, 1], [4, 1, 1], [4, 3, 1], [4, 1, 1.5],              // the last C sounds as the strum
    ],
    strum: [48, 52, 55, 60, 64],                                   // C x32010
    bpm: 132, hook: [0, 3], chord: [72, 76, 79],                  // hit G2, the fifth · C major
  }),
  // Fučík, Entry of the Gladiators (1897, public domain), the circus theme: the whole first strain with its second ending, 16 bars. Notes and
  // rhythm from the MIDI on Wikimedia Commons (`File:Fucik entrée des gladiateurs.mid`, its bars 13–24 and 41–45), checked against the 1897
  // piano reduction there (`File:Einzug der gladiatoren score.jpg`, where the second eighth is c-flat): the phrase c'4 h | b8 h b a | as4 g fis g | a as g8 as g fis | f4 e dis e,
  // twice "g · f f cis d", the chromatic run up h8 … fis | g gis a h a4 g, the phrase again, and the second ending c c c a d | dis dis dis b2 |
  // h8 d' cis' c' h4 a | g with the bass walking g g g f e d down to c. Two octaves down (the bass walk as written) so it sits in first
  // position (B2–D4, frets 0–4); beats are quarters, ♩ = 200 (the MIDI's tempo, 𝅗𝅥 = 100), the one eighth rest folded into the note before it.
  // Staccato, so no let-ring; home on a C strum.
  gladiators: story({
    id: 'gladiators', title: 'Entry of the Gladiators', hookText: 'tabs',
    notes: [
      'C4 B3 A#3 B3 A#3 A3 G#3 G3 F#3 G3 A3 G#3 G3 G#3 G3 F#3 F3 E3 D#3 E3',      // A♭ B♭ spelled as the checker names them
      'G3 F3 F3 C#3 D3 G3 F3 F3 C#3 D3',
      'B2 C3 C#3 D3 D#3 E3 F3 F#3 G3 G#3 A3 B3 A3 G3',
      'C4 B3 A#3 B3 A#3 A3 G#3 G3 F#3 G3 A3 G#3 G3 G#3 G3 F#3 F3 E3 D#3 E3',
      'C3 C3 C3 A3 D3 D#3 D#3 D#3 A#3 B3 D4 C#4 C4 B3 A3 G3 G3 G3 G3 F3 E3 D3 C3',
    ].join(' '),
    melody: [
      ...PHRASE_GLADIATORS,
      [3, 0, 1], [2, 3, 0.5], [2, 3, 0.5], [1, 4, 1], [2, 0, 1],
      [3, 0, 1], [2, 3, 0.5], [2, 3, 0.5], [1, 4, 1], [2, 0, 1],
      [1, 2, 0.5], [1, 3, 0.5], [1, 4, 0.5], [2, 0, 0.5], [2, 1, 0.5], [2, 2, 0.5], [2, 3, 0.5], [2, 4, 0.5],
      [3, 0, 0.5], [3, 1, 0.5], [3, 2, 0.5], [4, 0, 0.5], [3, 2, 1], [3, 0, 1],
      ...PHRASE_GLADIATORS,
      [1, 3, 1], [1, 3, 0.5], [1, 3, 0.5], [3, 2, 1], [2, 0, 1],
      [2, 1, 1], [2, 1, 0.5], [2, 1, 0.5], [3, 3, 2],
      [4, 0, 0.5], [4, 3, 0.5], [4, 2, 0.5], [4, 1, 0.5], [4, 0, 1], [3, 2, 1],
      [3, 0, 1], [3, 0, 0.5], [3, 0, 0.5], [3, 0, 0.5], [2, 3, 0.5], [2, 2, 0.5], [2, 0, 0.5],
      [1, 3, 2],                                                                           // the last C sounds as the strum
    ],
    strum: [48, 52, 55, 60, 64],                                   // C x32010
    bpm: 200, hook: [0, 3], chord: [72, 76, 79],                  // hit G2, the fifth · C major
  }),
  // Dark Eyes / Очи чёрные (Russian romance, Hrebinka's 1843 words on Hermann's 1884 Hommage-Valse, public domain), the whole verse, 3/4.
  // Melody from the 8notes.com piano score "Dark Eyes" (Russian trad., arr. CM, E minor; its top voice, the second ending), moved down a
  // tone to D minor, the key guitarists play it in. Frank Nordberg's ABC (Musica Viva X:2859) was used first and is wrong in three places
  // the author heard: "очи жгучие" must hang on the leading note (D C# C#, not D C# D), and both "вас" in "как люблю я вас, как боюсь я
  // вас" leap down (B♭, A), not stay up (E, D). Written as guitar music (treble clef an octave up, see `score()`); the staff in
  // src/rising/Staff.tsx draws it. G#3–G4, frets 0–3, let ring, home on a Dm strum.
  darkeyes: story({
    id: 'darkeyes', title: 'Dark Eyes', hookText: 'tabs', letRing: true, ring: 1.6,
    ...score({
      key: 'Dm', time: [3, 4],
      bars: [
        'G#4:q A4:q',                          // О-чи
        'Bb4:q. A4:8 A4:q~', 'A4:q G#4:q A4:q', // чёр-ны-е, о-чи
        'Bb4:q. A4:8 A4:q~', 'A4:q A4:q D5:q',  // страст-ны-е, о-чи
        'D5:q. C#5:8 C#5:q~', 'C#5:q E5:q F5:q', // жгу-чи-е и пре-
        'E5:q. D5:8 D5:q~', 'D5:q F5:q G5:q',   // -крас-ны-е, как люб-
        'F5:q. E5:8 Bb4:q~', 'Bb4:q E5:q F5:q', // -лю я вас, как бо-
        'E5:q. D5:8 A4:q~', 'A4:q G#4:q A4:q',  // -юсь я вас, знать у-
        'Bb4:q. A4:8 A4:q~', 'A4:q E5:q F5:q',  // -ви-дел вас, я не в
        'E5:q. D5:8 D5:q~', 'D5:h.',            // доб-рый час: the last D sounds as the strum
      ],
    }),
    strum: [50, 57, 62, 65],                                       // Dm xx0231
    bpm: 176, hook: [1, 0], chord: [74, 77, 81],                  // hit A2, the fifth · D minor
  }),
  // La Cucaracha (Mexican folk song, public domain), the chorus "La cucaracha, la cucaracha, ya no puede caminar…", F major, with its
  // three-eighth pickup. Pitches agree in four sources: the Public Domain Song Anthology scan on Wikimedia Commons (`File:La Cucaracha
  // (Public Domain Song Anthology).jpg`, 3/4), en.wikipedia's LilyPond copy of it, that anthology's MIDI (`File:La Cucaracha (pg).mid`) and the
  // flutetunes.com MIDI (id 228, in G). The rhythm is the two MIDIs', which agree note for note: the familiar swaying 4/4 — "RA" long, "CHA"
  // off the beat, "ya" and "ma" a quarter, "-nar" held. The 3/4 scan squares it into even eighths, which the author heard as off (2026-11-06).
  // Bars laid out as flutetunes', "ra" on the downbeat, every bar 3+3+2. Written an octave above the sound: C3–D4, frets 0–3, 34 notes.
  // Home on an F strum (xx3211).
  cucaracha: story({
    id: 'cucaracha', title: 'La Cucaracha', hookText: 'tabs', ring: 0.6,           // no let ring: the open G of "fal-ta" rang over the C pickups
    ...score({
      key: 'F', time: [4, 4],
      bars: [
        'C4:8 C4:8 C4:8',                          // la cu-ca-
        'F4:q. A4:q C4:8 C4:8 C4:8',               // -ra-cha, la cu-ca-
        'F4:q. A4:q~ A4:q.~',                      // -ra-cha,
        'A4:8 F4:q F4:8 E4:8 E4:8 D4:8 D4:8',      // ya no pue-de ca-mi-
        'C4:q.~ C4:q C4:8 C4:8 C4:8',              // -nar, por-que no
        'E4:q. G4:q C4:8 C4:8 C4:8',               // tie-ne, por-que le
        'E4:q. G4:q~ G4:q.~',                      // fal-ta
        'G4:8 C5:q D5:8 C5:8 Bb4:8 A4:8 G4:8',     // ma-ri-hua-na que fu-
        'F4:w',                                    // -mar: the last F sounds as the strum
      ],
    }),
    strum: [53, 57, 60, 65],                                       // F xx3211
    bpm: 180, hook: [1, 3], chord: [72, 77, 81],                  // hit C3, the fifth · F major
  }),
  // Hava Nagila (the 1918 Idelsohn setting of a Hasidic nigun; Idelsohn d. 1938, public domain), the first phrase everyone knows: "Ha-va
  // na-gi-la, ha-va na-gi-la, ha-va na-gi-la ve-nis-me-cha". From the LilyPond score in en.wikipedia's article (D freygish, written with a G
  // minor key signature): d4 d4. fis8 es d | fis4 fis4. a8 g fis | g4 g4. bes8 a g | fis4 es16 d es8 d2. Commons' `File:Hava nagila.mid`
  // (a piano arrangement in E) has the same degrees and the same 16-16-8 turn on "ve-nis-me-". Written an octave above the sound: D3–B♭3 on
  // the D and G strings, frets 0–4, 19 notes. Home on a D major strum (the freygish tonic).
  hava: story({
    id: 'hava', title: 'Hava Nagila', hookText: 'tabs', ring: 0.75,
    ...score({
      key: 'Gm', time: [4, 4],
      bars: [
        'D4:q D4:q. F#4:8 Eb4:8 D4:8',             // Ha-va na-gi-la,
        'F#4:q F#4:q. A4:8 G4:8 F#4:8',            // ha-va na-gi-la,
        'G4:q G4:q. Bb4:8 A4:8 G4:8',              // ha-va na-gi-la
        'F#4:q Eb4:16 D4:16 Eb4:8 D4:h',           // ve-nis-me-cha: the last D sounds as the strum
      ],
    }),
    strum: [50, 57, 62, 66],                                       // D xx0232
    bpm: 126, hook: [1, 0], chord: [74, 78, 81],                  // hit A2, the fifth · D major
  }),
  // Ievan polkka (Finnish folk polka, traditional; the melody is public domain, Kettunen's 1930s lyrics are not and are not used), the
  // first strain once through. From thesession.org tune 418, where its settings agree on this strain;
  // the A minor ones (13274, 48817: Am G Am · Am Dm C Am) read E | A>A AB | cA Ac | BG GB | c/B/A/G/ AE | A>A AB | cA Ac | de/d/ cB | A2 A2.
  // 2/4, written an octave above the sound: E3–E4 on the D, G, B and high E strings, frets 0–3, 34 notes. Opens on an A minor strum (the
  // key's chord, not one low note), home on the same strum.
  polkka: story({
    id: 'polkka', title: 'Ievan Polkka', hookText: 'guitarist', endText: 'follow',
    ...score({
      key: 'Am', time: [2, 4],
      bars: [
        'E4:8',                                     // pickup
        'A4:8. A4:16 A4:8 B4:8',                   // bar 1
        'C5:8 A4:8 A4:8 C5:8',                     // 2
        'B4:8 G4:8 G4:8 B4:8',                     // 3 (G major)
        'C5:16 B4:16 A4:16 G4:16 A4:8 E4:8',       // 4
        'A4:8. A4:16 A4:8 B4:8',                   // 5
        'C5:8 A4:8 A4:8 C5:8',                     // 6
        'D5:8 E5:16 D5:16 C5:8 B4:8',              // 7 (Dm, C)
        'A4:q A4:q',                                // 8: the last A sounds as the strum
      ],
    }),
    hookChord: [[1, 0], [2, 2], [3, 2], [4, 1], [5, 0]],           // Am x02210, the opening hit
    strum: [45, 52, 57, 60, 64],                                   // Am x02210, home
    bpm: 132, hook: [1, 0], chord: [69, 72, 76],                  // the chord's root A2 · A minor
  }),
  // Brahms, Wiegenlied op. 49 no. 4 ("Guten Abend, gut' Nacht", 1868, public domain), the first strophe's opening half: "Lullaby and good
  // night … lay thee down now and rest" up to the C. From the LilyPond score in de.wikipedia's article (sourced to the Brahms-Institut
  // Lübeck), E♭ major there, here a minor third down in C: g g | b♭. g g | b♭ r g b♭ | e♭ d. c | c b♭ f g | a♭ f f g | a♭ r f a♭ | d c b♭ d | e♭.
  // The two quarter rests are folded into the note before them (a half), so the guitar rings through the breath. 3/4 with an eighth pickup,
  // written an octave above the sound: D3–C4, frets 0–3, 27 notes. Drawn as a melody contour (src/contour/ContourLine.tsx), not a tab.
  brahms: story({
    id: 'brahms', title: 'Brahms — Lullaby', hookText: 'tabs', ring: 0.95,
    ...score({
      key: 'C', time: [3, 4],
      bars: [
        'E4:8 E4:8',                                // lul-la-
        'G4:q. E4:8 E4:q',                          // -by and good
        'G4:h E4:8 G4:8',                           // night, with
        'C5:q B4:q. A4:8',                          // ro-ses be-
        'A4:q G4:q D4:8 E4:8',                      // -dight, with
        'F4:q D4:q D4:8 E4:8',                      // lil-ies o'er-
        'F4:h D4:8 F4:8',                           // -spread is ba-
        'B4:8 A4:8 G4:q B4:q',                      // -by's wee
        'C5:h.',                                    // bed: the C sounds as the strum
      ],
    }),
    strum: [48, 52, 55, 60, 64],                                   // C x32010
    bpm: 138, hook: [0, 3], chord: [72, 76, 79],                  // hit G2, the fifth · C major
  }),
  // Mozart, Symphony No. 40 in G minor K. 550 (1788, public domain), I. Molto allegro: the first violins' theme, both four-bar phrases —
  // "da-da-DUM" three times, the leap to B♭, the fall to C; the same a step down, the leap to A, the fall to B♭. Bars 1–5 from the LilyPond
  // score in en.wikipedia's article: es8 d | d4 es8 d d4 es8 d | d4 bes' r bes8 a | g4 g8 f es4 es8 d | c4 c; the answer (r d8 c | c4 d8 c
  // c4 d8 c | c4 a' r a8 g | fis4 fis8 es d4 d8 c | bes4 bes) is the same sequence a step down, from memory. Alla breve, 𝅗𝅥 = 105 → ♩ = 210.
  // Written an octave above the sound: B♭3–B♭4, 40 notes. Drawn as note silhouettes (src/notes/NoteSilhouettes.tsx), no staff, no frets.
  // Opens on a G minor strum (the key's chord), home on the same chord.
  mozart40: story({
    id: 'mozart40', title: 'Mozart — Symphony No. 40', hookText: 'guitarist', endText: 'follow', ring: 0.32,
    ...score({
      key: 'Gm', time: [2, 2], maxFret: 6,
      bars: [
        'Eb5:8 D5:8',                                           // pickup
        'D5:q Eb5:8 D5:8 D5:q Eb5:8 D5:8',                      // da-da-DUM, da-da-DUM
        'D5:q Bb5:q r:q Bb5:8 A5:8',                            // DUM, the leap
        'G5:q G5:8 F5:8 Eb5:q Eb5:8 D5:8',                      // the fall
        'C5:q C5:q r:q D5:8 C5:8',                              // to C · the answer's pickup
        'C5:q D5:8 C5:8 C5:q D5:8 C5:8',
        'C5:q A5:q r:q A5:8 G5:8',
        'F#5:q F#5:8 Eb5:8 D5:q D5:8 C5:8',
        'Bb4:q Bb4:q',                                          // home: the last B♭ sounds as the strum
      ],
    }),
    hookChord: [[0, 3], [1, 5], [2, 5], [3, 3], [4, 3], [5, 3]],   // G minor 355333, the opening hit
    strum: [43, 50, 55, 58, 62, 67],                               // G minor, home
    bpm: 210, hook: [0, 3], chord: [67, 70, 74],                  // the chord's root G2 · G minor
    gaps: { hold: 0.32, cta: 0.25, sub: 0.45, comment: 0.5, sweep: 0.9, end: 1.65 },  // the author: the ending dragged — 1.5 s shorter tail, follow line still 2 s
  }),
  // Paco Cepero, the bulería falseta behind El Turronero's "Olivares del campo" (NOT public domain: Cepero, b. 1942, is alive), the thumb
  // line of its repeated section. Notes and rhythm from the free canteytoque.es transcription (`canteytoque.es/ceperoturroneroolivares.htm`,
  // image `bulceperoolivares.png`), bars 6–12 with the first ending: E E E E E | E F G A G | F E D E D | C# E F E | F E F E F E D |
  // D E D C# D | E D C#. Played there with a capo at 2 (sounding B phrygian); here without it, A phrygian por medio, frets 0–4 on the A, D
  // and G strings, as the tab fingers it. The beamed eighth threes are triplets (each 3/4 bar adds up only that way), so ⅓-beat notes;
  // the slurs are hammer-ons and pull-offs, legato, let ring. ♩ = 200, a calm bulería. Home on the A major chord the falseta lands on.
  bulerias: story({
    id: 'bulerias', title: 'Bulerías (Paco Cepero)', hookText: 'tabs', ring: 0.5,
    notes: 'E3 E3 E3 E3 E3 E3 F3 G3 A3 G3 F3 E3 D3 E3 D3 C#3 E3 F3 E3 F3 E3 F3 E3 F3 E3 D3 D3 E3 D3 C#3 D3 E3 D3 C#3',
    melody: [
      [2, 2, 1 / 3], [2, 2, 1 / 3], [2, 2, 1 / 3], [2, 2, 1], [2, 2, 1],
      [2, 2, 1], [2, 3, 1], [3, 0, 1 / 3], [3, 2, 1 / 3], [3, 0, 1 / 3],
      [2, 3, 1], [2, 2, 1], [2, 0, 1 / 3], [2, 2, 1 / 3], [2, 0, 1 / 3],
      [1, 4, 2], [2, 2, 1 / 3], [2, 3, 1 / 3], [2, 2, 1 / 3],
      [2, 3, 1 / 3], [2, 2, 1 / 3], [2, 3, 1 / 3], [2, 2, 1 / 3], [2, 3, 1 / 3], [2, 2, 1 / 3], [2, 0, 1],
      [2, 0, 1 / 3], [2, 2, 1 / 3], [2, 0, 1 / 3], [1, 4, 1], [2, 0, 1],
      [2, 2, 0.5], [2, 0, 0.5], [1, 4, 2],                                                // the last C# sounds as the strum
    ],
    strum: [45, 52, 57, 61, 64],                                   // A major x02220
    bpm: 200, hook: [0, 0], chord: [69, 73, 76],                  // hit E2, the fifth · A major (phrygian home)
  }),
  // Bizet, Carmen (1875, public domain), the Habanera "L'amour est un oiseau rebelle": its first line, the chromatic fall everyone knows —
  // "L'a-mour est un oi-seau re-bel-le, que nul ne peut ap-pri-voi-ser". From the LilyPond score in en.wikipedia's "Habanera (aria)" (D minor,
  // 2/4, Carmen's line): r4 d8 cis | \times 2/3 { c c c } b bes | a8 a16 a gis8 g | \times 2/3 { f16 g f } e f g8 f | e8. Written an octave
  // above the sound: E3–D4 on the D, G and B strings, frets 0–3, 17 notes. ♩ = 76 (Allegretto quasi andantino). Opens on a D minor strum
  // (the key's chord); the line stops on E over the dominant, so home is an A7 strum, the question the habanera keeps asking.
  habanera: story({
    id: 'habanera', title: 'Habanera (Carmen)', hookText: 'byear', endText: 'follow', ring: 0.55,
    listenAt: 1.4,                                                 // the author: the intro halved (2.75 → 1.4 s); the hook gives way to the staff, no "Listen once."
    gaps: { hold: 0.32, cta: 0.1, sub: 0.25, comment: 0.2, sweep: 0.6, end: 1.7 },  // the author: 2 s off the tail; the follow line still 2 s
    ...score({
      key: 'Dm', time: [2, 4],
      bars: [
        'D5:8 C#5:8',                               // L'a-mour
        'C5:8t C5:8t C5:8t B4:8 Bb4:8',             // est un oi-seau re-
        'A4:8 A4:16 A4:16 G#4:8 G4:8',              // -bel-le, que nul ne
        'F4:16t G4:16t F4:16t E4:16 F4:16 G4:8 F4:8', // peut ap-pri-voi-
        'E4:h',                                     // -ser: the E sounds as the strum
      ],
    }),
    hookChord: [[2, 0], [3, 2], [4, 3], [5, 1]],                   // D minor xx0231, the opening hit
    strum: [45, 52, 55, 61, 64],                                   // A7 x02020, home
    bpm: 76, hook: [2, 0], chord: [69, 73, 76],                   // the chord's root D3 · A major (the dominant the line ends on)
  }),
  // El Cóndor Pasa (Daniel Alomía Robles, 1913; he died in 1942, so the original is public domain; Simon & Garfunkel's "If I Could" is not used).
  // Notes and rhythm from the free flutetunes.com MIDI (`tunes/el-condor-pasa.mid`, A minor, 4/4, ♩ = 76 there): the pickup E, then bars of
  // A G# A B C B C D | E(3) G G | E(3) A G | E(2.5) E D C | D C A. Grace notes (B, D) left out. Flute pitch is the written guitar pitch, so the
  // sound is an octave down (E3–A4): frets 0–5, the A on the high e string at fret 5 is the only note past fret 4. 22 notes, the first phrase, ending
  // on the Am the tune comes home to — which is also what leads back into its pickup E, so the cut loops. ♩ = 100 (the tune is slow; 17 beats ≈ 10 s).
  // A looping cut: the pickup E sounds at 0.12 s (its spark already in flight on frame 0), no hook hit, "? ? ?" slots fill as the notes sound.
  condor: story({
    id: 'condor', title: 'El Cóndor Pasa', hookText: 'byear', endText: 'follow', ring: 1.6, loop: true, slots: true,
    listenAt: 0.12,
    gaps: { hold: 0.35, cta: 0.1, sub: 0.25, comment: 0.2, sweep: 0.6, end: 1.7 },  // the tail as Habanera's; the loop clears the last 0.5 s
    ...score({
      key: 'Am', time: [4, 4], maxFret: 5,
      bars: [
        'E4:8',                                       // pickup
        'A4:8 G#4:8 A4:8 B4:8 C5:8 B4:8 C5:8 D5:8',
        'E5:h. G5:8 G5:8',
        'E5:h. A5:8 G5:8',
        'E5:h~ E5:8 E5:8 D5:8 C5:8',                 // the first E rings 2.5 beats
        'D5:16 C5:16 A4:h',                           // home: sounds as the strum
      ],
    }),
    strum: [45, 52, 57, 60, 64],                                   // Am x02210, the chord the tune comes home to
    bpm: 100, hook: [5, 0], chord: [69, 72, 76],                  // camera sits on the pickup E · A minor
  }),
  // The same arpeggio as a 10 s looping band cut (src/rising/RisingBand.tsx): the melody from frame 0, ♩ = 144 so the film is exactly eight bars
  // (seven of melody, one bar of E back into the top), the "your turn" gaps tightened.
  risingBand: story({ ...RISING, id: 'risingBand', bpm: 144, listenAt: 0, gaps: { hold: 0.15, cta: 0.15, sub: 0.3, comment: 0.45, sweep: 0.85, end: 1.5 } }),
};
