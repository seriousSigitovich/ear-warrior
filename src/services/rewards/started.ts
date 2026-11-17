// The "daily challenges started" analytics event fires once per local day: the first time the screen shows the day's
// challenges. The day it last fired for is kept on the device.
import type { KeyValueStore } from '../../lib/deviceId';

export const CHALLENGES_STARTED_KEY = 'ew.challengesStartedDay';

/** True the first time it is called for `day`; false after (and when the device cannot say). */
export async function markChallengesStarted(kv: KeyValueStore, day: string): Promise<boolean> {
  try {
    if ((await kv.getItem(CHALLENGES_STARTED_KEY)) === day) return false;
    await kv.setItem(CHALLENGES_STARTED_KEY, day);
    return true;
  } catch {
    return false;
  }
}
