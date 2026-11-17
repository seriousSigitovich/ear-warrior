// In-memory LedgerStore (tests and local runs without Postgres). Every method that writes runs without an `await`
// between its read and its write, so it is atomic on the event loop — the Postgres store gets the same from a lock.
import { alreadyPaid } from '../game/xp.js';
import type { CheckContext, LedgerRow, LedgerStore, PhraseRecord, StoredCheck } from './ledger.js';

interface UserData {
  checks: StoredCheck[];
  events: Set<string>;
  ledger: Map<string, LedgerRow>;
  baseUsed: Map<string, number>;
}

export function createMemoryLedgerStore(): LedgerStore {
  const users = new Map<string, UserData>();
  const of = (id: string): UserData => {
    let u = users.get(id);
    if (!u) users.set(id, (u = { checks: [], events: new Set(), ledger: new Map(), baseUsed: new Map() }));
    return u;
  };
  const eventKey = (tune: string, phrase: number, kind: string) => `${tune}:${phrase}:${kind}`;
  const sameCheck = (c: StoredCheck, tune: string, phrase: number) => c.tuneId === tune && c.phrase === phrase;

  return {
    async getCheck(userId, checkId) {
      return of(userId).checks.find((c) => c.checkId === checkId) ?? null;
    },

    async recordCheck(input, compute) {
      const u = of(input.userId);
      const existing = u.checks.find((c) => c.checkId === input.checkId);
      if (existing) return { check: existing, replay: true };

      const earlier = u.checks.filter((c) => sameCheck(c, input.tuneId, input.phrase));
      const ctx: CheckContext = {
        attemptNo: earlier.length + 1,
        hint: u.events.has(eventKey(input.tuneId, input.phrase, 'hint')),
        answerShown: u.events.has(eventKey(input.tuneId, input.phrase, 'answer')),
        alreadyPassed: earlier.some((c) => c.passed),
        baseUsedToday: u.baseUsed.get(input.localDay) ?? 0,
      };
      const pay = ctx.alreadyPassed ? alreadyPaid(ctx.attemptNo) : compute(ctx);
      const check: StoredCheck = {
        checkId: input.checkId,
        tuneId: input.tuneId,
        phrase: input.phrase,
        attemptNo: ctx.attemptNo,
        played: [...input.played],
        noteResults: input.noteResults,
        accuracy: input.accuracy,
        passed: input.passed,
        xp: pay.xp,
        payout: pay,
        localDay: input.localDay,
      };
      u.checks.push(check);
      if (!ctx.alreadyPassed && input.passed) {
        u.ledger.set(`phrase:${input.tuneId}:${input.phrase}`, {
          key: `phrase:${input.tuneId}:${input.phrase}`,
          kind: 'phrase',
          xp: pay.xp,
          breakdown: { ...pay },
          localDay: input.localDay,
          at: input.checkedAt,
        });
        u.baseUsed.set(input.localDay, (u.baseUsed.get(input.localDay) ?? 0) + pay.capBase);
      }
      return { check, replay: false };
    },

    async recordEvent(userId, tuneId, phrase, kind) {
      const u = of(userId);
      const passed = u.checks.some((c) => sameCheck(c, tuneId, phrase) && c.passed);
      if (!passed) u.events.add(eventKey(tuneId, phrase, kind));
      return { passed };
    },

    async phrasePassed(userId, tuneId, phrase) {
      return of(userId).checks.some((c) => sameCheck(c, tuneId, phrase) && c.passed);
    },

    async totals(userId) {
      const rows = [...of(userId).ledger.values()];
      return {
        totalXp: rows.reduce((sum, r) => sum + r.xp, 0),
        days: [...new Set(rows.map((r) => r.localDay))].sort(),
      };
    },

    async phraseRecords(userId) {
      const byPhrase = new Map<string, PhraseRecord>();
      for (const c of of(userId).checks) {
        const key = `${c.tuneId}:${c.phrase}`;
        const rec = byPhrase.get(key) ?? { tuneId: c.tuneId, phrase: c.phrase, firstAccuracy: c.accuracy, passedDay: null };
        if (c.passed && rec.passedDay === null) rec.passedDay = c.localDay;
        byPhrase.set(key, rec);
      }
      return [...byPhrase.values()];
    },

    async addLedger(userId, row) {
      const u = of(userId);
      if (u.ledger.has(row.key)) return false;
      u.ledger.set(row.key, row);
      return true;
    },

    async ledgerKeys(userId, prefix) {
      return [...of(userId).ledger.keys()].filter((k) => k.startsWith(prefix)).sort();
    },

    async baseUsed(userId, day) {
      return of(userId).baseUsed.get(day) ?? 0;
    },

    async merge(fromUserId, toUserId) {
      if (fromUserId === toUserId) return;
      const from = of(fromUserId);
      const to = of(toUserId);
      for (const c of from.checks) if (!to.checks.some((x) => x.checkId === c.checkId)) to.checks.push(c);
      for (const e of from.events) to.events.add(e);
      for (const [key, row] of from.ledger) if (!to.ledger.has(key)) to.ledger.set(key, row);
      for (const [day, base] of from.baseUsed) to.baseUsed.set(day, (to.baseUsed.get(day) ?? 0) + base);
      users.delete(fromUserId);
    },
  };
}
