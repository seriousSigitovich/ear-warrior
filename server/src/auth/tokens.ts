// Session tokens: opaque, 256 bits, stored server-side only as sha256(token).
import { createHash, randomBytes } from 'node:crypto';

export const generateToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** The token from `Authorization: Bearer <token>`, or null when missing or malformed. */
export function parseBearer(header: string | undefined): string | null {
  const m = /^Bearer ([A-Za-z0-9_-]+)$/.exec(header ?? '');
  return m ? m[1] : null;
}
