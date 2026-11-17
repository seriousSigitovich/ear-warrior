// The melody library the app serves (FR-021, spec 024): the tunes the server's catalog names (or, before the first
// download, the few shipped inside the app), each on one difficulty rank (1–9) and at its own tempo. The app holds a
// tune's rhythm, phrases and voiced clip — never the pitches of its answer; the server grades. Every tune is inside the
// 12-fret neck (E2–E5, MIDI 40–76), so any note can be answered on the on-screen fretboard.
import { Attempt, DifficultyLevel, Melody, Note } from '../../models';
import { hzFromMidi, noteName } from '../../lib/pitchNote';
import { getLibrary } from '../tunes/library';
import type { LibraryTune } from '../tunes/types';
import { L1 } from './levels';

export type { LibraryTune } from '../tunes/types';

/** Fixed placeholder; the storage layer stamps the real creation time on persist. */
const CREATED_AT_PLACEHOLDER = new Date(0).toISOString();

/**
 * A note whose pitch the app does not know: only its length. `midi` 0 marks it; nothing in the app may sound or grade
 * it (the playback service refuses a melody of such notes whose clip is missing).
 */
export function unpitchedNote(index: number, durationBeats: number): Note {
  return { index, midi: 0, noteName: '', frequencyHz: 0, centsOffset: 0, durationBeats };
}

/** A note whose pitch the app knows (a tune of the first levels, whose answer ships in the app). */
export function pitchedNote(index: number, midi: number, durationBeats: number): Note {
  return {
    index,
    midi,
    noteName: noteName(midi),
    frequencyHz: hzFromMidi(midi),
    centsOffset: 0,
    durationBeats,
  };
}

function span(values: number[], unit = ''): string {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return `${lo === hi ? lo : `${lo}–${hi}`}${unit}`;
}

/** What a rank holds, for display: how many tunes, their note counts ("17–62") and tempos ("60–140 BPM"). */
export function levelSummary(rank: number): { tunes: number; notes: string; tempo: string } {
  const ofRank = getLibrary().filter((t) => t.rank === rank);
  if (ofRank.length === 0) return { tunes: 0, notes: '–', tempo: '–' };
  return {
    tunes: ofRank.length,
    notes: span(ofRank.map((t) => t.beats.length)),
    tempo: span(
      ofRank.map((t) => t.tempoBpm),
      ' BPM',
    ),
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
export function masteredTuneIds(
  attempts: readonly Pick<Attempt, 'melodyId' | 'verdict'>[],
): Set<string> {
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
    recent: [...attempts]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((a) => tuneIdOf(a.melodyId)),
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
  const ofLevel = getLibrary().filter((t) => t.rank === level.rank);
  const fresh = ofLevel.filter((t) => !mastered.has(t.id));
  const pool = fresh.length > 0 ? fresh : ofLevel;
  const lastPlayed = (t: LibraryTune) => recent.lastIndexOf(t.id); // -1: not played yet
  const oldest = Math.min(...pool.map(lastPlayed));
  const tunes = pool.filter((t) => lastPlayed(t) === oldest);
  const tune = tuneId ? ofLevel.find((t) => t.id === tuneId) : tunes[Math.abs(seed) % tunes.length];
  if (!tune) throw new Error(`No library tune for level ${level.id}.`);
  return {
    id: `${tune.id}-${seed}`,
    notes: tune.beats.map((beats, i) =>
      tune.answer ? pitchedNote(i, tune.answer[i], beats) : unpitchedNote(i, beats),
    ),
    difficultyId: level.id,
    scale: tune.scale,
    tempoBpm: tune.tempoBpm,
    phrases: [...tune.phrases],
    title: tune.title,
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}

/**
 * The first melody a new learner plays, in place of an onboarding to read (owner's pick): the four notes that open
 * Beethoven's Fifth — three repeated, one lower. Short, known to everyone, nearly impossible to lose. One phrase,
 * slowed down, from a clip of its own that ships inside the app (EXCERPTS in assets/guitar-rig/render_library.py), so it
 * works on the first launch with no network. It is the one melody whose answer the app holds: it is a coached warm-up,
 * graded on the device, never recorded, never paid.
 */
export const FIRST_MELODY_CLIP = 'fifthfirst';
/** G3 G3 G3 E♭3, and each note's length in beats. */
const FIRST_MELODY_MIDI = [55, 55, 55, 51];
const FIRST_MELODY_BEATS = [0.5, 0.5, 0.5, 2.5];
/**
 * Slower than the symphony's 216 so a beginner hears each note; the clip is voiced at this tempo
 * (keep in sync with EXCERPTS), so nothing is stretched at play time.
 */
export const FIRST_MELODY_BPM = 120;

export function firstMelody(): Melody {
  return {
    id: `${FIRST_MELODY_CLIP}-first`,
    notes: FIRST_MELODY_MIDI.map((midi, index) => ({
      index,
      midi,
      noteName: noteName(midi),
      frequencyHz: hzFromMidi(midi),
      centsOffset: 0,
      durationBeats: FIRST_MELODY_BEATS[index],
    })),
    difficultyId: L1.id,
    scale: 'C_natural_minor',
    tempoBpm: FIRST_MELODY_BPM,
    phrases: [FIRST_MELODY_MIDI.length],
    title: 'Symphony No. 5 (opening)',
    createdAt: CREATED_AT_PLACEHOLDER,
  };
}
