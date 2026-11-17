import assert from 'node:assert/strict';
import { test } from 'node:test';
import { payout, phraseBase, type PayoutInput } from './xp.js';

const clean: PayoutInput = { accuracy: 100, level: 1, attemptNo: 1, hint: false, answerShown: false, baseUsedToday: 0 };
const xp = (over: Partial<PayoutInput> = {}) => payout({ ...clean, ...over });

test('base: 10 from the pass mark, 15 from 90 %, 20 at 100 %', () => {
  assert.deepEqual([80, 89, 90, 99, 100].map(phraseBase), [10, 10, 15, 15, 20]);
  assert.equal(xp({ accuracy: 80 }).xp, 10);
  assert.equal(xp({ accuracy: 95 }).xp, 15);
  assert.equal(xp({ accuracy: 100 }).xp, 20);
});

test('below the pass mark pays nothing and the phrase stays open', () => {
  const p = xp({ accuracy: 79 });
  assert.equal(p.xp, 0);
  assert.equal(p.passed, false);
  assert.equal(p.reason, 'below_pass');
  assert.equal(p.capBase, 0);
});

test('the level multiplier is applied: level 9 pays 15 times level 1', () => {
  assert.equal(xp({ level: 1 }).xp, 20);
  assert.equal(xp({ level: 9 }).xp, 300);
  assert.equal(xp({ level: 5 }).xp, 80);
  assert.equal(xp({ level: 2 }).xp, 30);
});

test('attempts: the first pays in full, the second half, the third and later nothing — and still passes', () => {
  assert.equal(xp({ attemptNo: 1 }).xp, 20);
  assert.equal(xp({ attemptNo: 2 }).xp, 10);
  const third = xp({ attemptNo: 3 });
  assert.equal(third.xp, 0);
  assert.equal(third.passed, true);
  assert.equal(third.reason, 'attempts');
  assert.equal(xp({ attemptNo: 7 }).xp, 0);
});

test('hints: the first-note hint halves, the shown answer pays 0 but passes', () => {
  assert.equal(xp({ hint: true }).xp, 10);
  const shown = xp({ answerShown: true });
  assert.equal(shown.xp, 0);
  assert.equal(shown.passed, true);
  assert.equal(shown.reason, 'answer_shown');
  assert.equal(xp({ answerShown: true, hint: true }).xp, 0);
});

test('attempt and hint factors multiply', () => {
  assert.equal(xp({ attemptNo: 2, hint: true }).xp, 5);
  assert.equal(xp({ attemptNo: 2, hint: true, level: 9 }).xp, 75);
});

test('daily cap: under the cap in full, the part over it at half, counted before the level multiplier', () => {
  assert.equal(xp({ baseUsedToday: 280 }).xp, 20); // 280 + 20 = 300, exactly the cap
  assert.equal(xp({ baseUsedToday: 290 }).xp, 15); // 10 in full + 10 at half
  assert.equal(xp({ baseUsedToday: 300 }).xp, 10);
  assert.equal(xp({ baseUsedToday: 900 }).xp, 10);
  // The cap does not depend on the level: a level-9 phrase over the cap is halved the same way.
  assert.equal(xp({ level: 9, baseUsedToday: 300 }).xp, 150);
  assert.equal(xp({ level: 9, baseUsedToday: 0 }).xp, 300);
});

test('capBase is what the phrase adds to the day: the practised base, not the multiplied XP', () => {
  assert.equal(xp({ level: 9 }).capBase, 20);
  assert.equal(xp({ attemptNo: 2 }).capBase, 10);
  assert.equal(xp({ hint: true, attemptNo: 2 }).capBase, 5);
  assert.equal(xp({ attemptNo: 3 }).capBase, 0);
});

test('the breakdown reports every factor', () => {
  const p = xp({ level: 4, attemptNo: 2, hint: true, baseUsedToday: 298 });
  assert.equal(p.base, 20);
  assert.equal(p.level_mult, 3);
  assert.equal(p.attempt_factor, 0.5);
  assert.equal(p.hint_factor, 0.5);
  assert.ok(p.cap_factor < 1 && p.cap_factor > 0.5);
});

test('XP is never negative or fractional', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    for (const attemptNo of [1, 2, 3]) {
      for (const baseUsedToday of [0, 295, 1000]) {
        const p = xp({ level, attemptNo, baseUsedToday, hint: true });
        assert.ok(Number.isInteger(p.xp) && p.xp >= 0);
      }
    }
  }
});
