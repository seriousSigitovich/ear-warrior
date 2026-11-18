import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';

const AUTH = { authorization: `Basic ${Buffer.from('admin:pw').toString('base64')}` };
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'pw';
});
afterEach(() => {
  if (saved === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = saved;
});

test('/admin needs the admin password and links to every owner page', async () => {
  const app = buildApp({ logger: false });
  assert.equal((await app.inject({ method: 'GET', url: '/admin' })).statusCode, 401);
  const res = await app.inject({ method: 'GET', url: '/admin', headers: AUTH });
  assert.equal(res.statusCode, 200);
  for (const href of ['/admin/tunes', '/admin/challenges', '/admin/users', '/admin/funnel', '/admin/social']) {
    assert.ok(res.body.includes(`href="${href}"`), href);
  }
  await app.close();
});
