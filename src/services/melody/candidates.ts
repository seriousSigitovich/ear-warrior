// First batch of candidates for the 100-melody library: public-domain tunes only. NOT served to
// players yet — a tune moves into `CURATED` (curated.ts) once the owner has listened to it.
//
// Every tune was written from memory (no score or MIDI to check against), so any of them may hold a
// wrong note. The tests catch a note outside the declared key, never a wrong note inside it: listen.
//
// Rights rule (2026): a composed tune qualifies when its composer died in 1955 or earlier (life + 70,
// EU) and it was published in 1930 or earlier (US). Folk tunes carry no composer. Take the melody
// only, never a modern arrangement of it.
//
// `notes` is "pitch:beats" tokens, as in curated.ts. The base (pentatonic / diatonic / chromatic) and
// the note count are NOT stored: `classify()` derives them from the notes.
export interface Candidate {
  /** Stable, hyphen-free, and different from every id in CURATED. */
  id: string;
  title: string;
  /** "<Root>_<family>" the tune is written in; `<Root>_chromatic` when it needs more than one key. */
  scale: string;
  notes: string;
  /** Absent for a folk tune. */
  composer?: string;
  /** Composer's year of death. */
  died?: number;
  /** Year of first publication (or composition when that is all that is known). */
  year?: number;
}

export const CANDIDATES: readonly Candidate[] = [
  // ── Pentatonic ────────────────────────────────────────────────────────────────────────────
  { id: 'chimes4', title: 'Westminster Quarters (first quarter)', scale: 'E_major_pentatonic', notes: 'G#4:1 F#4:1 E4:1 B3:2' },
  { id: 'chimes8', title: 'Westminster Quarters (two quarters)', scale: 'E_major_pentatonic', notes: 'G#4:1 F#4:1 E4:1 B3:2 E4:1 F#4:1 G#4:1 E4:2' },
  { id: 'silent4', title: 'Silent Night (first bar)', scale: 'C_major_pentatonic', notes: 'G4:1.5 A4:0.5 G4:1 E4:3', composer: 'Franz Gruber', died: 1863, year: 1818 },
  { id: 'silent8', title: 'Silent Night (two lines)', scale: 'C_major_pentatonic', notes: 'G4:1.5 A4:0.5 G4:1 E4:3 G4:1.5 A4:0.5 G4:1 E4:3', composer: 'Franz Gruber', died: 1863, year: 1818 },
  { id: 'cucaracha5', title: 'La Cucaracha (opening)', scale: 'C_major_pentatonic', notes: 'G4:0.5 G4:0.5 G4:0.5 C5:1.5 E5:1' },
  { id: 'cucaracha10', title: 'La Cucaracha (both calls)', scale: 'C_major_pentatonic', notes: 'G4:0.5 G4:0.5 G4:0.5 C5:1.5 E5:1.5 G4:0.5 G4:0.5 G4:0.5 C5:1.5 E5:1' },
  { id: 'auclair6', title: 'Au clair de la lune (opening)', scale: 'C_major_pentatonic', notes: 'C4:1 C4:1 C4:1 D4:1 E4:2 D4:2' },
  { id: 'auclair11', title: 'Au clair de la lune (two lines)', scale: 'C_major_pentatonic', notes: 'C4:1 C4:1 C4:1 D4:1 E4:2 D4:2 C4:1 E4:1 D4:1 D4:1 C4:4' },
  { id: 'brahms6', title: 'Brahms’ Lullaby (opening)', scale: 'C_major_pentatonic', notes: 'E4:1 E4:1 G4:2 E4:1 E4:1 G4:2', composer: 'Johannes Brahms', died: 1897, year: 1868 },
  { id: 'mary7', title: 'Mary Had a Little Lamb (first line)', scale: 'C_major_pentatonic', notes: 'E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2' },
  { id: 'mary13', title: 'Mary Had a Little Lamb (three lines)', scale: 'C_major_pentatonic', notes: 'E4:1 D4:1 C4:1 D4:1 E4:1 E4:1 E4:2 D4:1 D4:1 D4:2 E4:1 G4:1 G4:2' },
  { id: 'twinkle7', title: 'Twinkle, Twinkle (first line)', scale: 'C_major_pentatonic', notes: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2' },
  { id: 'susanna7', title: 'Oh! Susanna (opening)', scale: 'C_major_pentatonic', notes: 'C4:1 D4:1 E4:1 G4:1.5 G4:0.5 A4:1 G4:2', composer: 'Stephen Foster', died: 1864, year: 1848 },
  { id: 'camptown7', title: 'Camptown Races (opening)', scale: 'C_major_pentatonic', notes: 'G4:1 G4:1 E4:1 G4:1 A4:1 G4:1 E4:2', composer: 'Stephen Foster', died: 1864, year: 1850 },
  { id: 'macdonald7', title: 'Old MacDonald (first line)', scale: 'G_major_pentatonic', notes: 'G4:1 G4:1 G4:1 D4:1 E4:1 E4:1 D4:2' },
  { id: 'macdonald12', title: 'Old MacDonald (with E-I-E-I-O)', scale: 'G_major_pentatonic', notes: 'G4:1 G4:1 G4:1 D4:1 E4:1 E4:1 D4:2 B4:0.5 B4:0.5 A4:0.5 A4:0.5 G4:2' },
  { id: 'auld8', title: 'Auld Lang Syne (first line)', scale: 'G_major_pentatonic', notes: 'D4:1 G4:1.5 G4:0.5 G4:1 B4:1 A4:1.5 G4:0.5 A4:1' },
  { id: 'grace9', title: 'Amazing Grace (first line)', scale: 'G_major_pentatonic', notes: 'D4:1 G4:2 B4:0.5 G4:0.5 B4:1 A4:2 G4:1 E4:1 D4:2' },
  { id: 'jingle11', title: 'Jingle Bells (chorus)', scale: 'C_major_pentatonic', notes: 'E4:1 E4:1 E4:2 E4:1 E4:1 E4:2 E4:1 G4:1 C4:1.5 D4:0.5 E4:4', composer: 'James Lord Pierpont', died: 1893, year: 1857 },
  { id: 'yankee8', title: 'Yankee Doodle (first line)', scale: 'C_major_pentatonic', notes: 'C4:1 C4:1 D4:1 E4:1 C4:1 E4:1 D4:1 G3:2' },
  { id: 'beethoven4', title: 'Beethoven’s Fifth (motif)', scale: 'C_natural_minor', notes: 'G4:0.5 G4:0.5 G4:0.5 Eb4:3', composer: 'Ludwig van Beethoven', died: 1827, year: 1808 },

  // ── Major / minor ─────────────────────────────────────────────────────────────────────────
  { id: 'saints4', title: 'When the Saints (opening)', scale: 'C_major', notes: 'C4:1 E4:1 F4:1 G4:2' },
  { id: 'london7', title: 'London Bridge (first line)', scale: 'C_major', notes: 'G4:1.5 A4:0.5 G4:1 F4:1 E4:1 F4:1 G4:2' },
  { id: 'london13', title: 'London Bridge (three lines)', scale: 'C_major', notes: 'G4:1.5 A4:0.5 G4:1 F4:1 E4:1 F4:1 G4:2 D4:1 E4:1 F4:2 E4:1 F4:1 G4:2' },
  { id: 'row10', title: 'Row, Row, Row Your Boat', scale: 'C_major', notes: 'C4:1 C4:1 C4:1.5 D4:0.5 E4:2 E4:1.5 D4:0.5 E4:1.5 F4:0.5 G4:3' },
  { id: 'frere11', title: 'Frère Jacques (three lines)', scale: 'C_major', notes: 'C4:1 D4:1 E4:1 C4:1 C4:1 D4:1 E4:1 C4:1 E4:1 F4:1 G4:2' },
  { id: 'twinkle14', title: 'Twinkle, Twinkle (two lines)', scale: 'C_major', notes: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:1 G4:2 F4:1 F4:1 E4:1 E4:1 D4:1 D4:1 C4:2' },
  { id: 'joy12', title: 'Ode to Joy (three bars)', scale: 'C_major', notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1', composer: 'Ludwig van Beethoven', died: 1827, year: 1824 },
  { id: 'joy15', title: 'Ode to Joy (first line)', scale: 'C_major', notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:1 D4:1 E4:1 E4:1.5 D4:0.5 D4:2', composer: 'Ludwig van Beethoven', died: 1827, year: 1824 },
  { id: 'brahms13', title: 'Brahms’ Lullaby (first line)', scale: 'C_major', notes: 'E4:1 E4:1 G4:2 E4:1 E4:1 G4:2 E4:1 G4:1 C5:2 B4:1 A4:1 A4:1 G4:2', composer: 'Johannes Brahms', died: 1897, year: 1868 },
  { id: 'minuet8', title: 'Minuet in G (opening)', scale: 'G_major', notes: 'D4:1 G3:0.5 A3:0.5 B3:0.5 C4:0.5 D4:1 G3:1 G3:1', composer: 'Christian Petzold', died: 1733, year: 1725 },
  { id: 'minuet16', title: 'Minuet in G (two phrases)', scale: 'G_major', notes: 'D4:1 G3:0.5 A3:0.5 B3:0.5 C4:0.5 D4:1 G3:1 G3:1 E4:1 C4:0.5 D4:0.5 E4:0.5 F#4:0.5 G4:1 G3:1 G3:1', composer: 'Christian Petzold', died: 1733, year: 1725 },
  { id: 'canonbass8', title: 'Canon in D (ground bass)', scale: 'D_major', notes: 'D4:2 A3:2 B3:2 F#3:2 G3:2 D3:2 G3:2 A3:2', composer: 'Johann Pachelbel', died: 1706, year: 1919 },
  { id: 'canon8', title: 'Canon in D (first violin)', scale: 'D_major', notes: 'F#4:2 E4:2 D4:2 C#4:2 B3:2 A3:2 B3:2 C#4:2', composer: 'Johann Pachelbel', died: 1706, year: 1919 },
  { id: 'beethoven8', title: 'Beethoven’s Fifth (two bars)', scale: 'C_natural_minor', notes: 'G4:0.5 G4:0.5 G4:0.5 Eb4:3 F4:0.5 F4:0.5 F4:0.5 D4:3', composer: 'Ludwig van Beethoven', died: 1827, year: 1808 },
  { id: 'mountainking7', title: 'In the Hall of the Mountain King', scale: 'B_natural_minor', notes: 'B3:1 C#4:1 D4:1 E4:1 F#4:1 D4:1 F#4:2', composer: 'Edvard Grieg', died: 1907, year: 1888 },
  { id: 'koro8', title: 'Korobeiniki (first bar)', scale: 'A_natural_minor', notes: 'E5:2 B4:1 C5:1 D5:2 C5:1 B4:1 A4:3', },
  { id: 'koro12', title: 'Korobeiniki (three bars)', scale: 'A_natural_minor', notes: 'E5:2 B4:1 C5:1 D5:2 C5:1 B4:1 A4:3 A4:1 C5:2 E5:2 D5:1 C5:1' },
  { id: 'koro16', title: 'Korobeiniki (four bars)', scale: 'A_natural_minor', notes: 'E5:2 B4:1 C5:1 D5:2 C5:1 B4:1 A4:3 A4:1 C5:2 E5:2 D5:1 C5:1 B4:3 C5:1 D5:2 E5:2' },
  { id: 'turca5', title: 'Rondo alla Turca (opening)', scale: 'A_harmonic_minor', notes: 'B4:0.5 A4:0.5 G#4:0.5 A4:0.5 C5:2', composer: 'Wolfgang Amadeus Mozart', died: 1791, year: 1784 },
  { id: 'toccata9', title: 'Toccata and Fugue in D minor (opening)', scale: 'D_harmonic_minor', notes: 'A4:0.5 G4:0.5 A4:3 G4:0.5 F4:0.5 E4:0.5 D4:0.5 C#4:0.5 D4:3', composer: 'Johann Sebastian Bach', died: 1750, year: 1833 },

  // ── Chromatic ─────────────────────────────────────────────────────────────────────────────
  { id: 'entertainer4', title: 'The Entertainer (opening)', scale: 'C_chromatic', notes: 'D4:0.5 D#4:0.5 E4:0.5 C5:1.5', composer: 'Scott Joplin', died: 1917, year: 1902 },
  { id: 'entertainer8', title: 'The Entertainer (first bar)', scale: 'C_chromatic', notes: 'D4:0.5 D#4:0.5 E4:0.5 C5:1.5 E4:0.5 C5:0.5 E4:0.5 C5:2', composer: 'Scott Joplin', died: 1917, year: 1902 },
  { id: 'habanera6', title: 'Habanera (the descending line)', scale: 'D_chromatic', notes: 'D5:1.5 C#5:0.5 C5:1 B4:1 Bb4:1 A4:2', composer: 'Georges Bizet', died: 1875, year: 1875 },
  { id: 'elise9', title: 'Für Elise (opening)', scale: 'A_chromatic', notes: 'E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5', composer: 'Ludwig van Beethoven', died: 1827, year: 1867 },
  { id: 'elise13', title: 'Für Elise (first phrase)', scale: 'A_chromatic', notes: 'E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5', composer: 'Ludwig van Beethoven', died: 1827, year: 1867 },
];
