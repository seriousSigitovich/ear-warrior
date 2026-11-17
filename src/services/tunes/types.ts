// What the app knows of a tune (spec 024): everything but the answer. The notes' pitches stay on the server; the app
// gets the rhythm (to time a phrase against its clip), how many moves of each kind the tune holds, and where its voiced
// audio is and how to recognise it (its hash).
import type { IntervalKind } from '../../lib/insights';

export interface TuneMoves {
  counts: Partial<Record<IntervalKind, number>>;
  total: number;
}

export interface TuneAudio {
  /** Content hash of the clip: the cache key, so a re-voiced clip is fetched again and only then. */
  sha256: string;
  /** Where to download it; null for a clip that only ships inside the app. */
  url: string | null;
  bytes: number;
}

export interface LibraryTune {
  /** Stable, hyphen-free id (prefixes the played melody's id). */
  id: string;
  title: string;
  /** Difficulty level 1–9. */
  rank: number;
  /** Quarter notes per minute. */
  tempoBpm: number;
  /** Notes per phrase, in order. */
  phrases: number[];
  /** Each note's length in beats, in order (`phrases` adds up to its length). */
  beats: number[];
  scale: string;
  moves: TuneMoves;
  /**
   * The answer, midi in order — only for the tunes of the first levels, which the app grades itself so a new learner can
   * play at once, offline (the server still re-grades every check for XP). Absent for every other tune.
   */
  answer?: number[];
  audio: TuneAudio;
}
