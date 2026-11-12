// Validation of an owner-typed day and the editable window (spec 020). The limits mirror the app's own checks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryChallengeStore } from './memoryStore.js';
import { addDays, isEditable, parseDay, type DayInput } from './override.js';

const slot = (over: Record<string, unknown> = {}) => ({ type: 'melodies', target: '3', rewardXp: '15', title: 'Three melodies', description: 'Play three', ...over });
const day = (over: Partial<DayInput> = {}): DayInput => ({
  challenges: [slot(), slot({ type: 'accuracy', target: '90', rewardXp: '20' }), slot({ target: '5', rewardXp: '35' })],
  allBonusXp: '25',
  ...over,
});

test('a valid day becomes three challenges with ids from type and target', () => {
  const r = parseDay('2026-11-20', day());
  assert.ok(r.ok);
  assert.deepEqual(r.day.challenges.map((c) => c.id), ['melodies-3', 'accuracy-90', 'melodies-5']);
  assert.equal(r.day.allBonusXp, 25);
  assert.equal(r.day.challenges[1].rewardXp, 20);
});

test('the same type and target twice still gets unique ids', () => {
  const r = parseDay('2026-11-20', day({ challenges: [slot(), slot(), slot({ type: 'accuracy', target: '90' })] }));
  assert.ok(r.ok);
  assert.equal(new Set(r.day.challenges.map((c) => c.id)).size, 3);
});

test('text is trimmed and numbers may be real numbers', () => {
  const r = parseDay('2026-11-20', day({ challenges: [slot({ title: '  Hi  ', target: 4 }), slot(), slot()], allBonusXp: 0 }));
  assert.ok(r.ok);
  assert.equal(r.day.challenges[0].title, 'Hi');
  assert.equal(r.day.challenges[0].target, 4);
  assert.equal(r.day.allBonusXp, 0);
});

test('anything the app would drop is refused, with a reason per field', () => {
  const bad: [string, DayInput][] = [
    ['type', day({ challenges: [slot({ type: 'speed' }), slot(), slot()] })],
    ['melodies target 0', day({ challenges: [slot({ target: '0' }), slot(), slot()] })],
    ['melodies target 21', day({ challenges: [slot({ target: '21' }), slot(), slot()] })],
    ['accuracy 49', day({ challenges: [slot({ type: 'accuracy', target: '49' }), slot(), slot()] })],
    ['accuracy 101', day({ challenges: [slot({ type: 'accuracy', target: '101' }), slot(), slot()] })],
    ['xp 501', day({ challenges: [slot({ rewardXp: '501' }), slot(), slot()] })],
    ['xp text', day({ challenges: [slot({ rewardXp: 'ten' }), slot(), slot()] })],
    ['empty title', day({ challenges: [slot({ title: '   ' }), slot(), slot()] })],
    ['long title', day({ challenges: [slot({ title: 'x'.repeat(81) }), slot(), slot()] })],
    ['long description', day({ challenges: [slot({ description: 'x'.repeat(121) }), slot(), slot()] })],
    ['fractional target', day({ challenges: [slot({ target: '3.5' }), slot(), slot()] })],
    ['bonus 501', day({ allBonusXp: '501' })],
    ['bonus empty', day({ allBonusXp: '' })],
    ['two challenges', day({ challenges: [slot(), slot()] })],
    ['four challenges', day({ challenges: [slot(), slot(), slot(), slot()] })],
  ];
  for (const [name, input] of bad) {
    const r = parseDay('2026-11-20', input);
    assert.equal(r.ok, false, name);
    if (!r.ok) assert.ok(r.errors.length > 0, name);
  }
});

test('edits start tomorrow (UTC) and stop 90 days ahead', () => {
  const now = new Date('2026-11-12T23:30:00Z');
  assert.equal(isEditable('2026-11-11', now), false);
  assert.equal(isEditable('2026-11-12', now), false);
  assert.equal(isEditable('2026-11-13', now), true);
  assert.equal(isEditable(addDays('2026-11-12', 90), now), true);
  assert.equal(isEditable(addDays('2026-11-12', 91), now), false);
});

test('the in-memory store lists a range oldest first and removes', async () => {
  const store = createMemoryChallengeStore();
  const mk = (date: string) => ({ date, challenges: [], allBonusXp: 1 });
  await store.set(mk('2026-11-15'));
  await store.set(mk('2026-11-13'));
  await store.set(mk('2026-12-01'));
  assert.deepEqual((await store.list('2026-11-12', '2026-11-30')).map((d) => d.date), ['2026-11-13', '2026-11-15']);
  await store.remove('2026-11-13');
  assert.equal(await store.get('2026-11-13'), null);
});
