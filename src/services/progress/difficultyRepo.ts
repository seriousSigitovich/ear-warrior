// The difficulty repository with the account behind it: a signed-in learner's state is read from and
// written to the server, the local row stays the offline cache (and the only copy when anonymous).
//
// The local row wins while a change has not reached the server yet: otherwise a level picked in
// Settings would be overwritten by the account's older state on the next load (the Fixed-mode bug).
import type { DifficultySettings } from '../../models';
import type { DifficultySettingsRepository } from '../storage/repositories';
import type { ProgressClient } from './client';

export function withBackend(
  local: DifficultySettingsRepository,
  { client, getToken }: { client: ProgressClient; getToken: () => Promise<string | null> },
): DifficultySettingsRepository {
  // The last save still on its way to the server, and whether a sent one was refused or lost.
  let inflight: Promise<unknown> = Promise.resolve();
  let unsent = false;

  async function push(token: string, settings: DifficultySettings): Promise<void> {
    unsent = true;
    if (await client.putDifficulty(token, settings)) unsent = false;
  }

  return {
    async load() {
      await inflight;
      const token = await getToken();
      if (!token) return local.load();
      if (unsent) {
        // This device holds the newer state: send it again instead of reading the stale one back.
        const cached = await local.load();
        inflight = push(token, cached);
        await inflight;
        return cached;
      }
      const remote = await client.getDifficulty(token);
      if (!remote) return local.load();
      await local.save(remote); // keep the cache current for the next offline start
      return remote;
    },

    save(settings) {
      // Queued synchronously, so a load started right after this call already waits for it.
      const saved = inflight.then(async () => {
        await local.save(settings);
        const token = await getToken();
        if (token) await push(token, settings);
      });
      inflight = saved;
      return saved;
    },
  };
}
