import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideRequest } from './limits.js';

const NOW = new Date('2026-10-21T12:00:00Z');
const ago = (s: number) => new Date(NOW.getTime() - s * 1000);

test('allows a first request', () => {
  assert.deepEqual(decideRequest({ emailRequests: [], sourceRequests: [], now: NOW }), { allow: true });
});

test('refuses a resend inside 60 seconds and says how long to wait', () => {
  const d = decideRequest({ emailRequests: [ago(20)], sourceRequests: [ago(20)], now: NOW });
  assert.deepEqual(d, { allow: false, retryAfterS: 40 });
});

test('allows a resend after 60 seconds', () => {
  assert.deepEqual(decideRequest({ emailRequests: [ago(61)], sourceRequests: [], now: NOW }), { allow: true });
});

test('refuses the 6th request for one address within an hour, telling when the oldest one leaves the window', () => {
  const emailRequests = [3500, 2400, 1800, 1200, 300].map(ago); // five within the hour
  const d = decideRequest({ emailRequests, sourceRequests: [], now: NOW });
  assert.deepEqual(d, { allow: false, retryAfterS: 100 }); // 3500 s old -> leaves in 100 s
});

test('refuses the 21st request from one source', () => {
  const sourceRequests = Array.from({ length: 20 }, (_, i) => ago(3000 - i * 100));
  const d = decideRequest({ emailRequests: [], sourceRequests, now: NOW });
  assert.equal(d.allow, false);
  assert.equal(d.allow === false && d.retryAfterS, 600);
});

test('the longest applicable wait wins', () => {
  const d = decideRequest({ emailRequests: [ago(10)], sourceRequests: Array.from({ length: 20 }, () => ago(3590)), now: NOW });
  assert.deepEqual(d, { allow: false, retryAfterS: 50 });
});
