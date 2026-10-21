import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCode, hashCode, matchesHash } from './codes.js';

test('generateCode is six digits, zero-padded, from the injected source', () => {
  assert.equal(generateCode(() => 7), '000007');
  assert.equal(generateCode(() => 999_999), '999999');
  assert.match(generateCode(), /^[0-9]{6}$/);
});

test('hashCode depends on the pepper and never contains the code', () => {
  const a = hashCode('123456', 'pepper-a');
  assert.notEqual(a, hashCode('123456', 'pepper-b'));
  assert.notEqual(a, hashCode('123457', 'pepper-a'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a.includes('123456'), false);
});

test('matchesHash is true only for the same code and pepper', () => {
  const h = hashCode('123456', 'p');
  assert.equal(matchesHash('123456', 'p', h), true);
  assert.equal(matchesHash('654321', 'p', h), false);
  assert.equal(matchesHash('123456', 'q', h), false);
  assert.equal(matchesHash('123456', 'p', ''), false);
});
