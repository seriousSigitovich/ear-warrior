// Postgres ProgressStore (Drizzle). Tables: db/ddl.ts. Rows hang off `users` with ON DELETE CASCADE, so
// deleting an account removes its progress with it.
import { and, asc, desc, eq, gt, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { progressAttempts, progressDifficulty, progressGameRows, progressMelodies } from '../db/schema.js';
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

    async putGameRows(userId, rows) {
      if (rows.length === 0) return;
      const values = rows.map((r) => ({ userId, kind: r.kind, id: r.id, data: r.data }));
      // Awards and completions are the same wherever they are made: a row already there stays as it is.
      const others = values.filter((v) => v.kind !== 'mastery');
      if (others.length > 0) await db.insert(progressGameRows).values(others).onConflictDoNothing();
      const masteries = values.filter((v) => v.kind === 'mastery');
      if (masteries.length === 0) return;
      // Mastery: the earlier date wins, and the row moves to the end of the order so devices pull it again.
      await db
        .insert(progressGameRows)
        .values(masteries)
        .onConflictDoUpdate({
          target: [progressGameRows.userId, progressGameRows.kind, progressGameRows.id],
          set: { data: sql`excluded.data`, seq: sql`nextval(pg_get_serial_sequence('progress_game_rows', 'seq'))` },
          setWhere: sql`excluded.data->>'achievedAt' < ${progressGameRows.data}->>'achievedAt'`,
        });
    },

    async gameRowsAfter(userId, after, limit) {
      const rows = await db
        .select()
        .from(progressGameRows)
        .where(and(eq(progressGameRows.userId, userId), gt(progressGameRows.seq, after)))
        .orderBy(asc(progressGameRows.seq))
        .limit(limit + 1);
      const page = rows.slice(0, limit).map((r) => ({
        kind: r.kind as 'award' | 'completion' | 'mastery',
        id: r.id,
        data: r.data as Record<string, unknown>,
        seq: Number(r.seq),
      }));
      return { rows: page, next: page.length ? page[page.length - 1].seq : after, more: rows.length > limit };
    },

    async attemptsAfter(userId, after, limit) {
      const rows = await db
        .select()
        .from(progressAttempts)
        .where(and(eq(progressAttempts.userId, userId), gt(progressAttempts.seq, after)))
        .orderBy(asc(progressAttempts.seq))
        .limit(limit + 1);
      const page = rows.slice(0, limit).map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        melodyId: r.melodyId,
        tuneId: r.tuneId,
        verdict: r.verdict as 'correct' | 'incorrect',
        confidence: r.confidence,
        lowConfidence: r.lowConfidence,
        timedOut: r.timedOut,
        inputMode: r.inputMode as 'mic' | 'fretboard',
        noteResults: r.noteResults as unknown[],
        createdAt: r.createdAt,
        seq: Number(r.seq),
      }));
      return { attempts: page, next: page.length ? page[page.length - 1].seq : after, more: rows.length > limit };
    },

    async putMelody(userId, p) {
      const values = { phrase: p.phrase, phrases: p.phrases, grades: p.grades, deleted: false, updatedAt: p.updatedAt };
      const stored = await db
        .insert(progressMelodies)
        .values({ userId, tuneId: p.tuneId, ...values })
        .onConflictDoUpdate({
          target: [progressMelodies.userId, progressMelodies.tuneId],
          set: values,
          // Only over an older or equal write: a stale offline device cannot undo a newer place or a delete.
          setWhere: lte(progressMelodies.updatedAt, p.updatedAt),
        })
        .returning({ tuneId: progressMelodies.tuneId });
      return stored.length > 0;
    },

    async listMelodies(userId) {
      const rows = await db
        .select()
        .from(progressMelodies)
        .where(and(eq(progressMelodies.userId, userId), eq(progressMelodies.deleted, false)));
      return rows.map((r) => ({
        tuneId: r.tuneId,
        phrase: r.phrase,
        phrases: r.phrases,
        grades: r.grades as unknown[],
        updatedAt: r.updatedAt,
      }));
    },

    async deleteMelody(userId, tuneId, updatedAt) {
      const values = { phrase: 0, phrases: 1, grades: [], deleted: true, updatedAt };
      await db
        .insert(progressMelodies)
        .values({ userId, tuneId, ...values })
        .onConflictDoUpdate({
          target: [progressMelodies.userId, progressMelodies.tuneId],
          set: values,
          setWhere: lte(progressMelodies.updatedAt, updatedAt),
        });
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
