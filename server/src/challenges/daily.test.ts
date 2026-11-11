// The day's challenges (spec 018): a pure function of the date.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_BONUS_XP, challengesFor, isValidDate } from './daily.js';

const day = (offset: number) => new Date(Date.UTC(2026, 10, 12 + offset)).toISOString().slice(0, 10);

test('three challenges: a warm-up in melodies, an accuracy goal, a larger volume goal', () => {
  const { date, challenges, allBonusXp } = challengesFor('2026-11-12');
  assert.equal(date, '2026-11-12');
  assert.equal(allBonusXp, ALL_BONUS_XP);
  assert.deepEqual(
    challenges.map((c) => c.type),
    ['melodies', 'accuracy', 'melodies'],
  );
  assert.equal(challenges.length, 3);
});

test('the same date always gives the same answer', () => {
  assert.deepEqual(challengesFor('2026-11-12'), challengesFor('2026-11-12'));
});

test('ids are unique within a day, and targets and rewards stay achievable on every day of a year', () => {
  for (let i = 0; i < 366; i++) {
    const { challenges } = challengesFor(day(i));
    assert.equal(new Set(challenges.map((c) => c.id)).size, 3, day(i));
    const [warm, quality, volume] = challenges;
    assert.ok(warm.target >= 2 && warm.target <= 3, `${day(i)} warm-up ${warm.target}`);
    assert.ok(quality.target >= 85 && quality.target <= 95, `${day(i)} accuracy ${quality.target}`);
    assert.ok(volume.target >= 4 && volume.target <= 6, `${day(i)} volume ${volume.target}`);
    assert.ok(volume.target > warm.target, 'the volume goal contains the warm-up');
    for (const c of challenges) {
      assert.ok(Number.isInteger(c.rewardXp) && c.rewardXp > 0, `${day(i)} ${c.id}`);
      assert.ok(c.title.length > 0 && c.description.length > 0);
    }
  }
});

test('the days differ: a month does not repeat one answer', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) seen.add(challengesFor(day(i)).challenges.map((c) => c.id).join('|'));
  assert.ok(seen.size >= 6, `only ${seen.size} distinct days in 30`);
});

test('a bigger goal pays more', () => {
  for (let i = 0; i < 60; i++) {
    const { challenges } = challengesFor(day(i));
    assert.ok(challenges[2].rewardXp > challenges[0].rewardXp, day(i));
  }
});

test('dates are valid calendar days only', () => {
  assert.equal(isValidDate('2026-11-12'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('2026-1-5'), false);
  assert.equal(isValidDate('tomorrow'), false);
  assert.equal(isValidDate(''), false);
});
