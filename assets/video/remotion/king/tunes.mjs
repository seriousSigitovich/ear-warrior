// New tunes for #60's cut (the most-viewed Reel so far): the picture, hook, camera and sound of king/story.mjs unchanged, only the melody
// differs, and the timeline stretches or shrinks around it. Each entry is a whole story in king/story.mjs's shape, so king/audio.mjs and
// src/king/KingNeon.tsx (prop `tune`) take it as is.   node render-king.mjs --tune=<id>
// Notes are an octave down from the app's curated set (src/services/melody/candidates.ts) or #14's `classics.mjs`; the Bumblebee is from memory.
import { FPS, TUNING, noteName, midiAt } from './story.mjs';

/** The scene gaps of the Mountain King cut: the hold after the last note, then each line of "your turn" after the hold, and the tail. */
const GAPS = { hold: 0.35, cta: 0.45, sub: 0.95, comment: 1.45, sweep: 2.3, end: 1.6 };
/** A story from a melody: the same scene gaps as the Mountain King cut, measured from the melody's last note. */
function story({ id, title, notes, melody, bpm, hook, chord, maxFret = 4, ring, letRing = false, strum, listenAt = 2.75, gaps = GAPS, hookText = '97' }) {
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
    HOOK_TEXT: hookText,                                            // '97': "97% of guitarists can't play this by ear" · 'tabs': "can you play this without tabs?"
    CHORD: chord,
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
  // The same arpeggio as a 10 s looping band cut (src/rising/RisingBand.tsx): the melody from frame 0, ♩ = 144 so the film is exactly eight bars
  // (seven of melody, one bar of E back into the top), the "your turn" gaps tightened.
  risingBand: story({ ...RISING, id: 'risingBand', bpm: 144, listenAt: 0, gaps: { hold: 0.15, cta: 0.15, sub: 0.3, comment: 0.45, sweep: 0.85, end: 1.5 } }),
};
