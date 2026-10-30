// Attempts finished while signed in that the server has not confirmed yet. Each attempt is posted on its
// own; a failed post stays queued (by id, in the key-value store) and goes out with the next flush, so a
// dead network or a killed app loses nothing. The server ignores an id it already has, so re-posting is safe.
import type { Attempt } from '../../models';
import type { KeyValueStore } from '../../lib/deviceId';
import type { ProgressClient } from './client';

export const PROGRESS_OUTBOX_KEY = 'ew.progressOutbox';

interface Deps {
  client: ProgressClient;
  /** The signed-in session's token, or null when anonymous. */
  getToken: () => Promise<string | null>;
  kv: KeyValueStore;
  getAttempt: (id: string) => Promise<Attempt | null>;
}

export function createProgressOutbox({ client, getToken, kv, getAttempt }: Deps) {
  // One flush at a time, in order: concurrent flushes would post the same attempt twice.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  async function pending(): Promise<string[]> {
    try {
      const ids: unknown = JSON.parse((await kv.getItem(PROGRESS_OUTBOX_KEY)) ?? '[]');
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  const save = (ids: string[]) => kv.setItem(PROGRESS_OUTBOX_KEY, JSON.stringify(ids));

  async function flushNow(): Promise<void> {
    const token = await getToken();
    if (!token) return;
    const ids = await pending();
    for (let i = 0; i < ids.length; i++) {
      const attempt = await getAttempt(ids[i]);
      // An attempt that is gone locally can never be sent: drop it. A failed post means the server is
      // out of reach, so the rest waits for the next flush.
      if (attempt && !(await client.postAttempt(token, attempt))) {
        await save(ids.slice(i));
        return;
      }
    }
    await save([]);
  }

  return {
    /** Queue a finished attempt and try to send everything queued. Anonymous learners queue nothing. */
    enqueue: (attempt: Attempt): Promise<void> =>
      serial(async () => {
        if (!(await getToken())) return;
        await save([...new Set([...(await pending()), attempt.id])]);
        await flushNow();
      }),
    /** Send what is still queued (app start, screen open). */
    flush: (): Promise<void> => serial(flushNow),
  };
}
