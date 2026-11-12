// Postgres ChallengeStore (Drizzle). Table: db/ddl.ts.
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { dailyChallengeOverrides } from '../db/schema.js';
import type { DailyChallenge, DailyChallenges } from './daily.js';
import type { ChallengeStore } from './override.js';

type Row = typeof dailyChallengeOverrides.$inferSelect;
const toDay = (r: Row): DailyChallenges => ({ date: r.date, challenges: r.challenges as DailyChallenge[], allBonusXp: r.allBonusXp });

export function createPgChallengeStore(db: PostgresJsDatabase<Record<string, unknown>>): ChallengeStore {
  return {
    async get(date) {
      const rows = await db.select().from(dailyChallengeOverrides).where(eq(dailyChallengeOverrides.date, date)).limit(1);
      return rows[0] ? toDay(rows[0]) : null;
    },
    async list(from, to) {
      const rows = await db
        .select()
        .from(dailyChallengeOverrides)
        .where(and(gte(dailyChallengeOverrides.date, from), lte(dailyChallengeOverrides.date, to)))
        .orderBy(asc(dailyChallengeOverrides.date));
      return rows.map(toDay);
    },
    async set(day) {
      const values = { date: day.date, challenges: day.challenges, allBonusXp: day.allBonusXp, updatedAt: new Date() };
      await db
        .insert(dailyChallengeOverrides)
        .values(values)
        .onConflictDoUpdate({ target: dailyChallengeOverrides.date, set: values });
    },
    async remove(date) {
      await db.delete(dailyChallengeOverrides).where(eq(dailyChallengeOverrides.date, date));
    },
  };
}
