// Keeps the device's melody places and the server's in step (spec 017), in the same spirit as the attempts
// outbox: a change waits on the device (its unsent flag) until the server has it, so a dead network or a killed
// app loses nothing; the latest write wins by time on both sides. Anonymous learners keep places on the device
// only, and send them when they sign in. Never throws.
import { mergeRemote } from '../../lib/melodyProgress';
import type { MelodyProgressRepository } from './melodyProgress';
import type { ProgressClient } from './client';

interface Deps {
  repo: MelodyProgressRepository;
  client: ProgressClient;
  /** The signed-in session's token, or null when anonymous. */
  getToken: () => Promise<string | null>;
}

export interface MelodySync {
  /** Send what the server does not have yet. */
  flush(): Promise<void>;
  /** Flush, then take the server's places (another device's, or this one's after a reinstall). */
  sync(): Promise<void>;
}

export function createMelodySync({ repo, client, getToken }: Deps): MelodySync {
  // One at a time, in order: two runs at once would send the same change twice.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.catch(() => undefined);
    return run;
  };

  async function flushNow(token: string): Promise<boolean> {
    for (const row of await repo.pending()) {
      const sent = row.deleted
        ? await client.deleteMelody(token, row.tuneId, row.updatedAt)
        : await client.putMelody(token, row);
      // The server is out of reach: the rest waits for the next run.
      if (!sent) return false;
      await repo.markSynced(row.tuneId, row.updatedAt);
    }
    return true;
  }

  const guarded = async (task: () => Promise<void>) => {
    try {
      await task();
    } catch {
      // a failed sync must never reach the screen; the next run retries
    }
  };

  return {
    flush: () =>
      serial(() =>
        guarded(async () => {
          const token = await getToken();
          if (token) await flushNow(token);
        }),
      ),

    sync: () =>
      serial(() =>
        guarded(async () => {
          const token = await getToken();
          if (!token || !(await flushNow(token))) return;
          const remote = await client.listMelodies(token);
          if (!remote) return;
          const { write, remove } = mergeRemote(await repo.everything(), remote);
          await repo.write(write);
          await repo.remove(remove);
        }),
      ),
  };
}
