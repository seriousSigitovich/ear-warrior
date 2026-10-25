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
