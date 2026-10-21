// Postgres AuthStore (Drizzle). Tables: db/ddl.ts. Rules that must survive concurrent serverless
// instances (attempt counting, single use, one open link per device) are single statements or one transaction.
import { and, desc, eq, gte, isNull, lt, ne, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { authSessions, deviceLinks, loginCodes, users } from '../db/schema.js';
import type { AuthStore } from './store.js';

export function createPgStore(db: PostgresJsDatabase<Record<string, unknown>>): AuthStore {
  return {
    async requestTimes(email, sourceHash, since) {
      const [byEmail, bySource] = await Promise.all([
        db.select({ at: loginCodes.createdAt }).from(loginCodes).where(and(eq(loginCodes.email, email), gte(loginCodes.createdAt, since))),
        db.select({ at: loginCodes.createdAt }).from(loginCodes).where(and(eq(loginCodes.sourceHash, sourceHash), gte(loginCodes.createdAt, since))),
      ]);
      return { email: byEmail.map((r) => r.at), source: bySource.map((r) => r.at) };
    },

    async issueCode({ email, codeHash, sourceHash, now, expiresAt }) {
      return db.transaction(async (tx) => {
        await tx
          .update(loginCodes)
          .set({ supersededAt: now })
          .where(and(eq(loginCodes.email, email), isNull(loginCodes.usedAt), isNull(loginCodes.supersededAt)));
        const [row] = await tx
          .insert(loginCodes)
          .values({ email, codeHash, sourceHash, createdAt: now, expiresAt })
          .returning({ id: loginCodes.id });
        return row.id;
      });
    },

    async discardCode(id) {
      await db.delete(loginCodes).where(eq(loginCodes.id, id));
    },

    async purgeCodesBefore(cutoff) {
      await db.delete(loginCodes).where(lt(loginCodes.createdAt, cutoff));
    },

    async latestCode(email) {
      const [row] = await db.select().from(loginCodes).where(eq(loginCodes.email, email)).orderBy(desc(loginCodes.createdAt)).limit(1);
      if (!row) return null;
      const { sourceHash: _omit, ...code } = row;
      return code;
    },

    async takeAttempt(id, max) {
      const [row] = await db
        .update(loginCodes)
        .set({ attempts: sql`${loginCodes.attempts} + 1` })
        .where(and(eq(loginCodes.id, id), isNull(loginCodes.usedAt), isNull(loginCodes.supersededAt), lt(loginCodes.attempts, max)))
        .returning({ attempts: loginCodes.attempts });
      return row ? row.attempts : null;
    },

    async consumeCode(id, now) {
      const rows = await db
        .update(loginCodes)
        .set({ usedAt: now })
        .where(and(eq(loginCodes.id, id), isNull(loginCodes.usedAt)))
        .returning({ id: loginCodes.id });
      return rows.length === 1;
    },

    async signIn({ email, deviceId, tokenHash, now }) {
      return db.transaction(async (tx) => {
        const inserted = await tx.insert(users).values({ email, createdAt: now }).onConflictDoNothing().returning({ id: users.id });
        const created = inserted.length === 1;
        const userId = created
          ? inserted[0].id
          : (await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1))[0].id;

        await tx
          .update(deviceLinks)
          .set({ unlinkedAt: now })
          .where(and(eq(deviceLinks.deviceId, deviceId), isNull(deviceLinks.unlinkedAt), ne(deviceLinks.userId, userId)));
        const open = await tx
          .select({ id: deviceLinks.id })
          .from(deviceLinks)
          .where(and(eq(deviceLinks.deviceId, deviceId), isNull(deviceLinks.unlinkedAt), eq(deviceLinks.userId, userId)));
        if (open.length === 0) await tx.insert(deviceLinks).values({ deviceId, userId, linkedAt: now });

        await tx.insert(authSessions).values({ tokenHash, userId, deviceId, createdAt: now });
        return { userId, created };
      });
    },

    async sessionByToken(tokenHash) {
      const [row] = await db
        .select({ userId: users.id, email: users.email, deviceId: authSessions.deviceId })
        .from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId))
        .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
      return row ?? null;
    },

    async signOut(tokenHash, now) {
      await db.transaction(async (tx) => {
        const [s] = await tx
          .update(authSessions)
          .set({ revokedAt: now })
          .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)))
          .returning({ userId: authSessions.userId, deviceId: authSessions.deviceId });
        if (!s) return;
        await tx
          .update(deviceLinks)
          .set({ unlinkedAt: now })
          .where(and(eq(deviceLinks.deviceId, s.deviceId), eq(deviceLinks.userId, s.userId), isNull(deviceLinks.unlinkedAt)));
      });
    },

    async deleteUser(userId) {
      await db.transaction(async (tx) => {
        const [u] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
        if (!u) return;
        await tx.delete(loginCodes).where(eq(loginCodes.email, u.email));
        await tx.delete(users).where(eq(users.id, userId)); // sessions and links cascade
      });
    },

    async deleteUserByEmail(email) {
      const [u] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
      if (!u) return false;
      await this.deleteUser(u.id);
      return true;
    },

    async attributedEmail(deviceId, at) {
      const t = at.toISOString();
      const rows = await db
        .select({ email: users.email })
        .from(deviceLinks)
        .innerJoin(users, eq(users.id, deviceLinks.userId))
        .where(
          and(
            eq(deviceLinks.deviceId, deviceId),
            sql`(
              (${deviceLinks.linkedAt} <= ${t}::timestamptz and (${deviceLinks.unlinkedAt} is null or ${t}::timestamptz < ${deviceLinks.unlinkedAt}))
              or (${t}::timestamptz < ${deviceLinks.linkedAt}
                  and not exists (select 1 from device_links p where p.device_id = ${deviceLinks.deviceId} and p.linked_at < ${deviceLinks.linkedAt}))
            )`,
          ),
        )
        .orderBy(desc(deviceLinks.linkedAt))
        .limit(1);
      return rows[0]?.email ?? null;
    },
  };
}
