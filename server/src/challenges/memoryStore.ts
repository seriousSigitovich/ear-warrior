// In-memory ChallengeStore (tests and local runs without Postgres).
import type { DailyChallenges } from './daily.js';
import type { ChallengeStore } from './override.js';

export function createMemoryChallengeStore(): ChallengeStore {
  const days = new Map<string, DailyChallenges>();
  return {
    async get(date) {
      return days.get(date) ?? null;
    },
    async list(from, to) {
      return [...days.values()].filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date));
    },
    async set(day) {
      days.set(day.date, day);
    },
    async remove(date) {
      days.delete(date);
    },
  };
}
