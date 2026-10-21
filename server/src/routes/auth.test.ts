// Contract and abuse tests of /api/auth/*, through Fastify's inject with an in-memory store and a
// recording mailer: no Postgres, no SMTP, a controllable clock (Constitution II).
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createMemoryStore } from '../auth/memoryStore.js';
import { createRecordingMailer, type RecordingMailer } from '../auth/mailer.js';
import type { AuthConfig, AuthDeps } from './auth.js';
import type { AuthStore } from '../auth/store.js';

const DEV = 'dev_00000000000000000000000000000001';
const DEV2 = 'dev_00000000000000000000000000000002';
const T0 = new Date('2026-10-21T12:00:00Z');

let clock: Date;
let store: AuthStore;
let mailer: RecordingMailer;
let config: AuthConfig;
let app: FastifyInstance;

const wait = (seconds: number) => {
  clock = new Date(clock.getTime() + seconds * 1000);
};

function setup(logger: boolean | { level: string; stream: Writable } = false) {
  const deps: AuthDeps = { store, mailer, now: () => clock, config: () => config, randomCode: () => 123456 };
  app = buildApp({ auth: deps, logger: logger as never });
}

beforeEach(() => {
  clock = new Date(T0);
  store = createMemoryStore();
  mailer = createRecordingMailer();
  config = { pepper: 'test-pepper' };
  setup();
});

const post = (url: string, payload: unknown, remoteAddress = '10.0.0.1') =>
  app.inject({ method: 'POST', url, payload: payload as object, remoteAddress });
const requestCode = (email: string, remoteAddress?: string) => post('/api/auth/request', { email }, remoteAddress);
const verify = (email: string, code: string, device_id = DEV) => post('/api/auth/verify', { email, code, device_id });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const lastCode = () => mailer.sent[mailer.sent.length - 1].code;

async function signIn(email = 'a@x.co', deviceId = DEV): Promise<string> {
  await requestCode(email);
  const res = await verify(email, lastCode(), deviceId);
  assert.equal(res.statusCode, 200, res.body);
  wait(61);
  return res.json().token;
}

// ---------- POST /api/auth/request ----------

test('request: 200 with the documented body, and exactly one mail carrying a 6-digit code', async () => {
  const res = await requestCode('Name@Example.com ');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, resend_after_s: 60, expires_in_s: 600 });
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'name@example.com');
  assert.match(mailer.sent[0].code, /^[0-9]{6}$/);
});

test('request: the body is byte-identical for an address with and without an account (FR-008)', async () => {
  await signIn('known@x.co');
  const known = await requestCode('known@x.co');
  const unknown = await requestCode('stranger@x.co');
  assert.equal(known.body, unknown.body);
  assert.equal(known.statusCode, unknown.statusCode);
});

test('request: garbage is a 400 and sends nothing', async () => {
  for (const body of [{}, { email: 'nope' }, { email: 42 }, { email: '' }]) {
    const res = await post('/api/auth/request', body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(res.json(), { ok: false, error: 'invalid_email' });
  }
  assert.equal(mailer.sent.length, 0);
});

test('request: a second request inside 60 s is refused with the wait; after 60 s it works', async () => {
  await requestCode('a@x.co');
  wait(20);
  const res = await requestCode('a@x.co');
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.json(), { ok: false, error: 'rate_limited', retry_after_s: 40 });
  assert.equal(mailer.sent.length, 1);
  wait(41);
  assert.equal((await requestCode('a@x.co')).statusCode, 200);
});

test('request: the 6th request for one address within an hour is refused (FR-007)', async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await requestCode('a@x.co')).statusCode, 200, `request ${i + 1}`);
    wait(61);
  }
  const res = await requestCode('a@x.co');
  assert.equal(res.statusCode, 429);
  assert.ok(res.json().retry_after_s > 0);
  wait(res.json().retry_after_s);
  assert.equal((await requestCode('a@x.co')).statusCode, 200);
});

test('request: the 21st request from one source is refused, other sources are not', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await requestCode(`u${i}@x.co`, '10.0.0.9')).statusCode, 200, `request ${i + 1}`);
  assert.equal((await requestCode('u20@x.co', '10.0.0.9')).statusCode, 429);
  assert.equal((await requestCode('u20@x.co', '10.0.0.10')).statusCode, 200);
});

test('request: when the mail fails the answer is 502, the code is discarded and a retry is allowed at once', async () => {
  mailer.failNext = true;
  const res = await requestCode('a@x.co');
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { ok: false, error: 'mail_failed' });
  assert.equal(await store.latestCode('a@x.co'), null);
  assert.equal((await requestCode('a@x.co')).statusCode, 200);
});

test('request/verify: without AUTH_PEPPER the routes answer 503 auth_disabled', async () => {
  config = {};
  assert.deepEqual((await requestCode('a@x.co')).json(), { ok: false, error: 'auth_disabled' });
  assert.equal((await requestCode('a@x.co')).statusCode, 503);
  assert.equal((await verify('a@x.co', '123456')).statusCode, 503);
});

// ---------- POST /api/auth/verify ----------

test('verify: the right code signs in, creates the account, and works only once', async () => {
  await requestCode('A@x.co');
  const ok = await verify('a@x.co', lastCode());
  assert.equal(ok.statusCode, 200);
  const body = ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.email, 'a@x.co');
  assert.equal(body.created, true);
  assert.match(body.token, /^[A-Za-z0-9_-]{43}$/);
  const again = await verify('a@x.co', lastCode());
  assert.equal(again.statusCode, 401);
  assert.deepEqual(again.json(), { ok: false, error: 'no_code' });
});

test('verify: a returning address gets created:false and the same account', async () => {
  await signIn('a@x.co');
  await requestCode('a@x.co');
  const res = await verify('a@x.co', lastCode(), DEV2);
  assert.equal(res.json().created, false);
});

test('verify: bad payloads are 400', async () => {
  for (const body of [{}, { email: 'a@x.co', code: '12345', device_id: DEV }, { email: 'a@x.co', code: 'abcdef', device_id: DEV }, { email: 'bad', code: '123456', device_id: DEV }, { email: 'a@x.co', code: '123456' }, { email: 'a@x.co', code: '123456', device_id: 'x'.repeat(81) }]) {
    const res = await post('/api/auth/verify', body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.deepEqual(res.json(), { ok: false, error: 'invalid_payload' });
  }
});

test('verify: a wrong code counts down the attempts left', async () => {
  await requestCode('a@x.co');
  for (const left of [4, 3, 2, 1]) {
    const res = await verify('a@x.co', '000000');
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { ok: false, error: 'wrong_code', attempts_left: left });
  }
});

test('verify: the 5th wrong attempt kills a code that would otherwise be right (SC-007)', async () => {
  await requestCode('a@x.co');
  const right = lastCode();
  const wrong = right === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) await verify('a@x.co', wrong);
  assert.deepEqual((await verify('a@x.co', wrong)).json(), { ok: false, error: 'too_many_attempts' });
  assert.deepEqual((await verify('a@x.co', right)).json(), { ok: false, error: 'too_many_attempts' });
  wait(61);
  await requestCode('a@x.co'); // a new code works again
  assert.equal((await verify('a@x.co', lastCode())).statusCode, 200);
});

test('verify: parallel guesses cannot beat the attempt limit', async () => {
  await requestCode('a@x.co');
  const wrong = lastCode() === '000000' ? '111111' : '000000';
  const results = await Promise.all(Array.from({ length: 30 }, () => verify('a@x.co', wrong)));
  assert.equal(results.filter((r) => r.json().error === 'wrong_code').length, 4);
  assert.equal(results.filter((r) => r.json().error === 'too_many_attempts').length, 26);
});

test('verify: an expired code says so (injected clock)', async () => {
  await requestCode('a@x.co');
  wait(601);
  assert.deepEqual((await verify('a@x.co', lastCode())).json(), { ok: false, error: 'code_expired' });
});

test('verify: a code is still good just before it expires', async () => {
  await requestCode('a@x.co');
  wait(599);
  assert.equal((await verify('a@x.co', lastCode())).statusCode, 200);
});

test('verify: a newer request supersedes the older code', async () => {
  await requestCode('a@x.co');
  const old = lastCode();
  wait(61);
  const deps: AuthDeps = { store, mailer, now: () => clock, config: () => config, randomCode: () => 654321 };
  app = buildApp({ auth: deps, logger: false });
  await requestCode('a@x.co');
  assert.equal(lastCode(), '654321');
  assert.equal((await verify('a@x.co', old)).json().error, 'wrong_code'); // only the newest code is live
  assert.equal((await verify('a@x.co', '654321')).statusCode, 200);
});

test('verify: an address that never asked for a code gets no_code', async () => {
  assert.deepEqual((await verify('ghost@x.co', '123456')).json(), { ok: false, error: 'no_code' });
});

test('verify: a code for one address does not work for another', async () => {
  await requestCode('a@x.co');
  wait(61);
  await requestCode('b@x.co');
  assert.equal((await verify('b@x.co', lastCode())).statusCode, 200);
  assert.deepEqual((await verify('c@x.co', '123456')).json(), { ok: false, error: 'no_code' });
});

// ---------- GET /api/auth/me, POST /api/auth/signout, DELETE /api/auth/account ----------

test('me: a valid token returns the email; missing, malformed and unknown tokens are 401', async () => {
  const token = await signIn('a@x.co');
  const ok = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
  assert.deepEqual(ok.json(), { ok: true, email: 'a@x.co' });
  for (const headers of [{}, { authorization: 'Bearer' }, { authorization: 'Basic abc' }, bearer('x'.repeat(43))]) {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { ok: false, error: 'invalid_session' });
  }
});

test('signout: revokes the session, closes attribution, and is idempotent even for unknown tokens', async () => {
  const token = await signIn('a@x.co');
  assert.equal(await store.attributedEmail(DEV, clock), 'a@x.co');
  const out = await app.inject({ method: 'POST', url: '/api/auth/signout', headers: bearer(token) });
  assert.deepEqual(out.json(), { ok: true });
  assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) })).statusCode, 401);
  wait(5);
  assert.equal(await store.attributedEmail(DEV, clock), null);
  for (const headers of [bearer(token), bearer('y'.repeat(43)), {}]) {
    const res = await app.inject({ method: 'POST', url: '/api/auth/signout', headers });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  }
});

test('account: deleting removes the account, signs the other phone out, and a later sign-in is a brand-new account (FR-015)', async () => {
  const phoneA = await signIn('a@x.co', DEV);
  const phoneB = await signIn('a@x.co', DEV2);
  const del = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: bearer(phoneA) });
  assert.deepEqual(del.json(), { ok: true });
  for (const t of [phoneA, phoneB]) assert.equal((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(t) })).statusCode, 401);
  assert.equal(await store.attributedEmail(DEV, clock), null);
  await requestCode('a@x.co');
  assert.equal((await verify('a@x.co', lastCode())).json().created, true);
});

test('account: needs a valid session', async () => {
  const res = await app.inject({ method: 'DELETE', url: '/api/auth/account' });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { ok: false, error: 'invalid_session' });
});

test('account: a store failure is a 502 store_failed', async () => {
  const token = await signIn('a@x.co');
  store.deleteUser = async () => {
    throw new Error('db down');
  };
  const res = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: bearer(token) });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { ok: false, error: 'store_failed' });
});

test('CORS allows DELETE for the account route', async () => {
  const res = await app.inject({
    method: 'OPTIONS',
    url: '/api/auth/account',
    headers: { origin: 'https://example.com', 'access-control-request-method': 'DELETE', 'access-control-request-headers': 'authorization' },
  });
  assert.match(String(res.headers['access-control-allow-methods']), /DELETE/);
});

// ---------- reviewer test account ----------

test('test account: enabled -> the fixed pair signs in, no mail, no stored code', async () => {
  config = { pepper: 'test-pepper', testEmail: 'review@example.com', testCode: '424242' };
  const req = await requestCode('Review@Example.com');
  assert.deepEqual(req.json(), { ok: true, resend_after_s: 60, expires_in_s: 600 });
  assert.equal(mailer.sent.length, 0);
  const res = await verify('review@example.com', '424242');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().email, 'review@example.com');
});

test('test account: the fixed code is no skeleton key for other addresses', async () => {
  config = { pepper: 'test-pepper', testEmail: 'review@example.com', testCode: '424242' };
  assert.equal((await verify('other@x.co', '424242')).statusCode, 401);
  await requestCode('other@x.co');
  assert.equal(mailer.sent.length, 1, 'other addresses still get real mail');
  assert.equal((await verify('other@x.co', '424242')).json().error, 'wrong_code');
});

test('test account: disabled (or half configured) -> refused like any wrong code', async () => {
  for (const c of [{ pepper: 'p' }, { pepper: 'p', testEmail: 'review@example.com' }, { pepper: 'p', testCode: '424242' }]) {
    config = c;
    const res = await verify('review@example.com', '424242');
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error, 'no_code');
  }
});

// ---------- FR-022: secrets stay out of logs ----------

test('logs never contain the code or the session token', async () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  setup({ level: 'trace', stream });
  await requestCode('a@x.co');
  const code = lastCode();
  const res = await verify('a@x.co', code);
  const token = res.json().token as string;
  await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
  await app.inject({ method: 'POST', url: '/api/auth/signout', headers: bearer(token) });
  mailer.failNext = true;
  wait(61);
  await requestCode('a@x.co'); // the failure path logs an error
  const log = lines.join('');
  assert.ok(log.length > 0, 'the logger was actually capturing');
  assert.equal(log.includes(code), false, 'code in logs');
  assert.equal(log.includes(token), false, 'token in logs');
});
