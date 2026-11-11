// The shared XP service of the running app, over the device store. The first use converts attempts
// recorded before the reward system existed (once); the service queues its calls, so every other call
// waits for that conversion to finish. The day's challenges come from the backend when the build has one
// (spec 018), else the built-in ones stand.
import { createChallengesClient } from '../challenges/client';
import { defaultRowStore } from '../storage/db';
import { GamificationService, createGamificationService } from './service';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let shared: GamificationService | undefined;

export function getGamification(): GamificationService {
  if (!shared) {
    const challenges = createChallengesClient(API_URL);
    shared = createGamificationService({
      store: defaultRowStore(),
      fetchChallenges: challenges ? (day) => challenges.today(day) : undefined,
    });
    void shared.init().catch(() => undefined);
  }
  return shared;
}
