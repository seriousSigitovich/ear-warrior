// The challenge store against a real Postgres (DATABASE_URL, default: the docker-compose one). Skipped, not
// failed, when no local database is reachable, so `npm test` stays green on a bare machine.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { db, sql } from '../db/client.js';
import { applyDdl } from '../db/ddl.js';
import { createPgChallengeStore } from './pgStore.js';
import type { DailyChallenges } from './daily.js';

const url = process.env.DATABASE_URL ?? 'postgres://localhost';
let skip: string | undefined = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || !url.includes('@') ? undefined : 'DATABASE_URL is not local';
if (!skip) {
  try {
    await applyDdl(sql);
  } catch (err) {
    skip = `no Postgres reachable (${(err as Error).message.slice(0, 60)})`;
  }
}

const day = (date: string, bonus: number): DailyChallenges => ({
  date,
  allBonusXp: bonus,
  challenges: [{ id: 'melodies-3', type: 'melodies', target: 3, rewardXp: 15, title: 'Three', description: 'Play three' }],
});

test('set, get, overwrite, list a range and remove', { skip }, async () => {
  await sql.unsafe('truncate daily_challenge_overrides');
  const store = createPgChallengeStore(db);
  assert.equal(await store.get('2026-11-13'), null);
  await store.set(day('2026-11-15', 5));
  await store.set(day('2026-11-13', 10));
  await store.set(day('2026-12-30', 1));
  assert.deepEqual(await store.get('2026-11-13'), day('2026-11-13', 10));
  await store.set(day('2026-11-13', 99));
  assert.equal((await store.get('2026-11-13'))?.allBonusXp, 99);
  assert.deepEqual((await store.list('2026-11-12', '2026-11-30')).map((d) => d.date), ['2026-11-13', '2026-11-15']);
  await store.remove('2026-11-13');
  assert.equal(await store.get('2026-11-13'), null);
});

after(() => sql.end({ timeout: 2 }));
