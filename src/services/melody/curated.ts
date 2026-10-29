// The melody library (FR-021): hand-written public-domain tunes. The served library is `CURATED`
// (listened to and kept by the owner) plus `CANDIDATES` (candidates.ts, drafted from memory, so a
// note may be off until the owner has listened). Every tune is inside the 12-fret neck (E2–E5,
// MIDI 40–76), so any note can be answered on the on-screen fretboard, and sits on the difficulty
// rank (1–9) whose span holds its note count (levels.ts).
//
// `notes` is "pitch:beats" tokens, e.g. "E4:1 D4:2". Rhythm is played back but never graded.
import { Attempt, DifficultyLevel, Melody, Note } from '../../models';
import { hzFromMidi, noteName } from '../../lib/pitchNote';
import { CANDIDATES } from './candidates';
import { rankOfNoteCount } from './levels';

export interface CuratedTune {
  /** Stable, hyphen-free id; it prefixes the Melody id. */
  id: string;
  title: string;
  /** "<Root>_<family>", the key the tune is written in (checked against its notes by the tests). */
  scale: string;
  notes: string;
}

/** A tune of the served library with the rank it is offered at. */
export interface LibraryTune extends CuratedTune {
  rank: number;
}

export const CURATED: readonly CuratedTune[] = [
  {
    id: 'hotcrossbuns',
    title: 'Hot Cross Buns',
    scale: 'C_major',
    notes: 'E4:1 D4:1 C4:2',
  },
  {
    id: 'frere3',
    title: 'Frère Jacques (opening)',
    scale: 'C_major',
    notes: 'C4:1 D4:1 E4:2',
  },

  {
    id: 'mary4',
    title: 'Mary Had a Little Lamb (opening)',
    scale: 'C_major',
    notes: 'E4:1 D4:1 C4:1 D4:2',
  },
  { id: 'frere4', title: 'Frère Jacques', scale: 'C_major', notes: 'C4:1 D4:1 E4:1 C4:2' },

  {
    id: 'grace6',
    title: 'Amazing Grace (opening)',
    scale: 'G_major_pentatonic',
    notes: 'D4:1 G4:2 B4:0.5 G4:0.5 B4:1 A4:2',
  },
  {
    id: 'silent6',
    title: 'Silent Night (opening)',
    scale: 'C_major_pentatonic',
    notes: 'G4:1.5 A4:0.5 G4:1 E4:2 G4:1.5 A4:0.5',
  },

  {
    id: 'joy4',
    title: 'Ode to Joy (second bar)',
    scale: 'C_major',
    notes: 'G4:1 F4:1 E4:1 D4:2',
  },
  {
    id: 'joy4b',
    title: 'Ode to Joy (third bar)',
    scale: 'C_major',
    notes: 'C4:1 C4:1 D4:1 E4:2',
  },

  {
    id: 'doe6',
    title: 'Do-Re-Mi (opening)',
    scale: 'C_major',
    notes: 'C4:1.5 D4:0.5 E4:1.5 C4:0.5 E4:1 C4:2',
  },
  {
    id: 'twinkle6',
    title: 'Twinkle, Twinkle (opening)',
    scale: 'C_major',
    notes: 'C4:1 C4:1 G4:1 G4:1 A4:1 A4:2',
  },

  {
    id: 'joy8',
    title: 'Ode to Joy',
    scale: 'C_major',
    notes: 'E4:1 E4:1 F4:1 G4:1 G4:1 F4:1 E4:1 D4:2',
  },
  {
    id: 'world8',
    title: 'Joy to the World',
    scale: 'C_major',
    notes: 'C5:1.5 B4:0.5 A4:1.5 G4:0.5 F4:1 E4:1 D4:1 C4:2',
  },

  {
    id: 'sleeves6',
    title: 'Greensleeves (opening, in E minor)',
    scale: 'E_natural_minor',
    notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:0.5 B4:2',
  },

  {
    id: 'sleeves8',
    title: 'Greensleeves (two bars, in E minor)',
    scale: 'E_natural_minor',
    notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:0.5 B4:1 A4:1 F#4:2',
  },

  {
    id: 'sleeves10',
    title: 'Greensleeves (phrase, in E minor)',
    scale: 'E_natural_minor',
    notes: 'E4:1 G4:2 A4:1 B4:1.5 C5:0.5 B4:1 A4:1 F#4:1 D4:1 E4:2',
  },
  {
    id: 'joy10',
    title: 'Ode to Joy (to the second line)',
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

function rankOf(tune: CuratedTune): number {
  const count = tune.notes.trim().split(/\s+/).length;
  const rank = rankOfNoteCount(count);
  if (rank === undefined) throw new Error(`Curated tune "${tune.id}" has ${count} notes: no rank.`);
  return rank;
}

/** Everything the app serves: the curated tunes and the candidates, each on its rank. */
export const LIBRARY: readonly LibraryTune[] = [...CURATED, ...CANDIDATES].map((t) => ({
  id: t.id,
  title: t.title,
  scale: t.scale,
  notes: t.notes,
  rank: rankOf(t),
}));

/** The tune a melody id came from (`<tune id>-<seed>`; tune ids hold no hyphen). */
export function tuneIdOf(melodyId: string): string {
  return melodyId.split('-')[0];
}

/**
 * Tunes the learner has played at 100% (an attempt with every note right and none extra), read from
 * the recorded attempts so the memory survives restarts and syncs with them.
 */
export function masteredTuneIds(attempts: readonly Pick<Attempt, 'melodyId' | 'verdict'>[]): Set<string> {
  return new Set(attempts.filter((a) => a.verdict === 'correct').map((a) => tuneIdOf(a.melodyId)));
}

/**
 * A melody for `level` from the library: one of the level's tunes, chosen deterministically from
 * `seed`. Tunes in `mastered` are skipped until the level has none left, then all of them are back
 * in play. `tuneId` forces a specific tune.
 * @throws if the level has no tune — the tests require every level 1–9 to have one.
 */
export function curatedMelody(
  level: DifficultyLevel,
  seed: number,
  tuneId?: string,
  mastered: ReadonlySet<string> = new Set(),
): Melody {
  const ofLevel = LIBRARY.filter((t) => t.rank === level.rank);
  const fresh = ofLevel.filter((t) => !mastered.has(t.id));
  const tunes = fresh.length > 0 ? fresh : ofLevel;
  const tune = tuneId
    ? ofLevel.find((t) => t.id === tuneId)
    : tunes[Math.abs(seed) % tunes.length];
  if (!tune) throw new Error(`No curated tune for level ${level.id}.`);
  return {
    id: `${tune.id}-${seed}`,
    notes: parseNotes(tune),
    difficultyId: level.id,
    scale: tune.scale,
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}
