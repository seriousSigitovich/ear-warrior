// Challenge progress from the phrases the server accepted (spec 024, FR-018).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PhraseRecord } from '../progress/ledger.js';
import type { DailyChallenge } from './daily.js';
import { evaluateChallenges } from './evaluate.js';

const defs: DailyChallenge[] = [
  { id: 'melodies-2', type: 'melodies', target: 2, rewardXp: 10, title: 'Two', description: 'Two melodies' },
  { id: 'accuracy-90', type: 'accuracy', target: 90, rewardXp: 20, title: '90', description: 'Reach 90%' },
  { id: 'melodies-3', type: 'melodies', target: 3, rewardXp: 15, title: 'Three', description: 'Three melodies' },
];
const phrasesOf = { a: 2, b: 1, c: 1, d: 2 } as Record<string, number>;
const rec = (tuneId: string, phrase: number, firstAccuracy: number, passedDay: string | null): PhraseRecord => ({ tuneId, phrase, firstAccuracy, passedDay });
const D = '2026-11-16';
const run = (records: PhraseRecord[], day = D) => evaluateChallenges(defs, records, phrasesOf, day);

test('a melody completes on the day its last phrase passes, with every phrase passed', () => {
  const states = run([rec('a', 0, 100, D), rec('a', 1, 100, D), rec('b', 0, 100, D)]);
  assert.deepEqual(states.map((s) => s.progress), [2, 1, 2]);
  assert.equal(states[0].completed, true);
  assert.equal(states[2].completed, false);
});

test('a melody with an open phrase does not count', () => {
  const states = run([rec('a', 0, 100, D), rec('a', 1, 40, null)]);
  assert.equal(states[0].progress, 0);
});

test('a melody finished today that began yesterday counts today, not yesterday', () => {
  const records = [rec('a', 0, 100, '2026-11-15'), rec('a', 1, 100, D)];
  assert.equal(run(records)[0].progress, 1);
  assert.equal(run(records, '2026-11-15')[0].progress, 0);
});

test('accuracy: the mean first-try accuracy of one completed melody reaches the target', () => {
  assert.equal(run([rec('a', 0, 100, D), rec('a', 1, 80, D)])[1].completed, true, 'mean 90');
  assert.equal(run([rec('a', 0, 100, D), rec('a', 1, 70, D)])[1].completed, false, 'mean 85');
  assert.equal(run([rec('b', 0, 95, D)])[1].completed, true);
});

test('records of other days do not count', () => {
  assert.deepEqual(run([rec('b', 0, 100, '2026-11-10'), rec('c', 0, 100, '2026-11-11')]).map((s) => s.progress), [0, 0, 0]);
});

test('progress stops at the target; a tune the library no longer has is ignored', () => {
  const records = [rec('b', 0, 100, D), rec('c', 0, 100, D), rec('a', 0, 100, D), rec('a', 1, 100, D), rec('gone', 0, 100, D)];
  const states = run(records);
  assert.equal(states[0].progress, 2);
  assert.equal(states[2].progress, 3);
  assert.equal(states[2].completed, true);
});

test('the state carries what the app shows', () => {
  assert.deepEqual(run([])[0], { id: 'melodies-2', title: 'Two', description: 'Two melodies', progress: 0, target: 2, reward_xp: 10, completed: false });
  assert.equal(run([])[1].target, 1);
});
