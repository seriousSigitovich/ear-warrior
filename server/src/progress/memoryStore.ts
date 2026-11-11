// In-memory ProgressStore for route tests; behaves like the Postgres one.
import {
  RECENT_LIMIT,
  type GameRowOut,
  type MelodyPlace,
  type ProgressAttempt,
  type ProgressDifficulty,
  type ProgressStore,
} from './store.js';

export function createMemoryProgressStore(): ProgressStore {
  const attempts = new Map<string, Map<string, ProgressAttempt>>();
  const difficulty = new Map<string, ProgressDifficulty>();
  /** One arrival counter for everything the store hands out a cursor for. */
  let seq = 0;
  const attemptSeq = new Map<string, Map<string, number>>();
  const gameRows = new Map<string, Map<string, GameRowOut>>();
  /** Per account and tune; `deleted` keeps the delete so an older write cannot bring the place back. */
  const places = new Map<string, Map<string, MelodyPlace & { deleted: boolean }>>();

  return {
    async addAttempt(userId, attempt) {
      const mine = attempts.get(userId) ?? new Map<string, ProgressAttempt>();
      if (!mine.has(attempt.id)) {
        mine.set(attempt.id, attempt);
        const order = attemptSeq.get(userId) ?? new Map<string, number>();
        order.set(attempt.id, ++seq);
        attemptSeq.set(userId, order);
      }
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

    async putGameRows(userId, rows) {
      const mine = gameRows.get(userId) ?? new Map<string, GameRowOut>();
      for (const r of rows) {
        const key = `${r.kind}|${r.id}`;
        const had = mine.get(key);
        const earlier =
          r.kind === 'mastery' && had && String(r.data.achievedAt) < String(had.data.achievedAt);
        if (!had || earlier) mine.set(key, { ...r, seq: ++seq });
      }
      gameRows.set(userId, mine);
    },

    async gameRowsAfter(userId, after, limit) {
      const all = [...(gameRows.get(userId)?.values() ?? [])].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq);
      const rows = all.slice(0, limit);
      return { rows, next: rows.length ? rows[rows.length - 1].seq : after, more: all.length > limit };
    },

    async attemptsAfter(userId, after, limit) {
      const order = attemptSeq.get(userId) ?? new Map<string, number>();
      const all = [...(attempts.get(userId)?.values() ?? [])]
        .map((a) => ({ ...a, seq: order.get(a.id) ?? 0 }))
        .filter((a) => a.seq > after)
        .sort((a, b) => a.seq - b.seq);
      const page = all.slice(0, limit);
      return { attempts: page, next: page.length ? page[page.length - 1].seq : after, more: all.length > limit };
    },

    async putMelody(userId, place) {
      const mine = places.get(userId) ?? new Map();
      const had = mine.get(place.tuneId);
      if (had && had.updatedAt.getTime() > place.updatedAt.getTime()) return false;
      mine.set(place.tuneId, { ...place, deleted: false });
      places.set(userId, mine);
      return true;
    },

    async listMelodies(userId) {
      return [...(places.get(userId)?.values() ?? [])].filter((p) => !p.deleted).map(({ deleted: _deleted, ...p }) => p);
    },

    async deleteMelody(userId, tuneId, updatedAt) {
      const mine = places.get(userId) ?? new Map();
      const had = mine.get(tuneId);
      if (had && had.updatedAt.getTime() > updatedAt.getTime()) return;
      mine.set(tuneId, { tuneId, phrase: 0, phrases: 1, grades: [], updatedAt, deleted: true });
      places.set(userId, mine);
    },
  };
}
