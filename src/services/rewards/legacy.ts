// What the learner did before the server graded phrases (spec 024, research D10): the passed phrases found in the
// attempts stored on the device, sent once so the server can pay them under the new rules. The device says only which
// phrase was passed at what accuracy and when — never an amount of XP; the server computes that.
import type { Attempt } from '../../models';
import type { KeyValueStore } from '../../lib/deviceId';
import type { RewardsService } from './service';

export const LEGACY_DONE_KEY = 'ew.legacyImport';
const PASS = 80;

export interface LegacyPhrase {
  tuneId: string;
  phrase: number;
  accuracy: number;
  at: string;
}

/** Percent of the tune's notes landed in each phrase, from an old attempt's note results; null when they cannot be split. */
export function phraseAccuracies(
  noteResults: Attempt['noteResults'],
  phrases: readonly number[],
): number[] | null {
  const targets = noteResults
    .filter((r) => r.targetIndex !== null)
    .sort((a, b) => (a.targetIndex as number) - (b.targetIndex as number));
  if (targets.length !== phrases.reduce((a, b) => a + b, 0)) return null;
  let from = 0;
  return phrases.map((len) => {
    const slice = targets.slice(from, from + len);
    from += len;
    return slice.length === 0
      ? 0
      : Math.round((slice.filter((t) => t.status === 'matched').length / slice.length) * 100);
  });
}

/**
 * The first attempt that passed each phrase of each tune, oldest first. `phrasesOf` says how a tune splits into
 * phrases (null for a tune the library no longer has: its attempts are left out).
 */
export function legacyPhrases(
  attempts: readonly Pick<
    Attempt,
    'melodyId' | 'noteResults' | 'inputMode' | 'timedOut' | 'createdAt'
  >[],
  phrasesOf: (tuneId: string) => readonly number[] | null,
): LegacyPhrase[] {
  const first = new Map<string, LegacyPhrase>();
  const ordered = [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const a of ordered) {
    if (a.inputMode !== 'fretboard' || a.timedOut) continue;
    const tuneId = a.melodyId.split('-')[0];
    const phrases = phrasesOf(tuneId);
    const accuracies = phrases ? phraseAccuracies(a.noteResults, phrases) : null;
    accuracies?.forEach((accuracy, phrase) => {
      const key = `${tuneId}:${phrase}`;
      if (accuracy >= PASS && !first.has(key))
        first.set(key, { tuneId, phrase, accuracy, at: a.createdAt });
    });
  }
  return [...first.values()];
}

interface Deps {
  service: Pick<RewardsService, 'importLegacy'>;
  kv: KeyValueStore;
  loadAttempts: () => Promise<Attempt[]>;
  phrasesOf: (tuneId: string) => readonly number[] | null;
}

/** Send the device's old progress once; true when this run sent it. Never throws; tries again at the next launch if the server could not be reached. */
export async function importLegacyOnce({
  service,
  kv,
  loadAttempts,
  phrasesOf,
}: Deps): Promise<boolean> {
  try {
    if ((await kv.getItem(LEGACY_DONE_KEY)) === 'done') return false;
    const phrases = legacyPhrases(await loadAttempts(), phrasesOf).slice(0, 500);
    // Nothing to send is also done: the server need not hear of it.
    if (phrases.length > 0 && !(await service.importLegacy(phrases))) return false;
    await kv.setItem(LEGACY_DONE_KEY, 'done');
    return phrases.length > 0;
  } catch {
    return false;
  }
}
