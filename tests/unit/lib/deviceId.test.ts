import { KeyValueStore, generateDeviceId, getOrCreateDeviceId } from '../../../src/lib/deviceId';

/** Deterministic RNG cycling through a fixed sequence. */
function seededRand(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

function fakeStore(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    async getItem(key) {
      return key in data ? data[key] : null;
    },
    async setItem(key, value) {
      data[key] = value;
    },
  };
}

describe('anonymous device id (R9)', () => {
  test('generates a PII-free id: dev_ + 32 hex chars', () => {
    expect(generateDeviceId(() => 0.5)).toMatch(/^dev_[0-9a-f]{32}$/);
  });

  test('is deterministic for a given RNG sequence', () => {
    const seq = [0.1, 0.4, 0.7, 0.9];
    expect(generateDeviceId(seededRand(seq))).toBe(generateDeviceId(seededRand(seq)));
  });

  test('returns the existing id when one is stored', async () => {
    const store = fakeStore({ 'ew.deviceId': 'dev_existing' });
    expect(await getOrCreateDeviceId(store)).toBe('dev_existing');
  });

  test('creates and persists an id on first use', async () => {
    const store = fakeStore();
    const id = await getOrCreateDeviceId(store, () => 0.5);
    expect(id).toMatch(/^dev_[0-9a-f]{32}$/);
    expect(store.data['ew.deviceId']).toBe(id);
    // second call reuses the persisted id
    expect(await getOrCreateDeviceId(store, () => 0.1)).toBe(id);
  });
});
