// The shared rewards service of the running app (spec 024): over the device's key-value store, the signed-in account (or
// the device-only identity the server made for this install), and the backend. With no backend in the build, checks are
// only ever queued and nothing is paid — there is no server to pay it.
import { keyValueOverRowStore } from '../../lib/deviceId';
import { ensureAuthReady, getAuthService } from '../../features/auth/authService';
import { appDeviceId } from '../../features/device/appDeviceId';
import { getLibrary } from '../tunes/library';
import { KEY_VALUE_TABLE, defaultRowStore } from '../storage/db';
import { createAttemptRepository } from '../storage/repositories';
import { createCheckQueue } from './checkQueue';
import { createRewardsClient } from './client';
import { createIdentity, type Identity } from './identity';
import { importLegacyOnce } from './legacy';
import { createRewardsService, type RewardsService } from './service';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let shared: { service: RewardsService; identity: Identity } | undefined;

function build() {
  const store = defaultRowStore();
  const kv = keyValueOverRowStore(store, KEY_VALUE_TABLE);
  const client = createRewardsClient(API_URL);
  const identity = createIdentity({
    // The session may still be loading at launch: wait for it, or the first call would make an anonymous identity.
    accountToken: async () => {
      await ensureAuthReady();
      return getAuthService().getToken();
    },
    kv,
    client,
    deviceId: appDeviceId,
  });
  const service = createRewardsService({ client, identity, queue: createCheckQueue(kv), kv });
  return { service, identity };
}

export function getRewards(): RewardsService {
  return (shared ??= build()).service;
}

let started = false;

/** At launch: show the last standing from the device, send what is waiting, ask for the standing, send old progress once. */
export function startRewards(): void {
  if (started) return;
  started = true;
  const { service, identity } = (shared ??= build());
  const store = defaultRowStore();
  void (async () => {
    await service.init();
    await service.flush();
    await service.refresh();
    const phrasesOf = (id: string) => getLibrary().find((t) => t.id === id)?.phrases ?? null;
    if (
      await importLegacyOnce({
        service,
        kv: keyValueOverRowStore(store, KEY_VALUE_TABLE),
        loadAttempts: () => createAttemptRepository(store).all(),
        phrasesOf,
      })
    ) {
      await service.refresh();
    }
  })().catch(() => undefined);
  // Signing in folds this install's anonymous identity into the account on the server: drop its token, read the merged standing.
  getAuthService().onAuthChange(() => {
    void identity
      .signedIn()
      .then(() => service.refresh())
      .catch(() => undefined);
  });
}
