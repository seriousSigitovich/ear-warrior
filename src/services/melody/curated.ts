// The melody library (FR-021): 100 whole public-domain melodies, one per tune, each on one difficulty
// rank (1–9) and at its own tempo. The tunes are written in ABC in `library.abc`; `npm run library`
// turns them into `library.ts`, which this module serves. Every tune is inside the 12-fret neck (E2–E5,
// MIDI 40–76), so any note can be answered on the on-screen fretboard.
//
// `notes` is "pitch:beats" tokens, e.g. "E4:1 D4:2". Rhythm is played back but never graded.
import { Attempt, DifficultyLevel, Melody, Note } from '../../models';
import { hzFromMidi, noteName } from '../../lib/pitchNote';
import { LibraryTune, TUNES } from './library';

export type { LibraryTune } from './library';

/** Everything the app serves, easiest rank first. */
export const LIBRARY: readonly LibraryTune[] = TUNES;

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

function parseNotes(tune: LibraryTune): Note[] {
  return tune.notes
    .trim()
    .split(/\s+/)
    .map((token, index) => {
      const [name, beats] = token.split(':');
      const match = name.match(/^([A-G][#b]?)(-?\d)$/);
      const durationBeats = Number(beats);
      if (!match || !(durationBeats > 0)) {
        throw new Error(`Bad note "${token}" in library tune "${tune.id}".`);
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

function span(values: number[], unit = ''): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return `${lo === hi ? lo : `${lo}–${hi}`}${unit}`;
}

/** What a rank holds, for display: how many tunes, their note counts ("17–62") and tempos ("60–140 BPM"). */
export function levelSummary(rank: number): { tunes: number; notes: string; tempo: string } {
  const ofRank = LIBRARY.filter((t) => t.rank === rank);
  if (ofRank.length === 0) return { tunes: 0, notes: '–', tempo: '–' };
  return {
    tunes: ofRank.length,
    notes: span(ofRank.map((t) => t.notes.trim().split(/\s+/).length)),
    tempo: span(ofRank.map((t) => t.tempoBpm), ' BPM'),
  };
}

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

/** What the next pick is made against: tunes played at 100%, and the latest tunes played, oldest first. */
export interface TuneHistory {
  mastered: readonly string[];
  recent: readonly string[];
}

/**
 * The history as the recorded attempts on this device tell it. A signed-in learner gets the same shape
 * from the server (`GET /api/progress/history`), which also covers their other devices.
 */
export function historyFromAttempts(
  attempts: readonly Pick<Attempt, 'melodyId' | 'verdict' | 'createdAt'>[],
): TuneHistory {
  return {
    mastered: [...masteredTuneIds(attempts)],
    recent: [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((a) => tuneIdOf(a.melodyId)),
  };
}

/**
 * A melody for `level` from the library: one of the level's tunes, chosen deterministically from
 * `seed`. Tunes in `mastered` are skipped until the level has none left, then all of them are back
 * in play. Among those, the tune played longest ago (`recent`: tune ids, oldest first) wins, so a
 * level cycles through its tunes instead of repeating one; `seed` breaks ties. `tuneId` forces a
 * specific tune.
 * @throws if the level has no tune — the tests require every level 1–9 to have some.
 */
export function curatedMelody(
  level: DifficultyLevel,
  seed: number,
  tuneId?: string,
  mastered: ReadonlySet<string> = new Set(),
  recent: readonly string[] = [],
): Melody {
  const ofLevel = LIBRARY.filter((t) => t.rank === level.rank);
  const fresh = ofLevel.filter((t) => !mastered.has(t.id));
  const pool = fresh.length > 0 ? fresh : ofLevel;
  const lastPlayed = (t: LibraryTune) => recent.lastIndexOf(t.id); // -1: not played yet
  const oldest = Math.min(...pool.map(lastPlayed));
  const tunes = pool.filter((t) => lastPlayed(t) === oldest);
  const tune = tuneId
    ? ofLevel.find((t) => t.id === tuneId)
    : tunes[Math.abs(seed) % tunes.length];
  if (!tune) throw new Error(`No library tune for level ${level.id}.`);
  return {
    id: `${tune.id}-${seed}`,
    notes: parseNotes(tune),
    difficultyId: level.id,
    scale: tune.scale,
    tempoBpm: tune.tempoBpm,
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}
