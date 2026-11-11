// The shared sync of the running app (spec 019): melody places, the reward system's rows and the account's
// attempts, run by one throttled runner. With no server in the build every step is a no-op.
import { keyValueOverRowStore } from '../../lib/deviceId';
import { ensureAuthReady, getAuthService } from '../../features/auth/authService';
import { createGameSync } from '../gamification/sync';
import { createAttemptsPull } from '../progress/attemptsPull';
import { createProgressClient } from '../progress/client';
import { getMelodyProgress } from '../progress/instance';
import { KEY_VALUE_TABLE, defaultRowStore } from '../storage/db';
import { createAttemptRepository, createMelodyRepository } from '../storage/repositories';
import { SyncRunner, createSyncRunner } from './runner';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let shared: SyncRunner | undefined;

function build(): SyncRunner {
  const client = createProgressClient(API_URL);
  if (!client) return createSyncRunner({ steps: [] });
  const store = defaultRowStore();
  // The session may still be loading at launch: wait for it, or the first run would find nobody signed in.
  const getToken = async () => {
    await ensureAuthReady();
    return getAuthService().getToken();
  };
  const game = createGameSync({ store, client, getToken });
  const attempts = createAttemptsPull({
    attempts: createAttemptRepository(store),
    melodies: createMelodyRepository(store),
    client,
    getToken,
    kv: keyValueOverRowStore(store, KEY_VALUE_TABLE),
  });
  const places = getMelodyProgress().sync;
  return createSyncRunner({
    steps: [
      async () => {
        await places?.sync();
      },
      () => game.sync(),
      async () => (await attempts.pull()) > 0,
    ],
  });
}

/** Sync now if it has been a minute (or `force`); true when this device received something new. */
export function requestSync(opts?: { force?: boolean }): Promise<boolean> {
  shared ??= build();
  return shared.request(opts);
}
