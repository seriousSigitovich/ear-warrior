// Spec 022 R3: the id_token comes from Google's token endpoint over TLS; its claims are still checked.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exchangeGoogleCode, type GoogleConfig } from './googleIdentity.js';

const NOW = new Date('2026-11-15T12:00:00Z');
const config: GoogleConfig = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret', redirectUri: 'https://api.test/api/auth/google/callback' };
const jwt = (claims: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const good = { iss: 'https://accounts.google.com', aud: config.clientId, exp: Math.floor(NOW.getTime() / 1000) + 3000, email: 'Name@Gmail.com', email_verified: true };
const reply = (body: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
const run = (f: typeof fetch) => exchangeGoogleCode({ code: 'abc', config, fetch: f, now: NOW });

test('success returns the normalised email and calls the token endpoint with the form Google expects', async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const f = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id_token: jwt(good) }));
  }) as unknown as typeof fetch;
  assert.deepEqual(await run(f), { ok: true, email: 'name@gmail.com' });
  assert.equal(seen?.url, 'https://oauth2.googleapis.com/token');
  assert.equal(seen?.init.method, 'POST');
  const form = new URLSearchParams(String(seen?.init.body));
  assert.equal(form.get('code'), 'abc');
  assert.equal(form.get('client_id'), config.clientId);
  assert.equal(form.get('client_secret'), 'secret');
  assert.equal(form.get('redirect_uri'), config.redirectUri);
  assert.equal(form.get('grant_type'), 'authorization_code');
});

test('an unverified email is refused as such, including the string "false"', async () => {
  for (const v of [false, 'false', undefined]) {
    assert.deepEqual(await run(reply({ id_token: jwt({ ...good, email_verified: v }) })), { ok: false, reason: 'unverified_email' });
  }
});

test('every other problem is google_failed and nothing is accepted', async () => {
  const bad = [
    reply({ error: 'invalid_grant' }, 400),
    reply({}),
    reply({ id_token: 'not-a-jwt' }),
    reply({ id_token: jwt({ ...good, iss: 'https://evil.example' }) }),
    reply({ id_token: jwt({ ...good, aud: 'someone-else' }) }),
    reply({ id_token: jwt({ ...good, exp: Math.floor(NOW.getTime() / 1000) - 1 }) }),
    reply({ id_token: jwt({ ...good, email: undefined }) }),
    reply({ id_token: jwt({ ...good, email: 'not an email' }) }),
    (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch,
    (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch,
  ];
  for (const f of bad) assert.deepEqual(await run(f), { ok: false, reason: 'google_failed' });
});

test('the accounts.google.com issuer without the scheme is accepted', async () => {
  assert.equal((await run(reply({ id_token: jwt({ ...good, iss: 'accounts.google.com' }) }))).ok, true);
});
