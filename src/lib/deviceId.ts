// Anonymous per-install device id (R9): a random, non-PII identifier generated once and stored
// locally. Pure generation + an injected key-value store so it is testable without native storage.

const DEVICE_ID_KEY = 'ew.deviceId';

/** Minimal async key-value store (implemented over expo-file-system / async storage on device). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Generate a random, PII-free device id: `dev_` + 32 hex chars. */
export function generateDeviceId(rand: () => number = Math.random): string {
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(rand() * 16).toString(16);
  }
  return `dev_${hex}`;
}

/**
 * Adapt any durable document store (the app's SQLite `RowStore`) to the key-value shape.
 * Keeps the device id in the same database as everything else — no extra native dependency.
 */
export function keyValueOverRowStore(
  store: {
    insert(table: string, id: string, row: Record<string, unknown>): Promise<void>;
    getById<T>(table: string, id: string): Promise<T | null>;
  },
  table: string,
): KeyValueStore {
  return {
    async getItem(key) {
      const row = await store.getById<{ value: string }>(table, key);
      return row ? row.value : null;
    },
    async setItem(key, value) {
      await store.insert(table, key, { value });
    },
  };
}

/** Return the stored device id, generating and persisting one on first use. */
export async function getOrCreateDeviceId(
  store: KeyValueStore,
  rand: () => number = Math.random,
): Promise<string> {
  const existing = await store.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = generateDeviceId(rand);
  await store.setItem(DEVICE_ID_KEY, id);
  return id;
}
