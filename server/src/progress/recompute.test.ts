import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import { seedTunes } from '../tunes/seed.js';
import type { TuneStore } from '../tunes/store.js';
import type { LedgerStore } from './ledger.js';
import { createMemoryLedgerStore } from './ledgerMemoryStore.js';
import { createMemoryProgressStore } from './memoryStore.js';
import { recomputeAll } from './recompute.js';
import type { ProgressStore } from './store.js';

const NOW = new Date('2026-11-16T10:00:00Z');
let tunes: TuneStore;
let ledger: LedgerStore;
let progress: ProgressStore;
let n = 0;

beforeEach(async () => {
  tunes = createMemoryTuneStore();
  await seedTunes(tunes, NOW);
  ledger = createMemoryLedgerStore();
  progress = createMemoryProgressStore();
});

/** An attempt at a whole tune with the given matched/wrong per note (hotcrossbuns: 17 notes, phrases 6 + 11). */
const attempt = (userId: string, statuses: string[], when: string, over: Record<string, unknown> = {}) =>
  progress.addAttempt(userId, {
    id: `a${++n}`,
    sessionId: 's',
    melodyId: 'hotcrossbuns-1',
    tuneId: 'hotcrossbuns',
    verdict: 'correct',
    confidence: 1,
    lowConfidence: false,
    timedOut: false,
    inputMode: 'fretboard',
    noteResults: statuses.map((status, i) => ({ targetIndex: i, status })),
    createdAt: new Date(when),
    ...over,
  });
const all = (status: string, count = 17) => new Array<string>(count).fill(status);
const run = (dryRun: boolean) => recomputeAll({ progress, tunes, ledger, dryRun, now: NOW });

test('an account\'s stored attempts become XP under the new rules, and the phrases count as passed', async () => {
  await attempt('u1', all('matched'), '2026-11-10T09:00:00Z');
  const report = await run(false);
  assert.equal(report.accounts, 1);
  assert.equal(report.rows[0].newXp, 40);
  assert.equal(report.rows[0].phrases, 2);
  assert.equal((await ledger.totals('u1')).totalXp, 40);
  assert.equal(await ledger.phrasePassed('u1', 'hotcrossbuns', 1), true);
});

test('only the first attempt that passed a phrase counts, a later better one does not add', async () => {
  await attempt('u1', [...all('wrong', 6), ...all('matched', 11)], '2026-11-10T09:00:00Z');
  await attempt('u1', all('matched'), '2026-11-11T09:00:00Z');
  const report = await run(false);
  assert.equal(report.rows[0].newXp, 40, 'phrase 1 from the first attempt, phrase 0 from the second');
});

test('mic attempts, timed-out attempts and attempts that cannot be split are ignored', async () => {
  await attempt('u1', all('matched'), '2026-11-10T09:00:00Z', { inputMode: 'mic' });
  await attempt('u1', all('matched'), '2026-11-10T10:00:00Z', { timedOut: true });
  await attempt('u1', all('matched'), '2026-11-10T11:00:00Z', { noteResults: [{ expected: 'E4', status: 'matched' }] });
  assert.equal((await run(false)).rows[0].newXp, 0);
});

test('running twice changes nothing', async () => {
  await attempt('u1', all('matched'), '2026-11-10T09:00:00Z');
  await run(false);
  const second = await run(false);
  assert.equal(second.rows[0].newXp, 40);
  assert.equal((await ledger.totals('u1')).totalXp, 40);
});

test('a dry run reports the same numbers and writes nothing', async () => {
  await attempt('u1', all('matched'), '2026-11-10T09:00:00Z');
  const report = await run(true);
  assert.equal(report.dryRun, true);
  assert.equal(report.rows[0].newXp, 40);
  assert.equal((await ledger.totals('u1')).totalXp, 0);
});

test('the report carries the old client XP, the new rank per account, and the rank counts', async () => {
  await attempt('u1', all('matched'), '2026-11-10T09:00:00Z');
  await attempt('u2', all('wrong'), '2026-11-10T09:00:00Z');
  await progress.putGameRows('u1', [{ kind: 'award', id: 'phrase:x:0', data: { id: 'phrase:x:0', kind: 'phrase', xp: 70, day: '2026-11-10', at: NOW.toISOString() } }]);
  const report = await run(true);
  const u1 = report.rows.find((r) => r.userId === 'u1')!;
  assert.equal(u1.oldXp, 70);
  assert.equal(u1.newRank, 'beginner');
  assert.deepEqual(report.byRank, { beginner: 2 });
});

test('an account without attempts is not touched', async () => {
  assert.equal((await run(false)).accounts, 0);
});
