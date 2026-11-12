// GET /api/challenges/today (spec 018), through Fastify's inject.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { createMemoryStore } from '../auth/memoryStore.js';
import { createRecordingMailer } from '../auth/mailer.js';
import { createMemoryProgressStore } from '../progress/memoryStore.js';
import { createMemoryChallengeStore } from '../challenges/memoryStore.js';

const NOW = new Date('2026-11-12T10:00:00Z');
const app = buildApp({
  auth: { store: createMemoryStore(), mailer: createRecordingMailer(), now: () => NOW, config: () => ({ pepper: 'p' }), randomCode: () => 1 },
  progress: createMemoryProgressStore(),
  challengeStore: createMemoryChallengeStore(),
  challenges: { now: () => NOW },
  logger: false,
});

const get = (date?: string) =>
  app.inject({ method: 'GET', url: `/api/challenges/today${date === undefined ? '' : `?date=${date}`}` });

test('answers with three challenges and the all-done bonus, without a login', async () => {
  const res = await get('2026-11-12');
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.date, '2026-11-12');
  assert.equal(body.all_bonus_xp, 25);
  assert.equal(body.challenges.length, 3);
  for (const c of body.challenges) {
    assert.deepEqual(Object.keys(c).sort(), ['description', 'id', 'reward_xp', 'target', 'title', 'type']);
  }
});

test('the days either side of today are accepted (every timezone), further ones are not', async () => {
  for (const d of ['2026-11-10', '2026-11-11', '2026-11-13', '2026-11-14']) assert.equal((await get(d)).statusCode, 200, d);
  for (const d of ['2026-11-09', '2026-11-15', '2020-01-01']) assert.equal((await get(d)).statusCode, 400, d);
});

test('a missing or malformed date is refused', async () => {
  for (const d of [undefined, '', 'today', '2026-02-30', '12-11-2026']) {
    const res = await get(d);
    assert.equal(res.statusCode, 400, String(d));
    assert.deepEqual(res.json(), { ok: false, error: 'invalid_date' });
  }
});
