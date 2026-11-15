// Spec 022 R2: the verifier is made by the server; the OAuth `state` carries only its hash, signed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { challengeOf, newVerifier, signState, verifyState } from './googleState.js';

const T0 = new Date('2026-11-15T12:00:00Z');
const later = (s: number) => new Date(T0.getTime() + s * 1000);

test('a verifier is 43 base64url characters and never repeats', () => {
  const a = newVerifier();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, newVerifier());
});

test('challengeOf is base64url(SHA-256(verifier)) — the RFC 7636 appendix B vector', () => {
  assert.equal(challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('a signed state returns its challenge within ten minutes', () => {
  const state = signState('chal', 'pepper', T0);
  assert.equal(verifyState(state, 'pepper', later(599)), 'chal');
});

test('an old, altered, foreign or malformed state is refused', () => {
  const state = signState('chal', 'pepper', T0);
  const [payload, mac] = state.split('.');
  assert.equal(verifyState(state, 'pepper', later(601)), null, 'expired');
  assert.equal(verifyState(state, 'other-pepper', later(1)), null, 'wrong secret');
  assert.equal(verifyState(`${Buffer.from('{"c":"evil","exp":9999999999}').toString('base64url')}.${mac}`, 'pepper', later(1)), null, 'payload swapped');
  assert.equal(verifyState(`${payload}.${mac.slice(0, -2)}AA`, 'pepper', later(1)), null, 'mac altered');
  for (const junk of ['', 'x', 'a.b.c', '.', 'a.']) assert.equal(verifyState(junk, 'pepper', later(1)), null, `junk "${junk}"`);
});
