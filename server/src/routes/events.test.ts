// Payload contract of POST /api/events. The insert itself is a one-line Drizzle call, so the schema is what is tested.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventBody } from './events.js';

const base = { device_id: 'dev_abc', app_version: '0.1.0', name: 'app_open', occurred_at: '2026-10-27T10:00:00.000Z' };

test('accepts a bare event and defaults props to empty', () => {
  const r = EventBody.safeParse(base);
  assert.equal(r.success, true);
  if (r.success) assert.deepEqual(r.data.props, {});
});

test('accepts scalar props', () => {
  assert.equal(EventBody.safeParse({ ...base, name: 'session_end', props: { attempt_count: 4, duration_s: 90 } }).success, true);
});

test('rejects an unknown event name', () => {
  assert.equal(EventBody.safeParse({ ...base, name: 'purchase' }).success, false);
});

test('rejects a non-ISO timestamp', () => {
  assert.equal(EventBody.safeParse({ ...base, occurred_at: 'yesterday' }).success, false);
});

test('rejects nested or oversized props', () => {
  assert.equal(EventBody.safeParse({ ...base, props: { a: { b: 1 } } }).success, false);
  const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, i]));
  assert.equal(EventBody.safeParse({ ...base, props: many }).success, false);
});
