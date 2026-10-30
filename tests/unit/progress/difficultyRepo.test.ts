import { DifficultySettings } from '../../../src/models';
import { ProgressClient } from '../../../src/services/progress/client';
import { withBackend } from '../../../src/services/progress/difficultyRepo';
import { DifficultySettingsRepository } from '../../../src/services/storage/repositories';

const local: DifficultySettings = { mode: 'adaptive', adaptiveRank: 1, fixedRank: 1, streakKind: 'none', streakCount: 0 };
const remote: DifficultySettings = { mode: 'adaptive', adaptiveRank: 5, fixedRank: 1, streakKind: 'correct', streakCount: 1 };

function setup(token: string | null, server: DifficultySettings | null) {
  let cache = local;
  const puts: DifficultySettings[] = [];
  const repo: DifficultySettingsRepository = {
    load: async () => cache,
    save: async (s) => void (cache = s),
  };
  const client = {
    getDifficulty: async () => server,
    putDifficulty: async (_t: string, s: DifficultySettings) => {
      puts.push(s);
      return true;
    },
  } as unknown as ProgressClient;
  return { backed: withBackend(repo, { client, getToken: async () => token }), puts, cache: () => cache };
}

describe('difficulty repository with a backend', () => {
  test('signed in: loads the account’s state and refreshes the local cache with it', async () => {
    const t = setup('tok', remote);
    expect(await t.backed.load()).toEqual(remote);
    expect(t.cache()).toEqual(remote);
  });

  test('signed in but the server has none or is unreachable: the local state', async () => {
    expect(await setup('tok', null).backed.load()).toEqual(local);
  });

  test('anonymous: local only, nothing sent', async () => {
    const t = setup(null, remote);
    expect(await t.backed.load()).toEqual(local);
    await t.backed.save(remote);
    expect(t.cache()).toEqual(remote);
    expect(t.puts).toEqual([]);
  });

  test('signed in: save writes the cache and puts the state to the server', async () => {
    const t = setup('tok', null);
    await t.backed.save(remote);
    expect(t.cache()).toEqual(remote);
    expect(t.puts).toEqual([remote]);
  });
});
