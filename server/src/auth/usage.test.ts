// SQL aggregation of /admin/users against a real Postgres (local only, like pgStore.test.ts).
// Skipped, not failed, when no database is reachable.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { sql } from '../db/client.js';
import { applyDdl } from '../db/ddl.js';
import { loadUsageReport } from './usage.js';

const url = process.env.DATABASE_URL ?? 'postgres://localhost';
let skip: string | undefined = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || !url.includes('@') ? undefined : 'DATABASE_URL is not local';
if (!skip) {
  try {
    await applyDdl(sql);
  } catch (err) {
    skip = `no Postgres reachable (${(err as Error).message.slice(0, 60)})`;
  }
}

const attempt = (device: string, at: string, verdict: 'correct' | 'incorrect') =>
  sql`insert into attempt_log (device_id, app_version, created_at, difficulty_id, difficulty_rank, note_count, verdict, matched_count, wrong_count, missed_count, extra_count, confidence)
      values (${device}, '1.0.0', ${at}, 'd1', 1, 3, ${verdict}, 0, 0, 0, 0, 1)`;

before(async () => {
  if (skip) return;
  await sql.unsafe('truncate users, device_links, attempt_log restart identity cascade');
});

test('counts attempts per account by the link in force, and the rest as anonymous', { skip }, async () => {
  const [{ id }] = await sql`insert into users (email) values ('a@x.co') returning id`;
  await sql`insert into users (email) values ('idle@x.co')`;
  await sql`insert into device_links (device_id, user_id, linked_at, unlinked_at) values ('dev_a', ${id}, '2026-10-10T00:00:00Z', '2026-10-12T00:00:00Z')`;
  await attempt('dev_a', '2026-10-09T00:00:00Z', 'correct'); // before the first link -> the account
  await attempt('dev_a', '2026-10-11T00:00:00Z', 'incorrect'); // during
  await attempt('dev_a', '2026-10-13T00:00:00Z', 'correct'); // after sign-out -> anonymous
  await attempt('dev_b', '2026-10-13T00:00:00Z', 'correct'); // never linked -> anonymous

  const report = await loadUsageReport(new Date('2026-10-14T00:00:00Z'));
  const a = report.accounts.find((r) => r.email === 'a@x.co')!;
  assert.deepEqual([a.devices, a.attempts, a.correct], [1, 2, 1]);
  assert.equal(a.lastAt?.toISOString(), '2026-10-11T00:00:00.000Z');
  const idle = report.accounts.find((r) => r.email === 'idle@x.co')!;
  assert.deepEqual([idle.attempts, idle.devices, idle.lastAt], [0, 0, null]);
  assert.deepEqual([report.anonymous.devices, report.anonymous.attempts], [2, 2]);
});

after(() => sql.end({ timeout: 2 }));
