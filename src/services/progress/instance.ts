// The shared melody places of the running app (spec 017): the device's copy over the local store, and the
// sync with the server when the build has one (its address) — the sync asks the signed-in session for its
// token each time, so an anonymous learner's places simply wait on the device.
import { getAuthService } from '../../features/auth/authService';
import { defaultRowStore } from '../storage/db';
import { createProgressClient } from './client';
import { MelodyProgressRepository, createMelodyProgressRepository } from './melodyProgress';
import { MelodySync, createMelodySync } from './melodySync';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface MelodyProgress {
  repo: MelodyProgressRepository;
  /** Null in a build without a server: places stay on the device. */
  sync: MelodySync | null;
}

let shared: MelodyProgress | undefined;

export function getMelodyProgress(): MelodyProgress {
  if (!shared) {
    const repo = createMelodyProgressRepository(defaultRowStore());
    const client = createProgressClient(API_URL);
    shared = {
      repo,
      sync: client
        ? createMelodySync({ repo, client, getToken: () => getAuthService().getToken() })
        : null,
    };
  }
  return shared;
}
