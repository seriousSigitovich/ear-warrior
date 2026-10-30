// Regression: behind a transaction pooler (DB_PREPARE=false, production) postgres.js cannot serialise a Date
// parameter and the query throws ERR_INVALID_ARG_TYPE. Parameters must be primitives, cast in SQL.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadUsageReport, type SqlTag } from './usage.js';

test('loadUsageReport sends only primitive parameters', async () => {
  const seen: unknown[] = [];
  const fake: SqlTag = async (_strings, ...values) => {
    seen.push(...values);
    return [{ devices: 0, attempts: 0, attempts7d: 0, correct: 0, last_at: null }] as never;
  };
  await loadUsageReport(new Date('2026-10-25T12:00:00Z'), fake);
  assert.ok(seen.length > 0, 'the cutoff is a parameter');
  for (const v of seen) assert.ok(typeof v === 'string' || typeof v === 'number', `parameter ${String(v)} must not be a ${Object.prototype.toString.call(v)}`);
});

// Regression: `drizzle(sql)` installs text parsers for timestamp types on the shared client, so raw queries
// return timestamptz as strings. The report must still carry Dates (the page calls .toISOString()/.getTime()).
test('loadUsageReport turns the driver’s timestamp text into Dates', async () => {
  const fake: SqlTag = async (strings) =>
    (strings.join('').includes('from users u')
      ? [{ email: 'a@x.co', created_at: '2026-10-20 10:00:00+00', devices: 1, attempts: 2, attempts7d: 2, correct: 1, last_at: '2026-10-24 10:00:00.5+00' }]
      : [{ devices: 0, attempts: 0, attempts7d: 0, correct: 0, last_at: null }]) as never;
  const report = await loadUsageReport(new Date('2026-10-25T12:00:00Z'), fake);
  assert.equal(report.accounts[0].createdAt.toISOString(), '2026-10-20T10:00:00.000Z');
  assert.equal(report.accounts[0].lastAt?.toISOString(), '2026-10-24T10:00:00.500Z');
  assert.equal(report.anonymous.lastAt, null);
});
