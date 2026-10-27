import { KeyValueStore } from '../../../src/lib/deviceId';
import { ONBOARDING_STEPS, isOnboarded, markOnboarded } from '../../../src/lib/onboarding';

function fakeStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return {
    async getItem(k) {
      return k in data ? data[k] : null;
    },
    async setItem(k, v) {
      data[k] = v;
    },
  };
}

describe('onboarding', () => {
  test('has three steps, each with a title and body', () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
    for (const s of ONBOARDING_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });

  test('shows until it is marked seen, then never again', async () => {
    const kv = fakeStore();
    expect(await isOnboarded(kv)).toBe(false);
    await markOnboarded(kv);
    expect(await isOnboarded(kv)).toBe(true);
  });
});
