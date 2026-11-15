// Spec 022 R2. The server makes the secret verifier, hands it to the app once, and puts only its hash in the
// OAuth `state`, signed — so nothing about a sign-in in progress has to be stored between instances.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const STATE_TTL_S = 10 * 60;

/** 32 CSPRNG bytes as 43 base64url characters. */
export const newVerifier = (): string => randomBytes(32).toString('base64url');

/** `base64url(SHA-256(verifier))`, the PKCE S256 transform. */
export const challengeOf = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

const mac = (payload: string, pepper: string): Buffer => createHmac('sha256', pepper).update(`google-state.${payload}`).digest();

export function signState(challenge: string, pepper: string, now: Date): string {
  const payload = Buffer.from(JSON.stringify({ c: challenge, exp: Math.floor(now.getTime() / 1000) + STATE_TTL_S })).toString('base64url');
  return `${payload}.${mac(payload, pepper).toString('base64url')}`;
}

/** The challenge inside a state we signed and that has not expired, else null. */
export function verifyState(state: string, pepper: string, now: Date): string | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [payload, given] = parts;
  const expected = mac(payload, pepper);
  const got = Buffer.from(given, 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const { c, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { c?: unknown; exp?: unknown };
    return typeof c === 'string' && typeof exp === 'number' && exp * 1000 > now.getTime() ? c : null;
  } catch {
    return null;
  }
}
