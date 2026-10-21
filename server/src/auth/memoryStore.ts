// In-memory AuthStore for route tests: same behaviour as the Postgres one (store.contract.ts proves it).
import { randomUUID } from 'node:crypto';
import type { AuthStore, CodeRow, SessionInfo } from './store.js';

interface User { id: string; email: string }
interface Link { deviceId: string; userId: string; linkedAt: Date; unlinkedAt: Date | null }
interface Session { tokenHash: string; userId: string; deviceId: string; revokedAt: Date | null }
interface CodeRecord extends CodeRow { sourceHash: string }

export function createMemoryStore(): AuthStore {
  let users: User[] = [];
  let codes: CodeRecord[] = [];
  let links: Link[] = [];
  let sessions: Session[] = [];

  const userByEmail = (email: string) => users.find((u) => u.email === email);
  const toRow = ({ sourceHash: _omit, ...row }: CodeRecord): CodeRow => ({ ...row });

  return {
    async requestTimes(email, sourceHash, since) {
      const recent = codes.filter((c) => c.createdAt >= since);
      return {
        email: recent.filter((c) => c.email === email).map((c) => c.createdAt),
        source: recent.filter((c) => c.sourceHash === sourceHash).map((c) => c.createdAt),
      };
    },

    async issueCode({ email, codeHash, sourceHash, now, expiresAt }) {
      for (const c of codes) if (c.email === email && !c.usedAt && !c.supersededAt) c.supersededAt = now;
      const id = randomUUID();
      codes.push({ id, email, codeHash, sourceHash, createdAt: now, expiresAt, attempts: 0, usedAt: null, supersededAt: null });
      return id;
    },

    async discardCode(id) {
      codes = codes.filter((c) => c.id !== id);
    },

    async purgeCodesBefore(cutoff) {
      codes = codes.filter((c) => c.createdAt >= cutoff);
    },

    async latestCode(email) {
      const mine = codes.filter((c) => c.email === email);
      const newest = mine.reduce<CodeRecord | null>((best, c) => (!best || c.createdAt >= best.createdAt ? c : best), null);
      return newest ? toRow(newest) : null;
    },

    async takeAttempt(id, max) {
      const c = codes.find((x) => x.id === id);
      if (!c || c.usedAt || c.supersededAt || c.attempts >= max) return null;
      c.attempts += 1;
      return c.attempts;
    },

    async consumeCode(id, now) {
      const c = codes.find((x) => x.id === id);
      if (!c || c.usedAt) return false;
      c.usedAt = now;
      return true;
    },

    async signIn({ email, deviceId, tokenHash, now }) {
      let user = userByEmail(email);
      const created = !user;
      if (!user) {
        user = { id: randomUUID(), email };
        users.push(user);
      }
      for (const l of links) if (l.deviceId === deviceId && !l.unlinkedAt && l.userId !== user.id) l.unlinkedAt = now;
      if (!links.some((l) => l.deviceId === deviceId && !l.unlinkedAt && l.userId === user.id)) {
        links.push({ deviceId, userId: user.id, linkedAt: now, unlinkedAt: null });
      }
      sessions.push({ tokenHash, userId: user.id, deviceId, revokedAt: null });
      return { userId: user.id, created };
    },

    async sessionByToken(tokenHash): Promise<SessionInfo | null> {
      const s = sessions.find((x) => x.tokenHash === tokenHash && !x.revokedAt);
      const u = s && users.find((x) => x.id === s.userId);
      return s && u ? { userId: u.id, email: u.email, deviceId: s.deviceId } : null;
    },

    async signOut(tokenHash, now) {
      const s = sessions.find((x) => x.tokenHash === tokenHash && !x.revokedAt);
      if (!s) return;
      s.revokedAt = now;
      for (const l of links) if (l.deviceId === s.deviceId && l.userId === s.userId && !l.unlinkedAt) l.unlinkedAt = now;
    },

    async deleteUser(userId) {
      const u = users.find((x) => x.id === userId);
      if (u) codes = codes.filter((c) => c.email !== u.email);
      users = users.filter((x) => x.id !== userId);
      links = links.filter((l) => l.userId !== userId);
      sessions = sessions.filter((x) => x.userId !== userId);
    },

    async deleteUserByEmail(email) {
      const u = userByEmail(email);
      if (!u) return false;
      await this.deleteUser(u.id);
      return true;
    },

    async attributedEmail(deviceId, at) {
      const mine = links.filter((l) => l.deviceId === deviceId).sort((a, b) => a.linkedAt.getTime() - b.linkedAt.getTime());
      if (!mine.length) return null;
      const hit = at < mine[0].linkedAt ? mine[0] : mine.find((l) => l.linkedAt <= at && (!l.unlinkedAt || at < l.unlinkedAt));
      return (hit && users.find((u) => u.id === hit.userId)?.email) || null;
    },
  };
}
