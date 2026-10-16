// Access rules of the social routes, exercised through Fastify's inject (no network, no database:
// every case here is decided before any query runs). Success paths need Postgres — see tasks T022.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, ADMIN_USER: process.env.ADMIN_USER, CRON_SECRET: process.env.CRON_SECRET };
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_USER;
  delete process.env.CRON_SECRET;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('GET /health answers without touching the database', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  await app.close();
});

test('page and manual collect do not exist when ADMIN_PASSWORD is unset', async () => {
  const app = buildApp();
  assert.equal((await app.inject({ method: 'GET', url: '/admin/social' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/admin/social/collect' })).statusCode, 404);
  // even with credentials: there is nothing to authenticate against
  const res = await app.inject({ method: 'GET', url: '/admin/social', headers: { authorization: basic('admin', 'x') } });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test('missing, malformed and wrong credentials are refused with a Basic challenge', async () => {
  process.env.ADMIN_PASSWORD = 'correct horse';
  const app = buildApp();
  for (const authorization of [undefined, 'Bearer correct horse', 'Basic !!!', basic('admin', 'wrong'), basic('root', 'correct horse'), basic('admin', '')]) {
    const res = await app.inject({ method: 'GET', url: '/admin/social', headers: authorization ? { authorization } : {} });
    assert.equal(res.statusCode, 401, String(authorization));
    assert.match(String(res.headers['www-authenticate']), /^Basic realm=/);
  }
  const post = await app.inject({ method: 'POST', url: '/admin/social/collect', headers: { authorization: basic('admin', 'wrong') } });
  assert.equal(post.statusCode, 401);
  await app.close();
});

test('ADMIN_USER overrides the default user name', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  process.env.ADMIN_USER = 'dmitriy';
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/admin/social', headers: { authorization: basic('admin', 'pw') } });
  assert.equal(res.statusCode, 401); // the default name no longer works
  await app.close();
});

test('cron route: 404 without CRON_SECRET, 401 without or with a wrong bearer token', async () => {
  const app = buildApp();
  assert.equal((await app.inject({ method: 'GET', url: '/api/cron/social' })).statusCode, 404);

  process.env.CRON_SECRET = 's3cret';
  assert.equal((await app.inject({ method: 'GET', url: '/api/cron/social' })).statusCode, 401);
  for (const authorization of ['Bearer nope', 'Bearer ', 's3cret', basic('admin', 's3cret')]) {
    const res = await app.inject({ method: 'GET', url: '/api/cron/social', headers: { authorization } });
    assert.equal(res.statusCode, 401, authorization);
  }
  await app.close();
});

test('the admin password is not accepted as the cron secret and vice versa', async () => {
  process.env.ADMIN_PASSWORD = 'adminpw';
  process.env.CRON_SECRET = 'cronsecret';
  const app = buildApp();
  assert.equal((await app.inject({ method: 'GET', url: '/api/cron/social', headers: { authorization: 'Bearer adminpw' } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/admin/social', headers: { authorization: basic('admin', 'cronsecret') } })).statusCode, 401);
  await app.close();
});

test('the refresh button posts a urlencoded form: it reaches the auth check instead of failing with 415', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  const app = buildApp();
  const form = { 'content-type': 'application/x-www-form-urlencoded' };
  // wrong credentials -> 401 (the handler ran), not 415 (body rejected before it)
  const res = await app.inject({ method: 'POST', url: '/admin/social/collect', headers: { ...form, authorization: basic('admin', 'wrong') }, payload: '' });
  assert.equal(res.statusCode, 401);
  // without a configured password the route still does not exist
  delete process.env.ADMIN_PASSWORD;
  const gone = await app.inject({ method: 'POST', url: '/admin/social/collect', headers: form, payload: '' });
  assert.equal(gone.statusCode, 404);
  await app.close();
});
