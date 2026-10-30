// Postgres ProgressStore (Drizzle). Tables: db/ddl.ts. Rows hang off `users` with ON DELETE CASCADE, so
// deleting an account removes its progress with it.
import { and, desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { progressAttempts, progressDifficulty } from '../db/schema.js';
import { RECENT_LIMIT, type ProgressStore } from './store.js';

export function createPgProgressStore(db: PostgresJsDatabase<Record<string, unknown>>): ProgressStore {
  return {
    async addAttempt(userId, a) {
      await db
        .insert(progressAttempts)
        .values({
          userId,
          id: a.id,
          sessionId: a.sessionId,
          melodyId: a.melodyId,
          tuneId: a.tuneId,
          verdict: a.verdict,
          confidence: a.confidence,
          lowConfidence: a.lowConfidence,
          timedOut: a.timedOut,
          inputMode: a.inputMode,
          noteResults: a.noteResults,
          createdAt: a.createdAt,
        })
        .onConflictDoNothing();
    },

    async history(userId) {
      const [mastered, recent] = await Promise.all([
        db
          .selectDistinct({ tuneId: progressAttempts.tuneId })
          .from(progressAttempts)
          .where(and(eq(progressAttempts.userId, userId), eq(progressAttempts.verdict, 'correct'))),
        db
          .select({ tuneId: progressAttempts.tuneId })
          .from(progressAttempts)
          .where(eq(progressAttempts.userId, userId))
          .orderBy(desc(progressAttempts.createdAt))
          .limit(RECENT_LIMIT),
      ]);
      return { mastered: mastered.map((r) => r.tuneId), recent: recent.map((r) => r.tuneId).reverse() };
    },

    async getDifficulty(userId) {
      const [row] = await db.select().from(progressDifficulty).where(eq(progressDifficulty.userId, userId));
      if (!row) return null;
      return {
        mode: row.mode as 'adaptive' | 'fixed',
        adaptiveRank: row.adaptiveRank,
        fixedRank: row.fixedRank,
        streakKind: row.streakKind as 'correct' | 'incorrect' | 'none',
        streakCount: row.streakCount,
      };
    },

    async putDifficulty(userId, d, now) {
      const values = { ...d, updatedAt: now };
      await db
        .insert(progressDifficulty)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: progressDifficulty.userId, set: values });
    },
  };
}
