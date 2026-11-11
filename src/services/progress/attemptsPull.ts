// Brings the account's attempts made on other devices (or before a reinstall) onto this one (spec 019): the
// server's attempts are read after a cursor and the ones this device lacks are added, each with the melody it
// belongs to rebuilt from the library (an attempt names `<tune>-<seed>`, and the tune and the seed make the
// melody again). Best scores, the week and the weak-spot card then read them like any other attempt. Never throws.
import type { Attempt, Melody } from '../../models';
import type { KeyValueStore } from '../../lib/deviceId';
import { catalogTune } from '../melody/catalog';
import { curatedMelody, tuneIdOf } from '../melody/curated';
import { getLevelByRank } from '../melody/levels';
import type { AttemptRepository, MelodyRepository } from '../storage/repositories';
import type { ProgressClient } from './client';

export const ATTEMPTS_CURSOR_KEY = 'ew.attemptsCursor';
const MAX_PAGES = 50;

interface Deps {
  attempts: AttemptRepository;
  melodies: MelodyRepository;
  client: ProgressClient;
  /** The signed-in session's token, or null when anonymous. */
  getToken: () => Promise<string | null>;
  kv: KeyValueStore;
}

/** The melody an attempt was made on, or null when its tune is no longer in the library. */
export function melodyOfAttempt(melodyId: string): Melody | null {
  const tuneId = tuneIdOf(melodyId);
  const tune = catalogTune(tuneId);
  const seed = Number(melodyId.slice(tuneId.length + 1));
  if (!tune || !Number.isFinite(seed)) return null;
  try {
    const melody = curatedMelody(getLevelByRank(tune.rank), seed, tuneId);
    return melody.id === melodyId ? melody : null;
  } catch {
    return null;
  }
}

export function createAttemptsPull({ attempts, melodies, client, getToken, kv }: Deps) {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  async function add(a: Attempt): Promise<boolean> {
    if (await attempts.get(a.id)) return false;
    await attempts.create(a);
    if (!(await melodies.get(a.melodyId))) {
      const melody = melodyOfAttempt(a.melodyId);
      if (melody) await melodies.save(melody);
    }
    return true;
  }

  return {
    /** Pull and add what this device lacks. Resolves with how many attempts were added. */
    pull: (): Promise<number> =>
      serial(async () => {
        try {
          const token = await getToken();
          if (!token) return 0;
          let after = Number((await kv.getItem(ATTEMPTS_CURSOR_KEY)) ?? 0) || 0;
          let added = 0;
          for (let page = 0; page < MAX_PAGES; page++) {
            const got = await client.pullAttempts(token, after);
            if (!got) break;
            for (const a of got.attempts) added += (await add(a)) ? 1 : 0;
            after = got.next;
            await kv.setItem(ATTEMPTS_CURSOR_KEY, String(after));
            if (!got.more) break;
          }
          return added;
        } catch {
          return 0;
        }
      }),
  };
}
