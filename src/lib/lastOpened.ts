// The melody the learner last opened in practice, even if they answered nothing in it: Home's Continue offers it
// again. The place saved after a first-try check (spec 017) says more, so it wins when it is for the same tune or
// newer. Kept on the device only; pure over a key-value store.
import type { KeyValueStore } from './deviceId';
import type { NoteResult } from '../models';
import { MelodyPlaceRow, latestPlace } from './melodyProgress';

export const LAST_OPENED_KEY = 'ew.lastOpenedTune';

export interface OpenedTune {
  tuneId: string;
  /** ISO time it was opened. */
  at: string;
}

export function parseOpened(raw: string | null): OpenedTune | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<OpenedTune>;
    return typeof v.tuneId === 'string' &&
      typeof v.at === 'string' &&
      !Number.isNaN(Date.parse(v.at))
      ? { tuneId: v.tuneId, at: v.at }
      : null;
  } catch {
    return null;
  }
}

export async function readOpened(kv: KeyValueStore): Promise<OpenedTune | null> {
  return parseOpened(await kv.getItem(LAST_OPENED_KEY));
}

export async function saveOpened(
  kv: KeyValueStore,
  tuneId: string,
  now: Date = new Date(),
): Promise<void> {
  await kv.setItem(LAST_OPENED_KEY, JSON.stringify({ tuneId, at: now.toISOString() }));
}

/** The melody was finished: forget it as the last opened, if it is that one. */
export async function clearOpened(kv: KeyValueStore, tuneId: string): Promise<void> {
  const opened = await readOpened(kv);
  if (opened?.tuneId === tuneId) await kv.setItem(LAST_OPENED_KEY, '');
}

/** A melody the learner finished: the tune, when, and how it went (an attempt, by tune). */
export interface PlayedTune {
  tuneId: string;
  /** ISO time of the attempt. */
  at: string;
  results: NoteResult[];
}

/** What Home's Continue opens. */
export interface ContinueTarget {
  tuneId: string;
  phrases: number;
  /** 0-based phrase it opens at. */
  phrase: number;
  /** Phrases already answered (0 for a melody only opened or one finished). */
  answered: number;
  /** Open with the saved first tries (`resume=1`); false otherwise, which starts at phrase 1. */
  saved: boolean;
  /** The melody was finished and is offered to play again. */
  played: boolean;
  /** How the last answered phrase (or the finished attempt) went and when, for Home's last-result block. */
  last: { results: NoteResult[]; at: string } | null;
}

/**
 * Where Continue leads: the melody the learner last actually played — a half-answered one (its saved place) or the
 * latest finished one (offered to play again), whichever is the later; failing both, the melody last opened even
 * with nothing answered in it. A melody only opened never replaces one that was played, so the result shown under
 * a melody is always its own. A tune that left the library (`phrasesOf` gives null) is never offered.
 */
export function continueTarget(
  places: Iterable<MelodyPlaceRow>,
  opened: OpenedTune | null,
  phrasesOf: (tuneId: string) => number | null,
  played: readonly PlayedTune[] = [],
): ContinueTarget | null {
  const place = latestPlace(places, phrasesOf);
  const finished = played
    .filter((p) => phrasesOf(p.tuneId) !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];

  const fromPlace = (p: MelodyPlaceRow): ContinueTarget => ({
    tuneId: p.tuneId,
    phrases: p.phrases,
    phrase: p.phrase,
    answered: p.grades.length,
    saved: true,
    played: false,
    last:
      p.grades.length > 0
        ? { results: p.grades[p.grades.length - 1].noteResults, at: p.updatedAt }
        : null,
  });

  if (place && (!finished || Date.parse(place.updatedAt) >= Date.parse(finished.at))) {
    return fromPlace(place);
  }
  if (finished) {
    return {
      tuneId: finished.tuneId,
      phrases: phrasesOf(finished.tuneId) ?? 0,
      phrase: 0,
      answered: 0,
      saved: false,
      played: true,
      last: { results: finished.results, at: finished.at },
    };
  }
  const openedPhrases = opened ? phrasesOf(opened.tuneId) : null;
  if (opened && openedPhrases !== null) {
    return {
      tuneId: opened.tuneId,
      phrases: openedPhrases,
      phrase: 0,
      answered: 0,
      saved: false,
      played: false,
      last: null,
    };
  }
  return null;
}
