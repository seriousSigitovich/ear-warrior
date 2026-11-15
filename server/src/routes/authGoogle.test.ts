// Contract tests of the Google sign-in routes (spec 022): Fastify inject, in-memory store, a fake Google
// (injected fetch), a controllable clock. No network, no Postgres.
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createMemoryStore } from '../auth/memoryStore.js';
import { createRecordingMailer, type RecordingMailer } from '../auth/mailer.js';
import { challengeOf } from '../auth/googleState.js';
import type { GoogleConfig } from '../auth/googleIdentity.js';
import type { AuthStore } from '../auth/store.js';
import type { AuthConfig, AuthDeps } from './auth.js';

const DEV = 'dev_00000000000000000000000000000001';
const DEV2 = 'dev_00000000000000000000000000000002';
const T0 = new Date('2026-11-15T12:00:00Z');
const GOOGLE: GoogleConfig = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'gsecret', redirectUri: 'https://api.test/api/auth/google/callback' };

let clock: Date;
let store: AuthStore;
let mailer: RecordingMailer;
let config: AuthConfig;
let google: GoogleConfig | undefined;
let googleReply: { claims?: Record<string, unknown>; status?: number; throws?: boolean };
let app: FastifyInstance;

const wait = (s: number) => {
  clock = new Date(clock.getTime() + s * 1000);
};
const jwt = (claims: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const claimsFor = (email: string, extra: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: GOOGLE.clientId,
  exp: Math.floor(clock.getTime() / 1000) + 3000,
  email,
  email_verified: true,
  ...extra,
});

const fakeGoogle = (async () => {
  if (googleReply.throws) throw new Error('offline');
  if (googleReply.status && googleReply.status >= 400) return new Response('{"error":"invalid_grant"}', { status: googleReply.status });
  return new Response(JSON.stringify({ id_token: jwt(googleReply.claims ?? claimsFor('g@gmail.com')) }));
}) as unknown as typeof fetch;

function setup(logger: boolean | { level: string; stream: Writable } = false) {
  const deps: AuthDeps = { store, mailer, now: () => clock, config: () => config, randomCode: () => 123456, google: () => google, fetch: fakeGoogle };
  app = buildApp({ auth: deps, logger: logger as never });
}

beforeEach(() => {
  clock = new Date(T0);
  store = createMemoryStore();
  mailer = createRecordingMailer();
  config = { pepper: 'test-pepper' };
  google = GOOGLE;
  googleReply = {};
  setup();
});

const post = (url: string, payload?: unknown) => app.inject({ method: 'POST', url, payload: payload as object, remoteAddress: '10.0.0.1' });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function start(): Promise<{ url: string; verifier: string; state: string }> {
  const res = await post('/api/auth/google/start');
  assert.equal(res.statusCode, 200, res.body);
  const { url, verifier } = res.json();
  return { url, verifier, state: new URL(url).searchParams.get('state') as string };
}
const callback = (query: Record<string, string>) => app.inject({ method: 'GET', url: '/api/auth/google/callback', query });
const ticketOf = (html: string) => /earwarrior:\/\/sign-in\?ticket=([A-Za-z0-9_-]+)/.exec(html)?.[1];
const errorOf = (html: string) => /earwarrior:\/\/sign-in\?error=([a-z_]+)/.exec(html)?.[1];
const exchange = (ticket: string, verifier: string, device_id = DEV) => post('/api/auth/google/exchange', { ticket, verifier, device_id });

/** The whole happy path: start → Google → callback → exchange. */
async function googleSignIn(email: string, deviceId = DEV) {
  googleReply = { claims: claimsFor(email) };
  const s = await start();
  const page = await callback({ code: 'authcode', state: s.state });
  const ticket = ticketOf(page.body);
  assert.ok(ticket, page.body);
  return exchange(ticket, s.verifier, deviceId);
}
async function emailSignIn(email: string, deviceId = DEV): Promise<string> {
  await post('/api/auth/request', { email });
  const res = await post('/api/auth/verify', { email, code: mailer.sent[mailer.sent.length - 1].code, device_id: deviceId });
  assert.equal(res.statusCode, 200, res.body);
  return res.json().token;
}

// ---------- providers ----------

test('providers reports google only when it is fully configured', async () => {
  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/auth/providers' })).json(), { ok: true, email: true, google: true });
  google = undefined;
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/providers' })).json().google, false);
  google = GOOGLE;
  config = {};
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/providers' })).json().google, false, 'no pepper, no signed state');
});

// ---------- start ----------

test('start returns a Google URL with the account chooser and a verifier that is not in the URL', async () => {
  const { url, verifier, state } = await start();
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), GOOGLE.clientId);
  assert.equal(u.searchParams.get('redirect_uri'), GOOGLE.redirectUri);
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('scope'), 'openid email');
  assert.equal(u.searchParams.get('prompt'), 'select_account');
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(url.includes(verifier), false);
  assert.ok(state.length > 20);
  assert.notEqual((await start()).verifier, verifier, 'a fresh verifier each time');
});

test('start and the other google routes answer google_disabled when it is not configured', async () => {
  google = undefined;
  const res = await post('/api/auth/google/start');
  assert.equal(res.statusCode, 503);
  assert.equal(res.json().error, 'google_disabled');
  assert.equal(errorOf((await callback({ code: 'x', state: 'y' })).body), 'google_disabled');
  const ex = await exchange('t'.repeat(43), 'v'.repeat(43));
  assert.equal(ex.statusCode, 503);
  assert.equal(ex.json().error, 'google_disabled');
});

// ---------- callback ----------

test('callback: a valid state and a good Google answer give a page with a one-time ticket', async () => {
  const s = await start();
  const res = await callback({ code: 'authcode', state: s.state });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type']), /text\/html/);
  assert.match(String(res.headers['cache-control']), /no-store/);
  assert.ok(ticketOf(res.body));
  assert.doesNotMatch(res.body, /id_token|eyJ/);
});

test('callback: altered, missing or expired state is "expired" and Google is never asked', async () => {
  let asked = 0;
  app = buildApp({
    auth: { store, mailer, now: () => clock, config: () => config, google: () => google, fetch: (async () => { asked++; return new Response('{}'); }) as unknown as typeof fetch },
    logger: false,
  });
  const s = await start();
  assert.equal(errorOf((await callback({ code: 'c', state: s.state + 'x' })).body), 'expired');
  assert.equal(errorOf((await callback({ code: 'c' })).body), 'expired');
  wait(601);
  assert.equal(errorOf((await callback({ code: 'c', state: s.state })).body), 'expired');
  assert.equal(asked, 0);
});

test('callback: cancelling at Google is "cancelled", other Google errors are "google_failed"', async () => {
  const s = await start();
  assert.equal(errorOf((await callback({ error: 'access_denied', state: s.state })).body), 'cancelled');
  assert.equal(errorOf((await callback({ error: 'server_error', state: s.state })).body), 'google_failed');
  assert.equal(errorOf((await callback({ state: s.state })).body), 'google_failed', 'no code at all');
});

test('callback: unverified email, wrong audience, Google refusing or down never produce a ticket (FR-006)', async () => {
  const s = await start();
  const cases: [typeof googleReply, string][] = [
    [{ claims: claimsFor('g@gmail.com', { email_verified: false }) }, 'unverified_email'],
    [{ claims: claimsFor('g@gmail.com', { aud: 'another-app' }) }, 'google_failed'],
    [{ status: 400 }, 'google_failed'],
    [{ throws: true }, 'google_failed'],
  ];
  for (const [reply, expected] of cases) {
    googleReply = reply;
    const res = await callback({ code: 'c', state: s.state });
    assert.equal(errorOf(res.body), expected);
    assert.equal(ticketOf(res.body), undefined);
  }
});

// ---------- exchange ----------

test('exchange: the first call signs in and creates the account, the second call is refused', async () => {
  googleReply = { claims: claimsFor('Name@Gmail.com') };
  const s = await start();
  const ticket = ticketOf((await callback({ code: 'c', state: s.state })).body) as string;
  const res = await exchange(ticket, s.verifier);
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.email, 'name@gmail.com');
  assert.equal(body.created, true);
  assert.ok(body.token);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(body.token) })).json().email, 'name@gmail.com');
  const again = await exchange(ticket, s.verifier);
  assert.equal(again.statusCode, 401);
  assert.equal(again.json().error, 'invalid_ticket');
});

test('exchange: the wrong verifier is refused and burns the ticket; a stolen ticket is useless', async () => {
  const s = await start();
  const ticket = ticketOf((await callback({ code: 'c', state: s.state })).body) as string;
  const stolen = await exchange(ticket, 'x'.repeat(43));
  assert.equal(stolen.statusCode, 401);
  assert.equal(stolen.json().error, 'invalid_ticket');
  assert.equal((await exchange(ticket, s.verifier)).statusCode, 401, 'burned even for the owner of the verifier');
});

test('exchange: an expired or unknown ticket is invalid_ticket; malformed bodies are 400', async () => {
  const s = await start();
  const ticket = ticketOf((await callback({ code: 'c', state: s.state })).body) as string;
  wait(121);
  assert.equal((await exchange(ticket, s.verifier)).json().error, 'invalid_ticket');
  assert.equal((await exchange('u'.repeat(43), s.verifier)).json().error, 'invalid_ticket');
  for (const bad of [{}, { ticket: 'short', verifier: s.verifier, device_id: DEV }, { ticket, verifier: 'short', device_id: DEV }, { ticket, verifier: s.verifier }]) {
    assert.equal((await post('/api/auth/google/exchange', bad)).statusCode, 400);
  }
});

// ---------- one account across both methods (US2, FR-005) ----------

test('an address that signed in by email code enters the same account with Google, either order, any case', async () => {
  const emailToken = await emailSignIn('same@gmail.com', DEV);
  const viaGoogle = await googleSignIn('Same@Gmail.com', DEV2);
  assert.equal(viaGoogle.json().created, false);
  const me = (t: string) => app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(t) });
  assert.equal((await me(emailToken)).json().email, 'same@gmail.com');
  assert.equal((await me(viaGoogle.json().token)).json().email, 'same@gmail.com');

  const first = await googleSignIn('other@gmail.com', DEV);
  assert.equal(first.json().created, true);
  const back = await emailSignIn('other@gmail.com', DEV2);
  assert.ok(back);
  assert.equal(await store.attributedEmail(DEV2, new Date(clock.getTime() + 1000)), 'other@gmail.com');
});

test('two different Google accounts on one phone are two accounts; the device follows the later one', async () => {
  const a = await googleSignIn('a@gmail.com');
  wait(10);
  const b = await googleSignIn('b@gmail.com');
  assert.equal(a.json().created, true);
  assert.equal(b.json().created, true);
  assert.equal(await store.attributedEmail(DEV, new Date(clock.getTime() + 1000)), 'b@gmail.com');
});

// ---------- sign-out, deletion, attribution (US3, US4) ----------

test('a Google session signs out (idempotently), and attribution stops at sign-out', async () => {
  const token = (await googleSignIn('g@gmail.com')).json().token as string;
  wait(5);
  assert.equal(await store.attributedEmail(DEV, new Date(clock.getTime() - 60_000)), 'g@gmail.com', 'earlier events of the device are attributable');
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/signout', headers: bearer(token) })).statusCode, 200);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/signout', headers: bearer(token) })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) })).statusCode, 401);
  wait(5);
  assert.equal(await store.attributedEmail(DEV, clock), null);
});

test('deleting a Google-entered account removes it; the next Google sign-in is a fresh account', async () => {
  const first = (await googleSignIn('g@gmail.com')).json();
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: bearer(first.token) })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(first.token) })).statusCode, 401);
  wait(5);
  const second = (await googleSignIn('g@gmail.com')).json();
  assert.equal(second.created, true);
});

// ---------- spec 005 is untouched (FR-017) ----------

test('the reviewer test account still works with Google configured', async () => {
  config = { pepper: 'test-pepper', testEmail: 'review@x.co', testCode: '424242' };
  const res = await post('/api/auth/verify', { email: 'review@x.co', code: '424242', device_id: DEV });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().email, 'review@x.co');
});

// ---------- FR-016: secrets stay out of logs ----------

test('logs never contain the ticket, verifier, state, code or tokens', async () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  setup({ level: 'trace', stream });
  const s = await start();
  const page = await callback({ code: 'authcode-secret', state: s.state });
  const ticket = ticketOf(page.body) as string;
  const res = await exchange(ticket, s.verifier);
  const token = res.json().token as string;
  await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
  googleReply = { throws: true };
  await callback({ code: 'authcode-secret-2', state: s.state });
  const log = lines.join('');
  assert.ok(log.length > 0, 'the logger was actually capturing');
  for (const [name, secret] of Object.entries({ ticket, verifier: s.verifier, state: s.state, code: 'authcode-secret', code2: 'authcode-secret-2', token })) {
    assert.equal(log.includes(secret), false, `${name} in logs`);
  }
  assert.equal(challengeOf(s.verifier).length, 43);
});
