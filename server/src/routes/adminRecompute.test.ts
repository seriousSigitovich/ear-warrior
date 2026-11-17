import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';
import { createMemoryChallengeStore } from '../challenges/memoryStore.js';
import { createMemoryLedgerStore } from '../progress/ledgerMemoryStore.js';
import { createMemoryProgressStore } from '../progress/memoryStore.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import { seedTunes } from '../tunes/seed.js';

const NOW = new Date('2026-11-16T10:00:00Z');
const AUTH = { authorization: `Basic ${Buffer.from('admin:pw').toString('base64')}` };
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'pw';
});
afterEach(() => {
  if (saved === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = saved;
});

async function make() {
  const tunes = createMemoryTuneStore();
  await seedTunes(tunes, NOW);
  const progress = createMemoryProgressStore();
  const ledger = createMemoryLedgerStore();
  await progress.addAttempt('u1', {
    id: 'a1', sessionId: 's', melodyId: 'hotcrossbuns-1', tuneId: 'hotcrossbuns', verdict: 'correct', confidence: 1, lowConfidence: false, timedOut: false, inputMode: 'fretboard',
    noteResults: Array.from({ length: 17 }, (_, i) => ({ targetIndex: i, status: 'matched' })), createdAt: new Date('2026-11-10T09:00:00Z'),
  });
  return { ledger, app: buildApp({ logger: false, tunes, progress, ledger, challengeStore: createMemoryChallengeStore(), now: () => NOW }) };
}

test('needs the admin login', async () => {
  const { app } = await make();
  assert.equal((await app.inject({ method: 'POST', url: '/admin/recompute' })).statusCode, 401);
});

test('by default a dry run: the report, nothing written', async () => {
  const { app, ledger } = await make();
  const res = await app.inject({ method: 'POST', url: '/admin/recompute', headers: AUTH });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().dryRun, true);
  assert.equal(res.json().rows[0].newXp, 40);
  assert.equal((await ledger.totals('u1')).totalXp, 0);
});

test('dry_run=0 writes, and running again changes nothing', async () => {
  const { app, ledger } = await make();
  const run = () => app.inject({ method: 'POST', url: '/admin/recompute?dry_run=0', headers: AUTH });
  assert.equal((await run()).json().dryRun, false);
  assert.equal((await ledger.totals('u1')).totalXp, 40);
  await run();
  assert.equal((await ledger.totals('u1')).totalXp, 40);
});
