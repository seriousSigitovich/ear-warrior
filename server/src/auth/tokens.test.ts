import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateToken, hashToken, parseBearer } from './tokens.js';

test('tokens are long, unique, url-safe, and stored only as a hash', () => {
  const a = generateToken();
  const b = generateToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  const h = hashToken(a);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h.includes(a), false);
  assert.equal(hashToken(a), h);
});

test('parseBearer extracts a well-formed token only', () => {
  assert.equal(parseBearer('Bearer abc_DEF-123'), 'abc_DEF-123');
  for (const bad of [undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'bearer abc', 'Bearer a b', 'Bearer a$b']) {
    assert.equal(parseBearer(bad), null, String(bad));
  }
});
