import {
  CHALLENGES_STARTED_KEY,
  markChallengesStarted,
} from '../../../src/services/rewards/started';
import { memoryKv } from './fixtures';

describe('markChallengesStarted', () => {
  it('is true once per day, then false until the day changes', async () => {
    const kv = memoryKv();
    expect(await markChallengesStarted(kv, '2026-11-16')).toBe(true);
    expect(await markChallengesStarted(kv, '2026-11-16')).toBe(false);
    expect(await markChallengesStarted(kv, '2026-11-17')).toBe(true);
    expect(kv.data.get(CHALLENGES_STARTED_KEY)).toBe('2026-11-17');
  });
  it('is false when the device cannot say', async () => {
    const boom = {
      getItem: async () => {
        throw new Error('x');
      },
      setItem: async () => undefined,
    };
    expect(await markChallengesStarted(boom, '2026-11-16')).toBe(false);
  });
});
