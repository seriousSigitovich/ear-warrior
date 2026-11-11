// The shared XP service of the running app, over the device store. The first use converts attempts
// recorded before the reward system existed (once); the service queues its calls, so every other call
// waits for that conversion to finish.
import { defaultRowStore } from '../storage/db';
import { GamificationService, createGamificationService } from './service';

let shared: GamificationService | undefined;

export function getGamification(): GamificationService {
  if (!shared) {
    shared = createGamificationService({ store: defaultRowStore() });
    void shared.init().catch(() => undefined);
  }
  return shared;
}
