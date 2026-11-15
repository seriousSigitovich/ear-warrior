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

/** What Home's Continue opens. */
export interface ContinueTarget {
  tuneId: string;
  phrases: number;
  /** 0-based phrase it opens at. */
  phrase: number;
  /** Phrases already answered (0 for a melody only opened). */
  answered: number;
  /** Open with the saved first tries (`resume=1`); false for a melody only opened, which starts at phrase 1. */
  saved: boolean;
  /** How the last answered phrase went and when (saved places only), for Home's last-result block. */
  last: { results: NoteResult[]; at: string } | null;
}

/**
 * The saved place, unless a different melody was opened after it: that one is what the learner was last at, even
 * with nothing answered in it. A tune that left the library (`phrasesOf` gives null) is never offered.
 */
export function continueTarget(
  places: Iterable<MelodyPlaceRow>,
  opened: OpenedTune | null,
  phrasesOf: (tuneId: string) => number | null,
): ContinueTarget | null {
  const place = latestPlace(places, phrasesOf);
  const openedPhrases = opened ? phrasesOf(opened.tuneId) : null;
  const openedIsNewer =
    opened !== null &&
    openedPhrases !== null &&
    opened.tuneId !== place?.tuneId &&
    (!place || Date.parse(opened.at) > Date.parse(place.updatedAt));
  if (openedIsNewer && opened && openedPhrases !== null) {
    return {
      tuneId: opened.tuneId,
      phrases: openedPhrases,
      phrase: 0,
      answered: 0,
      saved: false,
      last: null,
    };
  }
  return place
    ? {
        tuneId: place.tuneId,
        phrases: place.phrases,
        phrase: place.phrase,
        answered: place.grades.length,
        saved: true,
        last:
          place.grades.length > 0
            ? {
                results: place.grades[place.grades.length - 1].noteResults,
                at: place.updatedAt,
              }
            : null,
      }
    : null;
}
