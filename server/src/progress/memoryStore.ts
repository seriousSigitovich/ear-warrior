// In-memory ProgressStore for route tests; behaves like the Postgres one.
import { RECENT_LIMIT, type ProgressAttempt, type ProgressDifficulty, type ProgressStore } from './store.js';

export function createMemoryProgressStore(): ProgressStore {
  const attempts = new Map<string, Map<string, ProgressAttempt>>();
  const difficulty = new Map<string, ProgressDifficulty>();

  return {
    async addAttempt(userId, attempt) {
      const mine = attempts.get(userId) ?? new Map<string, ProgressAttempt>();
      if (!mine.has(attempt.id)) mine.set(attempt.id, attempt);
      attempts.set(userId, mine);
    },

    async history(userId) {
      const mine = [...(attempts.get(userId)?.values() ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return {
        mastered: [...new Set(mine.filter((a) => a.verdict === 'correct').map((a) => a.tuneId))],
        recent: mine.slice(-RECENT_LIMIT).map((a) => a.tuneId),
      };
    },

    async getDifficulty(userId) {
      return difficulty.get(userId) ?? null;
    },

    async putDifficulty(userId, d) {
      difficulty.set(userId, d);
    },
  };
}
