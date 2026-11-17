// Behaviour every LedgerStore must have. Run against memory (always) and Postgres (when reachable).
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { payout } from '../game/xp.js';
import type { CheckContext, CheckInput, LedgerStore } from './ledger.js';

const T0 = new Date('2026-11-16T10:00:00Z');
let n = 0;
const input = (userId: string, over: Partial<CheckInput> = {}): CheckInput => ({
  userId,
  checkId: `c${++n}`,
  tuneId: 'mary',
  phrase: 0,
  played: [64, 62, 60],
  noteResults: [],
  accuracy: 100,
  passed: true,
  localDay: '2026-11-16',
  checkedAt: T0,
  now: T0,
  ...over,
});
/** The real payout rules, at the given tune level. */
const rules = (accuracy: number, level = 1) => (ctx: CheckContext) =>
  payout({ accuracy, level, attemptNo: ctx.attemptNo, hint: ctx.hint, answerShown: ctx.answerShown, baseUsedToday: ctx.baseUsedToday });

export function runLedgerContract(
  name: string,
  make: () => Promise<{ store: LedgerStore; newUser: () => Promise<string> }>,
  opts: { skip?: string } = {},
): void {
  describe(`LedgerStore contract: ${name}`, { skip: opts.skip }, () => {
    let s: LedgerStore;
    let user: () => Promise<string>;
    beforeEach(async () => {
      ({ store: s, newUser: user } = await make());
    });

    const check = (u: string, over: Partial<CheckInput> = {}, level = 1) => {
      const i = input(u, over);
      return s.recordCheck(i, rules(i.accuracy, level));
    };

    test('the first passing check pays: a ledger row, the total, the day, and the cap use', async () => {
      const u = await user();
      const r = await check(u);
      assert.equal(r.replay, false);
      assert.equal(r.check.xp, 20);
      assert.equal(r.check.attemptNo, 1);
      assert.equal(r.check.payout.reason, null);
      assert.deepEqual(await s.totals(u), { totalXp: 20, days: ['2026-11-16'] });
      assert.deepEqual(await s.ledgerKeys(u, 'phrase:'), ['phrase:mary:0']);
      assert.equal(await s.baseUsed(u, '2026-11-16'), 20);
      assert.equal(await s.phrasePassed(u, 'mary', 0), true);
    });

    test('resending a check id changes nothing and returns the stored check', async () => {
      const u = await user();
      const first = await check(u, { checkId: 'same' });
      const again = await s.recordCheck(input(u, { checkId: 'same', accuracy: 50, passed: false }), rules(50));
      assert.equal(again.replay, true);
      assert.deepEqual(again.check, first.check);
      assert.equal((await s.totals(u)).totalXp, 20);
      assert.deepEqual((await s.getCheck(u, 'same'))?.payout, first.check.payout);
      assert.equal(await s.getCheck(u, 'nope'), null);
    });

    test('a failing check pays nothing and leaves the phrase open; attempts are counted', async () => {
      const u = await user();
      const fail = await check(u, { accuracy: 50, passed: false });
      assert.equal(fail.check.xp, 0);
      assert.equal(fail.check.passed, false);
      assert.equal(fail.check.payout.reason, 'below_pass');
      assert.equal(await s.phrasePassed(u, 'mary', 0), false);
      assert.deepEqual(await s.ledgerKeys(u, 'phrase:'), []);
      const second = await check(u);
      assert.equal(second.check.attemptNo, 2);
      assert.equal(second.check.xp, 10, 'the second attempt pays half');
    });

    test('the third attempt passes the phrase for 0 XP and closes it', async () => {
      const u = await user();
      await check(u, { accuracy: 10, passed: false });
      await check(u, { accuracy: 10, passed: false });
      const third = await check(u);
      assert.equal(third.check.attemptNo, 3);
      assert.equal(third.check.xp, 0);
      assert.equal(third.check.passed, true);
      assert.equal(third.check.payout.reason, 'attempts');
      assert.deepEqual(await s.ledgerKeys(u, 'phrase:'), ['phrase:mary:0']);
      assert.equal(await s.phrasePassed(u, 'mary', 0), true);
    });

    test('once passed, further checks pay nothing and compute is not called', async () => {
      const u = await user();
      await check(u);
      let called = false;
      const r = await s.recordCheck(input(u), (ctx) => {
        called = true;
        return rules(100)(ctx);
      });
      assert.equal(called, false);
      assert.equal(r.check.xp, 0);
      assert.equal(r.check.payout.reason, 'already_paid');
      assert.equal(r.check.attemptNo, 2);
      assert.equal((await s.totals(u)).totalXp, 20);
      assert.equal(await s.baseUsed(u, '2026-11-16'), 20);
    });

    test('a hint or the shown answer before the passing check is applied to it', async () => {
      const u = await user();
      await s.recordEvent(u, 'mary', 0, 'hint', T0);
      assert.equal((await check(u)).check.xp, 10);
      await s.recordEvent(u, 'mary', 1, 'answer', T0);
      const shown = await check(u, { phrase: 1 });
      assert.equal(shown.check.xp, 0);
      assert.equal(shown.check.payout.reason, 'answer_shown');
      assert.equal(shown.check.passed, true);
    });

    test('events are per phrase and a no-op after the phrase passed', async () => {
      const u = await user();
      assert.deepEqual(await s.recordEvent(u, 'mary', 0, 'hint', T0), { passed: false });
      assert.deepEqual(await s.recordEvent(u, 'mary', 0, 'hint', T0), { passed: false }, 'recording twice is harmless');
      assert.equal((await check(u, { phrase: 2 })).check.xp, 20, 'another phrase is unaffected');
      await check(u);
      assert.deepEqual(await s.recordEvent(u, 'mary', 0, 'answer', T0), { passed: true });
      assert.equal((await check(u)).check.payout.reason, 'already_paid');
    });

    test('the cap counter adds up per day and is separate between days', async () => {
      const u = await user();
      await check(u, { phrase: 0 });
      await check(u, { phrase: 1 });
      assert.equal(await s.baseUsed(u, '2026-11-16'), 40);
      assert.equal(await s.baseUsed(u, '2026-11-17'), 0);
      const nextDay = await check(u, { phrase: 2, localDay: '2026-11-17' });
      assert.equal(nextDay.check.xp, 20);
      assert.equal(await s.baseUsed(u, '2026-11-17'), 20);
    });

    test('the context carries the day\'s cap use into the payout', async () => {
      const u = await user();
      let seen = -1;
      await s.recordCheck(input(u, { phrase: 0 }), (ctx) => {
        seen = ctx.baseUsedToday;
        return rules(100)(ctx);
      });
      assert.equal(seen, 0);
      await s.recordCheck(input(u, { phrase: 1 }), (ctx) => {
        seen = ctx.baseUsedToday;
        return rules(100)(ctx);
      });
      assert.equal(seen, 20);
    });

    test('two simultaneous passing checks of one phrase pay once', async () => {
      const u = await user();
      const rs = await Promise.all([check(u), check(u), check(u)]);
      assert.equal(rs.filter((r) => r.check.xp > 0).length, 1);
      assert.equal((await s.totals(u)).totalXp, 20);
      assert.deepEqual(await s.ledgerKeys(u, 'phrase:'), ['phrase:mary:0']);
      assert.equal(await s.baseUsed(u, '2026-11-16'), 20);
      assert.deepEqual(rs.map((r) => r.check.attemptNo).sort(), [1, 2, 3]);
    });

    test('two simultaneous sends of one check id store it once', async () => {
      const u = await user();
      const i = input(u, { checkId: 'dup' });
      const rs = await Promise.all([s.recordCheck(i, rules(100)), s.recordCheck(i, rules(100))]);
      assert.deepEqual(rs.map((r) => r.replay).sort(), [false, true]);
      assert.equal((await s.totals(u)).totalXp, 20);
    });

    test('phrase records: first-try accuracy, and the day it passed', async () => {
      const u = await user();
      await check(u, { phrase: 0, accuracy: 60, passed: false, localDay: '2026-11-15' });
      await check(u, { phrase: 0, accuracy: 100, localDay: '2026-11-16' });
      await check(u, { phrase: 1, accuracy: 50, passed: false });
      const rec = await s.phraseRecords(u);
      assert.deepEqual(
        rec.sort((a, b) => a.phrase - b.phrase),
        [
          { tuneId: 'mary', phrase: 0, firstAccuracy: 60, passedDay: '2026-11-16' },
          { tuneId: 'mary', phrase: 1, firstAccuracy: 50, passedDay: null },
        ],
      );
    });

    test('other ledger rows: added once, counted in the total, found by prefix', async () => {
      const u = await user();
      const row = { key: 'challenge:2026-11-16:melodies-3', kind: 'challenge' as const, xp: 15, breakdown: {}, localDay: '2026-11-16', at: T0 };
      assert.equal(await s.addLedger(u, row), true);
      assert.equal(await s.addLedger(u, row), false);
      await s.addLedger(u, { ...row, key: 'daily-all:2026-11-16', kind: 'daily-all', xp: 25 });
      assert.equal((await s.totals(u)).totalXp, 40);
      assert.deepEqual(await s.ledgerKeys(u, 'challenge:'), ['challenge:2026-11-16:melodies-3']);
    });

    test('the days with any ledger row are listed once each, oldest first', async () => {
      const u = await user();
      await check(u, { phrase: 0, localDay: '2026-11-17' });
      await check(u, { phrase: 1, localDay: '2026-11-15' });
      await check(u, { phrase: 2, localDay: '2026-11-17' });
      assert.deepEqual((await s.totals(u)).days, ['2026-11-15', '2026-11-17']);
    });

    test('accounts are separate, and may reuse the same check id', async () => {
      const a = await user();
      const b = await user();
      await check(a, { checkId: 'shared' });
      const r = await check(b, { checkId: 'shared' });
      assert.equal(r.replay, false);
      assert.equal((await s.totals(a)).totalXp, 20);
      assert.equal((await s.totals(b)).totalXp, 20);
      assert.equal((await s.totals(await user())).totalXp, 0);
    });

    test('a level-9 phrase pays 15 times a level-1 phrase', async () => {
      const u = await user();
      assert.equal((await check(u, { tuneId: 'hard' }, 9)).check.xp, 300);
      assert.equal((await check(u, { tuneId: 'easy' }, 1)).check.xp, 20);
    });

    test('merge: the union of two accounts, a phrase both paid counts once, cap use adds up, the source is left empty', async () => {
      const anon = await user();
      const real = await user();
      await check(anon, { phrase: 0 }); // paid on both → kept once
      await check(anon, { phrase: 1 }); // only the anonymous one has it
      await check(real, { phrase: 0 });
      await check(real, { phrase: 2 });
      await s.recordEvent(anon, 'mary', 3, 'hint', T0);
      await s.addLedger(anon, { key: 'challenge:2026-11-16:x', kind: 'challenge', xp: 15, breakdown: {}, localDay: '2026-11-16', at: T0 });

      await s.merge(anon, real);

      assert.deepEqual(await s.ledgerKeys(real, 'phrase:'), ['phrase:mary:0', 'phrase:mary:1', 'phrase:mary:2']);
      assert.equal((await s.totals(real)).totalXp, 20 * 3 + 15);
      assert.equal(await s.baseUsed(real, '2026-11-16'), 20 + 20 + 20 + 20, 'cap use of both accounts, summed');
      assert.equal((await check(real, { phrase: 3 })).check.xp, 10, 'the merged hint applies to the next pass');
      assert.deepEqual(await s.totals(anon), { totalXp: 0, days: [] });
      assert.deepEqual(await s.phraseRecords(anon), []);
      assert.equal(await s.phrasePassed(real, 'mary', 1), true);
    });

    test('merge: the same check id on both sides is stored once, and merging an account into itself changes nothing', async () => {
      const a = await user();
      const b = await user();
      await check(a, { checkId: 'same', phrase: 0 });
      await check(b, { checkId: 'same', phrase: 5 });
      await s.merge(a, b);
      assert.equal((await s.getCheck(b, 'same'))?.phrase, 5, 'the target keeps its own check');
      await s.merge(b, b);
      assert.equal((await s.totals(b)).totalXp, 40);
    });
  });
}
