// The melody library (FR-021): a hand-written set of public-domain tunes, curated by the owner. Every tune sits on a difficulty level (rank 1–9) and
// inside the 12-fret neck (E2–E5, MIDI 40–76), so any note can be answered on the on-screen
// fretboard. Drafted from memory as a STARTER set — the owner is to verify and extend it.
//
// `notes` is "pitch:beats" tokens, e.g. "E4:1 D4:2". Rhythm is played back but never graded.
import { DifficultyLevel, Melody, Note } from '../../models';
import { hzFromMidi, noteName } from '../../lib/pitchNote';

export interface CuratedTune {
  /** Stable, hyphen-free id; it prefixes the Melody id. */
  id: string;
  title: string;
  /** Difficulty level (1–9) the tune is offered at. */
  rank: number;
  /** "<Root>_<family>", the key the tune is written in (checked against its notes by the tests). */
  scale: string;
  notes: string;
}

export const CURATED: readonly CuratedTune[] = [
  {
    id: 'hotcrossbuns',
    title: 'Hot Cross Buns',
    rank: 1,
    scale: 'C_major',
    notes: 'E4:1 D4:1 C4:2',
  },
  {
    id: 'frere3',
    title: 'Frère Jacques (opening)',
    rank: 1,
    scale: 'C_major',
    notes: 'C4:1 D4:1 E4:2',
  },

  {
    id: 'mary4',
    title: 'Mary Had a Little Lamb (opening)',
    rank: 2,
    scale: 'C_major',
    notes: 'E4:1 D4:1 C4:1 D4:2',
  },
  { id: 'frere4', title: 'Frère Jacques', rank: 2, scale: 'C_major', notes: 'C4:1 D4:1 E4:1 C4:2' },

  {
    id: 'grace6',
    title: 'Amazing Grace (opening)',
    rank: 3,
    scale: 'G_major_pentatonic',
    notes: 'D4:1 G4:2 B4:0.5 G4:0.5 B4:1 A4:2',
  },
  {
    id: 'silent6',
    title: 'Silent Night (opening)',
    rank: 3,
    scale: 'C_major_pentatonic',
    notes: 'G4:1.5 A4:0.5 G4:1 E4:2 G4:1.5 A4:0.5',
  },

  {
    id: 'joy4',
    title: 'Ode to Joy (second bar)',
    rank: 4,
    scale: 'C_major',
    notes: 'G4:1 F4:1 E4:1 D4:2',
  },
  {
    id: 'joy4b',
    title: 'Ode to Joy (third bar)',
    rank: 4,
    scale: 'C_major',
    notes: 'C4:1 C4:1 D4:1 E4:2',
  },

  {
    id: 'doe6',
    title: 'Do-Re-Mi (opening)',
    rank: 5,
    scale: 'C_major',
    notes: 'C4:1.5 D4:0.5 E4:1.5 C4:0.5 E4:1 C4:2',
  },
  {
    id: 'twinkle6',
    title: 'Twinkle, Twinkle (opening)',
    rank: 5,
    scale: 'C_major',
    notes: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:2',
  },

  {
    id: 'joy8',
    title: 'Ode to Joy',
    rank: 6,
    scale: 'C_major',
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:2',
  },
  {
    id: 'world8',
    title: 'Joy to the World',
    rank: 6,
    scale: 'C_major',
    notes: 'C5:1.5 B4:0.5 A4:1.5 G4:0.5 F4:1 E4:1 D4:1 C4:2',
  },

  {
    id: 'sleeves6',
    title: 'Greensleeves (opening, in E minor)',
    rank: 7,
    scale: 'E_natural_minor',
    notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:0.5 B4:2',
  },

  {
    id: 'sleeves8',
    title: 'Greensleeves (two bars, in E minor)',
    rank: 8,
    scale: 'E_natural_minor',
    notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:0.5 B4:1 A4:1 F#4:2',
  },

  {
    id: 'sleeves10',
    title: 'Greensleeves (phrase, in E minor)',
    rank: 9,
    scale: 'E_natural_minor',
    notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:0.5 B4:1 A4:1 F#4:1 D4:1 E4:2',
  },
  {
    id: 'joy10',
    title: 'Ode to Joy (to the second line)',
    rank: 9,
    scale: 'C_major',
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:1 C4:1 C4:2',
  },
];

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** Fixed placeholder; the storage layer stamps the real creation time on persist. */
const CREATED_AT_PLACEHOLDER = new Date(0).toISOString();

function parseNotes(tune: CuratedTune): Note[] {
  return tune.notes
    .trim()
    .split(/\s+/)
    .map((token, index) => {
      const [name, beats] = token.split(':');
      const match = name.match(/^([A-G][#b]?)(-?\d)$/);
      const durationBeats = Number(beats);
      if (!match || !(durationBeats > 0)) {
        throw new Error(`Bad note "${token}" in curated tune "${tune.id}".`);
      }
      const midi = PITCH_CLASS[match[1]] + 12 * (Number(match[2]) + 1);
      return {
        index,
        midi,
        noteName: noteName(midi),
        frequencyHz: hzFromMidi(midi),
        centsOffset: 0,
        durationBeats,
      };
    });
}

/**
 * A melody for `level` from the curated set: one of the level's tunes, chosen deterministically from
 * `seed` (no memory of earlier picks, so a repeat is possible). `tuneId` forces a specific tune.
 * @throws if the level has no tune — the tests require every level 1–9 to have one.
 */
export function curatedMelody(level: DifficultyLevel, seed: number, tuneId?: string): Melody {
  const tunes = CURATED.filter((t) => t.rank === level.rank);
  const tune = tuneId ? tunes.find((t) => t.id === tuneId) : tunes[Math.abs(seed) % tunes.length];
  if (!tune) throw new Error(`No curated tune for level ${level.id}.`);
  return {
    id: `${tune.id}-${seed}`,
    notes: parseNotes(tune),
    difficultyId: level.id,
    scale: tune.scale,
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}
