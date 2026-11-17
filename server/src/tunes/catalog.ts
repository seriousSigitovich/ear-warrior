// The catalog devices download (spec 024, GET /api/melodies): every visible tune, without its answer notes.
import { createHash } from 'node:crypto';
import { LOCAL_ANSWER_MAX_LEVEL } from '../game/config.js';
import { movesOf, type Moves } from './moves.js';
import { parseNotes } from './notes.js';
import { isVisible } from './validate.js';
import type { Tune } from './store.js';

export interface CatalogTune {
  id: string;
  title: string;
  level: number;
  tempo_bpm: number;
  phrases: number[];
  /** Each note's length in beats, in order: the rhythm the app needs to time a phrase. Never the pitches. */
  beats: number[];
  /**
   * The answer (midi, in order) — only for tunes up to LOCAL_ANSWER_MAX_LEVEL, which the app grades itself so a new
   * learner can play at once. Absent for every other tune: those are graded by the server alone.
   */
  answer?: number[];
  /** How many moves of each kind the tune holds (counts only), for picking tunes to practise a kind of jump. */
  moves: Moves;
  scale: string;
  audio_url: string;
  audio_sha256: string;
  audio_bytes: number;
}

export interface Catalog {
  etag: string;
  tunes: CatalogTune[];
}

export function buildCatalog(all: readonly Tune[]): Catalog {
  const tunes = all
    .filter(isVisible)
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    .map(
      (t): CatalogTune => ({
        id: t.id,
        title: t.title,
        level: t.level,
        tempo_bpm: t.tempoBpm,
        phrases: t.phrases,
        beats: (parseNotes(t.notes) ?? []).map((n) => n.beats),
        moves: movesOf(t.notes, t.phrases),
        ...(t.level <= LOCAL_ANSWER_MAX_LEVEL ? { answer: (parseNotes(t.notes) ?? []).map((n) => n.midi) } : {}),
        scale: t.scale,
        audio_url: t.audioUrl as string,
        audio_sha256: t.audioSha256 as string,
        audio_bytes: t.audioBytes ?? 0,
      }),
    );
  const etag = createHash('sha256').update(JSON.stringify(tunes)).digest('hex').slice(0, 16);
  return { etag, tunes };
}
