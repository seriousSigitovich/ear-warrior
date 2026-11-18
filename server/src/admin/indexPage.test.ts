import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';
import { createMemoryChallengeStore } from '../challenges/memoryStore.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';

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
  for (const href of ['/admin/tunes', '/admin/challenges', '/admin/analytics', '/admin/social']) {
    assert.ok(res.body.includes(`href="${href}"`), href);
  }
  await app.close();
});

test('the owner pages that render here carry the same navigation to all the others', async () => {
  const app = buildApp({
    logger: false,
    tunes: createMemoryTuneStore(),
    challengeStore: createMemoryChallengeStore(),
    analytics: async () => ({ devices: [], accounts: [], tunes: [] }),
  });
  const all = ['/admin/tunes', '/admin/challenges', '/admin/analytics', '/admin/social'];
  for (const url of all.filter((u) => u !== '/admin/social')) {
    const res = await app.inject({ method: 'GET', url, headers: AUTH });
    assert.equal(res.statusCode, 200, url);
    assert.ok(res.body.includes('href="/admin"'), `${url}: menu link`);
    for (const href of all) if (href !== url) assert.ok(res.body.includes(`href="${href}"`), `${url} → ${href}`);
  }
  await app.close();
});
