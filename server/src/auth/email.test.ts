import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPlausibleEmail, normalizeEmail } from './email.js';

test('normalizeEmail trims and lower-cases', () => {
  assert.equal(normalizeEmail('  Name@Example.COM '), 'name@example.com');
});

test('isPlausibleEmail accepts ordinary addresses and rejects garbage', () => {
  for (const ok of ['a@b.co', 'name+tag@example.com', 'first.last@sub.example.org']) assert.equal(isPlausibleEmail(ok), true, ok);
  for (const bad of ['', 'plain', '@x.com', 'a@', 'a@b', 'a b@c.com', 'a@@b.com', `${'x'.repeat(320)}@a.com`]) {
    assert.equal(isPlausibleEmail(bad), false, bad);
  }
});
