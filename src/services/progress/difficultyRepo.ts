// The difficulty repository with the account behind it: a signed-in learner's state is read from and
// written to the server, the local row stays the offline cache (and the only copy when anonymous).
import type { DifficultySettingsRepository } from '../storage/repositories';
import type { ProgressClient } from './client';

export function withBackend(
  local: DifficultySettingsRepository,
  { client, getToken }: { client: ProgressClient; getToken: () => Promise<string | null> },
): DifficultySettingsRepository {
  return {
    async load() {
      const token = await getToken();
      const remote = token ? await client.getDifficulty(token) : null;
      if (!remote) return local.load();
      await local.save(remote); // keep the cache current for the next offline start
      return remote;
    },

    async save(settings) {
      await local.save(settings);
      const token = await getToken();
      // Fire and forget: the next change sends the newer state, so a miss here costs nothing.
      if (token) void client.putDifficulty(token, settings);
    },
  };
}
