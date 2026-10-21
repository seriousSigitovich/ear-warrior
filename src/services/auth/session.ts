// Where the signed-in session lives on the device (R10): the OS secure store, not the SQLite file that
// sync copies to the server. The interface is injected so the lifecycle is testable with a fake.

export interface StoredSession {
  token: string;
  email: string;
}

export interface SessionStore {
  get(): Promise<StoredSession | null>;
  set(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'ew.session';

/** expo-secure-store adapter (Android Keystore). Required lazily so the Jest runner never loads native code. */
export function createSecureSessionStore(): SessionStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped native module handle
  let mod: any;
  const secure = () => (mod ??= require('expo-secure-store'));
  return {
    async get() {
      try {
        const raw = await secure().getItemAsync(KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<StoredSession>) : null;
        return parsed && typeof parsed.token === 'string' && typeof parsed.email === 'string'
          ? { token: parsed.token, email: parsed.email }
          : null;
      } catch {
        return null; // unreadable store = signed out; practice never depends on it
      }
    },
    async set(session) {
      await secure().setItemAsync(KEY, JSON.stringify(session));
    },
    async clear() {
      await secure().deleteItemAsync(KEY);
    },
  };
}
