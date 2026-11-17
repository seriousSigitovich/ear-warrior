import assert from 'node:assert/strict';
import { test } from 'node:test';
import { streakDays } from './streak.js';

test('counts consecutive days ending today', () => {
  assert.equal(streakDays(['2026-11-14', '2026-11-15', '2026-11-16'], '2026-11-16'), 3);
});
test('a streak that ended yesterday is still alive', () => {
  assert.equal(streakDays(['2026-11-14', '2026-11-15'], '2026-11-16'), 2);
});
test('a gap of a day ends it', () => {
  assert.equal(streakDays(['2026-11-13', '2026-11-14'], '2026-11-16'), 0);
  assert.equal(streakDays(['2026-11-12', '2026-11-14', '2026-11-16'], '2026-11-16'), 1);
});
test('no days, no streak; month and year borders count', () => {
  assert.equal(streakDays([], '2026-11-16'), 0);
  assert.equal(streakDays(['2026-12-30', '2026-12-31', '2027-01-01'], '2027-01-01'), 3);
});
