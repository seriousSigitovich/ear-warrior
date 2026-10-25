// Access rules and happy path of GET /admin/users. The report loader is injected, so no database is needed.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';
import type { UsageReport } from '../auth/usagePage.js';

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

const REPORT: UsageReport = {
  accounts: [{ email: 'tester@x.co', createdAt: new Date('2026-10-20T10:00:00Z'), devices: 1, attempts: 7, attempts7d: 7, correct: 5, lastAt: new Date('2026-10-24T10:00:00Z') }],
  anonymous: { devices: 3, attempts: 9, attempts7d: 2, correct: 4, lastAt: null },
};

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
  const app = buildApp({ logger: false, usage: async () => REPORT });
  assert.equal((await app.inject({ method: 'GET', url: '/admin/users' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/admin/users', headers: { authorization: basic('admin', 'x') } })).statusCode, 404);
  await app.close();
});

test('missing or wrong credentials get a Basic challenge and never reach the loader', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  let loaded = 0;
  const app = buildApp({ logger: false, usage: async () => (loaded++, REPORT) });
  for (const authorization of [undefined, 'Bearer pw', basic('admin', 'wrong'), basic('root', 'pw')]) {
    const res = await app.inject({ method: 'GET', url: '/admin/users', headers: authorization ? { authorization } : {} });
    assert.equal(res.statusCode, 401, String(authorization));
    assert.match(String(res.headers['www-authenticate']), /^Basic realm=/);
  }
  assert.equal(loaded, 0);
  await app.close();
});

test('with credentials it renders the report, uncached', async () => {
  process.env.ADMIN_PASSWORD = 'pw';
  const app = buildApp({ logger: false, usage: async () => REPORT });
  const res = await app.inject({ method: 'GET', url: '/admin/users', headers: { authorization: basic('admin', 'pw') } });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type']), /text\/html/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.match(res.body, /tester@x\.co/);
  await app.close();
});
