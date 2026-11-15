// Spec 022 R3. Swaps the authorisation code for Google's identity at the token endpoint. The id_token is read
// straight from that TLS response (authenticated with our client secret), so its signature is not re-checked,
// but every claim that decides who signs in is: issuer, audience, expiry, and a verified email.
import { isPlausibleEmail, normalizeEmail } from './email.js';

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type GoogleIdentity = { ok: true; email: string } | { ok: false; reason: 'unverified_email' | 'google_failed' };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const failed: GoogleIdentity = { ok: false, reason: 'google_failed' };

function claimsOf(idToken: unknown): Record<string, unknown> | null {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function exchangeGoogleCode(input: {
  code: string;
  config: GoogleConfig;
  fetch: typeof fetch;
  now: Date;
}): Promise<GoogleIdentity> {
  const { code, config, now } = input;
  let body: { id_token?: unknown };
  try {
    const res = await input.fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) return failed;
    body = (await res.json()) as { id_token?: unknown };
  } catch {
    return failed;
  }

  const claims = claimsOf(body.id_token);
  if (!claims) return failed;
  if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) return failed;
  if (claims.aud !== config.clientId) return failed;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now.getTime()) return failed;
  if (typeof claims.email !== 'string') return failed;
  const email = normalizeEmail(claims.email);
  if (!isPlausibleEmail(email)) return failed;
  if (claims.email_verified !== true) return { ok: false, reason: 'unverified_email' };
  return { ok: true, email };
}
