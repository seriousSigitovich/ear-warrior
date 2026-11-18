// Access rules and happy path of GET /admin/analytics, and the redirects from the two pages it replaced.
// The loader is injected, so no database is needed.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';
import { account, device } from '../analytics/fixtures.js';
import type { AnalyticsData } from '../analytics/model.js';

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const DATA: AnalyticsData = { devices: [device({ userId: 'u-1', answers: 2 })], accounts: [account()], tunes: [] };

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, ADMIN_USER: process.env.ADMIN_USER };
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_USER;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

test('the page does not exist when ADMIN_PASSWORD is unset', async () => {
  const app = buildApp({ logger: false, analytics: async () => DATA });
  for (const url of ['/admin/analytics', '/admin/users', '/admin/funnel']) {
    assert.equal((await app.inject({ method: 'GET', url, headers: { authorization: basic('admin', 'x') } })).statusCode, 404, url);
  }
  await app.close();
});

test('missing or wrong credentials get a Basic challenge and never reach the loader', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  let loaded = 0;
  const app = buildApp({ logger: false, analytics: async () => (loaded++, DATA) });
  for (const authorization of [undefined, 'Bearer pw', basic('admin', 'wrong'), basic('root', 'pw')]) {
    const res = await app.inject({ method: 'GET', url: '/admin/analytics', headers: authorization ? { authorization } : {} });
    assert.equal(res.statusCode, 401, String(authorization));
    assert.match(String(res.headers['www-authenticate']), /^Basic realm=/);
  }
  assert.equal(loaded, 0);
  await app.close();
});

test('with credentials it renders the people, uncached, and honours the query', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  const app = buildApp({ logger: false, analytics: async () => DATA });
  const headers = { authorization: basic('admin', 'pw') };
  const res = await app.inject({ method: 'GET', url: '/admin/analytics', headers });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type']), /text\/html/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.body, /anna@x\.co/);
  const none = await app.inject({ method: 'GET', url: '/admin/analytics?who=guests', headers });
  assert.ok(!none.body.includes('anna@x.co'));
  await app.close();
});

test('the old pages redirect to analytics, behind the same password', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  const app = buildApp({ logger: false, analytics: async () => DATA });
  for (const url of ['/admin/users', '/admin/funnel']) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401, url);
    const res = await app.inject({ method: 'GET', url, headers: { authorization: basic('admin', 'pw') } });
    assert.equal(res.statusCode, 301, url);
    assert.equal(res.headers.location, '/admin/analytics');
  }
  await app.close();
});
