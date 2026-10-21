// One-time codes: generated from a CSPRNG, stored only as HMAC(code, pepper), compared in constant time.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function generateCode(random: () => number = () => randomInt(0, 1_000_000)): string {
  return String(random()).padStart(6, '0');
}

export const hashCode = (code: string, pepper: string): string =>
  createHmac('sha256', pepper).update(code).digest('hex');

export function matchesHash(code: string, pepper: string, expectedHash: string): boolean {
  const a = Buffer.from(hashCode(code, pepper), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
