// The one AuthService of the running app, wired to the real device pieces: HTTP client, OS secure store,
// and the SQLite key-value table that already holds the anonymous device id.
import { getOrCreateDeviceId, keyValueOverRowStore } from '../../lib/deviceId';
import { createAuthClient } from '../../services/auth/client';
import { createAuthService, AuthService, AuthState } from '../../services/auth/service';
import { createSecureSessionStore } from '../../services/auth/session';
import { KEY_VALUE_TABLE, defaultRowStore } from '../../services/storage/db';

// Absent in a build without a backend → no sign-in at all and the app stays anonymous.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

let instance: AuthService | undefined;
let ready: Promise<AuthState> | undefined;

export function getAuthService(): AuthService {
  if (!instance) {
    const kv = keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE);
    instance = createAuthService({
      client: createAuthClient(API_URL),
      session: createSecureSessionStore(),
      kv,
      getDeviceId: () => getOrCreateDeviceId(kv),
      now: Date.now,
    });
  }
  return instance;
}

/** Restores the stored session once per app run; every caller awaits the same promise. */
export function ensureAuthReady(): Promise<AuthState> {
  ready ??= getAuthService().init();
  return ready;
}
