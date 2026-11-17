// Postgres LedgerStore (Drizzle). Tables: db/ddl.ts. Every account's writes take one advisory lock for the
// transaction, so two simultaneous checks of one phrase (or one check id) are handled one after the other — the
// attempt number, the "pays once" rule and the cap counter then hold without retries.
import { and, asc, eq, like, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { dailyXp, phraseChecks, phraseEvents, xpLedger } from '../db/schema.js';
import { alreadyPaid, type Payout } from '../game/xp.js';
import type { CheckContext, LedgerStore, PhraseRecord, StoredCheck } from './ledger.js';

type Db = PostgresJsDatabase<Record<string, unknown>>;
type CheckRow = typeof phraseChecks.$inferSelect;

const toCheck = (r: CheckRow): StoredCheck => ({
  checkId: r.checkId,
  tuneId: r.tuneId,
  phrase: r.phrase,
  attemptNo: r.attemptNo,
  played: r.played,
  noteResults: r.noteResults,
  accuracy: r.accuracy,
  passed: r.passed,
  xp: r.xp,
  payout: r.payout as Payout,
  localDay: r.localDay,
});

export function createPgLedgerStore(db: Db): LedgerStore {
  const lock = (tx: Pick<Db, 'execute'>, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ledger:${userId}`}))`);

  return {
    async getCheck(userId, checkId) {
      const [row] = await db
        .select()
        .from(phraseChecks)
        .where(and(eq(phraseChecks.userId, userId), eq(phraseChecks.checkId, checkId)))
        .limit(1);
      return row ? toCheck(row) : null;
    },

    async recordCheck(input, compute) {
      return db.transaction(async (tx) => {
        await lock(tx, input.userId);
        const [existing] = await tx
          .select()
          .from(phraseChecks)
          .where(and(eq(phraseChecks.userId, input.userId), eq(phraseChecks.checkId, input.checkId)))
          .limit(1);
        if (existing) return { check: toCheck(existing), replay: true };

        const phraseWhere = and(
          eq(phraseChecks.userId, input.userId),
          eq(phraseChecks.tuneId, input.tuneId),
          eq(phraseChecks.phrase, input.phrase),
        );
        const earlier = await tx.select({ passed: phraseChecks.passed }).from(phraseChecks).where(phraseWhere);
        const events = await tx
          .select({ kind: phraseEvents.kind })
          .from(phraseEvents)
          .where(
            and(eq(phraseEvents.userId, input.userId), eq(phraseEvents.tuneId, input.tuneId), eq(phraseEvents.phrase, input.phrase)),
          );
        const [used] = await tx
          .select({ baseXp: dailyXp.baseXp })
          .from(dailyXp)
          .where(and(eq(dailyXp.userId, input.userId), eq(dailyXp.localDay, input.localDay)));
        const ctx: CheckContext = {
          attemptNo: earlier.length + 1,
          hint: events.some((e) => e.kind === 'hint'),
          answerShown: events.some((e) => e.kind === 'answer'),
          alreadyPassed: earlier.some((c) => c.passed),
          baseUsedToday: used?.baseXp ?? 0,
        };
        const pay = ctx.alreadyPassed ? alreadyPaid(ctx.attemptNo) : compute(ctx);

        const [row] = await tx
          .insert(phraseChecks)
          .values({
            userId: input.userId,
            checkId: input.checkId,
            tuneId: input.tuneId,
            phrase: input.phrase,
            attemptNo: ctx.attemptNo,
            played: input.played,
            noteResults: input.noteResults ?? [],
            accuracy: input.accuracy,
            passed: input.passed,
            xp: pay.xp,
            payout: pay,
            localDay: input.localDay,
            checkedAt: input.checkedAt,
            receivedAt: input.now,
          })
          .returning();

        if (!ctx.alreadyPassed && input.passed) {
          await tx
            .insert(xpLedger)
            .values({
              userId: input.userId,
              key: `phrase:${input.tuneId}:${input.phrase}`,
              kind: 'phrase',
              xp: pay.xp,
              breakdown: { ...pay },
              localDay: input.localDay,
              at: input.checkedAt,
            })
            .onConflictDoNothing();
          await tx
            .insert(dailyXp)
            .values({ userId: input.userId, localDay: input.localDay, baseXp: pay.capBase })
            .onConflictDoUpdate({ target: [dailyXp.userId, dailyXp.localDay], set: { baseXp: sql`${dailyXp.baseXp} + ${pay.capBase}` } });
        }
        return { check: toCheck(row), replay: false };
      });
    },

    async recordEvent(userId, tuneId, phrase, kind, now) {
      return db.transaction(async (tx) => {
        await lock(tx, userId);
        const passed = (
          await tx
            .select({ p: phraseChecks.passed })
            .from(phraseChecks)
            .where(and(eq(phraseChecks.userId, userId), eq(phraseChecks.tuneId, tuneId), eq(phraseChecks.phrase, phrase), eq(phraseChecks.passed, true)))
            .limit(1)
        ).length > 0;
        if (!passed) {
          await tx.insert(phraseEvents).values({ userId, tuneId, phrase, kind, at: now }).onConflictDoNothing();
        }
        return { passed };
      });
    },

    async phrasePassed(userId, tuneId, phrase) {
      const rows = await db
        .select({ p: phraseChecks.passed })
        .from(phraseChecks)
        .where(and(eq(phraseChecks.userId, userId), eq(phraseChecks.tuneId, tuneId), eq(phraseChecks.phrase, phrase), eq(phraseChecks.passed, true)))
        .limit(1);
      return rows.length > 0;
    },

    async totals(userId) {
      const [sum] = await db
        .select({ total: sql<number>`coalesce(sum(${xpLedger.xp}), 0)::int` })
        .from(xpLedger)
        .where(eq(xpLedger.userId, userId));
      const days = await db
        .selectDistinct({ day: xpLedger.localDay })
        .from(xpLedger)
        .where(eq(xpLedger.userId, userId))
        .orderBy(asc(xpLedger.localDay));
      return { totalXp: sum?.total ?? 0, days: days.map((d) => d.day) };
    },

    async phraseRecords(userId) {
      const rows = await db
        .select({
          tuneId: phraseChecks.tuneId,
          phrase: phraseChecks.phrase,
          firstAccuracy: sql<number>`(array_agg(${phraseChecks.accuracy} order by ${phraseChecks.attemptNo}))[1]::int`,
          passedDay: sql<string | null>`(array_agg(${phraseChecks.localDay}::text order by ${phraseChecks.attemptNo}) filter (where ${phraseChecks.passed}))[1]`,
        })
        .from(phraseChecks)
        .where(eq(phraseChecks.userId, userId))
        .groupBy(phraseChecks.tuneId, phraseChecks.phrase);
      return rows.map((r): PhraseRecord => ({ ...r, passedDay: r.passedDay ?? null }));
    },

    async addLedger(userId, row) {
      const inserted = await db
        .insert(xpLedger)
        .values({ userId, key: row.key, kind: row.kind, xp: row.xp, breakdown: row.breakdown, localDay: row.localDay, at: row.at })
        .onConflictDoNothing()
        .returning({ key: xpLedger.key });
      return inserted.length > 0;
    },

    async ledgerKeys(userId, prefix) {
      const rows = await db
        .select({ key: xpLedger.key })
        .from(xpLedger)
        .where(and(eq(xpLedger.userId, userId), like(xpLedger.key, `${prefix}%`)))
        .orderBy(asc(xpLedger.key));
      return rows.map((r) => r.key);
    },

    async merge(fromUserId, toUserId) {
      if (fromUserId === toUserId) return;
      await db.transaction(async (tx) => {
        // Both accounts locked, in a fixed order, so two merges (or a merge and a check) cannot deadlock.
        for (const id of [fromUserId, toUserId].sort()) await lock(tx, id);
        await tx.execute(sql`insert into xp_ledger (user_id, key, kind, xp, breakdown, local_day, at)
          select ${toUserId}::uuid, key, kind, xp, breakdown, local_day, at from xp_ledger where user_id = ${fromUserId}::uuid
          on conflict do nothing`);
        await tx.execute(sql`insert into phrase_checks (user_id, check_id, tune_id, phrase, attempt_no, played, note_results, accuracy, passed, xp, payout, local_day, checked_at, received_at)
          select ${toUserId}::uuid, check_id, tune_id, phrase, attempt_no, played, note_results, accuracy, passed, xp, payout, local_day, checked_at, received_at
          from phrase_checks where user_id = ${fromUserId}::uuid
          on conflict do nothing`);
        await tx.execute(sql`insert into phrase_events (user_id, tune_id, phrase, kind, at)
          select ${toUserId}::uuid, tune_id, phrase, kind, at from phrase_events where user_id = ${fromUserId}::uuid
          on conflict do nothing`);
        await tx.execute(sql`insert into daily_xp (user_id, local_day, base_xp)
          select ${toUserId}::uuid, local_day, base_xp from daily_xp where user_id = ${fromUserId}::uuid
          on conflict (user_id, local_day) do update set base_xp = daily_xp.base_xp + excluded.base_xp`);
        for (const table of ['xp_ledger', 'phrase_checks', 'phrase_events', 'daily_xp']) {
          await tx.execute(sql`delete from ${sql.raw(table)} where user_id = ${fromUserId}::uuid`);
        }
      });
    },

    async baseUsed(userId, day) {
      const [row] = await db
        .select({ baseXp: dailyXp.baseXp })
        .from(dailyXp)
        .where(and(eq(dailyXp.userId, userId), eq(dailyXp.localDay, day)));
      return row?.baseXp ?? 0;
    },
  };
}
