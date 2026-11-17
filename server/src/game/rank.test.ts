import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RANKS } from './config.js';
import { rankOf, rankUp } from './rank.js';

test('the rank is the highest whose threshold is met, at the exact edges', () => {
  for (const [i, r] of RANKS.entries()) {
    assert.equal(rankOf(r.xp).index, i, `${r.name} at ${r.xp}`);
    if (r.xp > 0) assert.equal(rankOf(r.xp - 1).index, i - 1, `${r.name} at ${r.xp - 1}`);
  }
});

test('XP alone sets it: no other input exists', () => {
  assert.equal(rankOf(0).name, 'Beginner');
  assert.equal(rankOf(99999).name, 'Mozart');
});

test('xp_to_next and pct', () => {
  const r = rankOf(275); // Apprentice 100 → Listener 450
  assert.equal(r.name, 'Apprentice');
  assert.equal(r.next?.name, 'Listener');
  assert.equal(r.xp_to_next, 175);
  assert.equal(r.pct, 50);
});

test('at the top there is no next rank', () => {
  const r = rankOf(RANKS[RANKS.length - 1].xp + 10);
  assert.equal(r.next, null);
  assert.equal(r.xp_to_next, 0);
  assert.equal(r.pct, 100);
});

test('rankUp names the new rank only when the rank rose', () => {
  assert.equal(rankUp(90, 110)?.name, 'Apprentice');
  assert.equal(rankUp(110, 120), null);
  assert.equal(rankUp(0, 2500)?.name, 'Musician'); // jumps over ranks: names the one reached
  assert.equal(rankUp(500, 400), null);
});

test('negative or fractional XP is treated as the nearest valid total', () => {
  assert.equal(rankOf(-5).index, 0);
  assert.equal(rankOf(99.9).index, 0);
});
