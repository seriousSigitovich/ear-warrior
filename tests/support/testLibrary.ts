// The full tune library for tests that need one: built from the server's seed data (which has the answers), reduced to
// what the app holds (rhythm, phrases, moves — no pitches), and installed as the app's library.
import { setLibrary } from '../../src/services/tunes/library';
import type { LibraryTune } from '../../src/services/tunes/types';
import { TUNES } from '../../server/src/tunes/library.data';
import { LOCAL_ANSWER_MAX_LEVEL } from '../../server/src/game/config';
import { movesOf } from '../../server/src/tunes/moves';
import { parseNotes } from '../../server/src/tunes/notes';

export const TEST_TUNES: readonly LibraryTune[] = TUNES.map((t) => ({
  id: t.id,
  title: t.title,
  rank: t.rank,
  tempoBpm: t.tempoBpm,
  phrases: [...t.phrases],
  beats: (parseNotes(t.notes) ?? []).map((n) => n.beats),
  scale: t.scale,
  moves: movesOf(t.notes, t.phrases),
  // Like the server's catalog: the answer only for the first levels.
  ...(t.rank <= LOCAL_ANSWER_MAX_LEVEL
    ? { answer: (parseNotes(t.notes) ?? []).map((n) => n.midi) }
    : {}),
  audio: { sha256: 'a'.repeat(64), url: `https://blob.example/${t.id}.m4a`, bytes: 1000 },
}));

/** Install the full library; call in `beforeAll`. */
export function installTestLibrary(): void {
  setLibrary(TEST_TUNES);
}

/** The answer of a tune (pitches), for tests that play a tune: the app itself never has it. */
export const answerOf = (id: string): number[] =>
  parseNotes(TUNES.find((t) => t.id === id)!.notes)!.map((n) => n.midi);
