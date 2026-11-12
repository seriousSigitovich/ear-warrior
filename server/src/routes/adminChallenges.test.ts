// Owner pages for the daily challenges and the public route reading them (spec 020), through Fastify's inject.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';
import { challengesFor } from '../challenges/daily.js';
import { createMemoryChallengeStore } from '../challenges/memoryStore.js';
import type { ChallengeStore } from '../challenges/override.js';

const NOW = new Date('2026-11-12T10:00:00Z');
const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const AUTH = { authorization: basic('admin', 'pw') };
const FORM = { ...AUTH, 'content-type': 'application/x-www-form-urlencoded' };

const body = (over: Record<string, string> = {}): string =>
  new URLSearchParams({
    type1: 'melodies', target1: '2', xp1: '10', title1: 'Warm up', desc1: 'Two melodies',
    type2: 'accuracy', target2: '95', xp2: '25', title2: 'Sharp ear', desc2: 'Reach 95%',
    type3: 'melodies', target3: '6', xp3: '45', title3: 'Marathon', desc3: 'Six melodies',
    bonus: '40',
    ...over,
  }).toString();

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, ADMIN_USER: process.env.ADMIN_USER };
  process.env.ADMIN_PASSWORD = 'pw';
  delete process.env.ADMIN_USER;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const make = (store: ChallengeStore = createMemoryChallengeStore()) => ({
  store,
  app: buildApp({ logger: false, challenges: { now: () => NOW }, challengeStore: store }),
});

test('the pages need the admin password and do not exist without one', async () => {
  const { app } = make();
  for (const url of ['/admin/challenges', '/admin/challenges/2026-11-20']) {
    assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401, url);
    assert.equal((await app.inject({ method: 'GET', url, headers: { authorization: basic('admin', 'bad') } })).statusCode, 401, url);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/admin/challenges/2026-11-20', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: body() })).statusCode, 401);
  delete process.env.ADMIN_PASSWORD;
  assert.equal((await app.inject({ method: 'GET', url: '/admin/challenges' })).statusCode, 404);
  await app.close();
});

test('the list shows 14 days, manual ones marked, and only tomorrow onward editable', async () => {
  const { app, store } = make();
  await store.set({ date: '2026-11-14', allBonusXp: 7, challenges: [{ id: 'melodies-2', type: 'melodies', target: 2, rewardXp: 10, title: 'Hand <b>made</b>', description: 'd' }] });
  const res = await app.inject({ method: 'GET', url: '/admin/challenges', headers: AUTH });
  assert.equal(res.statusCode, 200);
  assert.equal((res.body.match(/<tr><td class="l">/g) ?? []).length, 14);
  assert.match(res.body, /2026-11-12<\/b>/);
  assert.match(res.body, /Hand &lt;b&gt;made&lt;\/b&gt;/);
  assert.equal((res.body.match(/class="badge manual"/g) ?? []).length, 1);
  assert.doesNotMatch(res.body, /href="\/admin\/challenges\/2026-11-12"/);
  assert.match(res.body, /href="\/admin\/challenges\/2026-11-13"/);
  await app.close();
});

test('the form of an untouched day is prefilled from the generator', async () => {
  const { app } = make();
  const res = await app.inject({ method: 'GET', url: '/admin/challenges/2026-11-20', headers: AUTH });
  assert.equal(res.statusCode, 200);
  const first = challengesFor('2026-11-20').challenges[0];
  assert.ok(res.body.includes(`value="${first.title}"`));
  assert.doesNotMatch(res.body, /Вернуть генератор/);
  await app.close();
});

test('saving a day makes the public route answer with it, resetting brings the generator back', async () => {
  const { app } = make();
  const date = '2026-11-13';
  const save = await app.inject({ method: 'POST', url: `/admin/challenges/${date}`, headers: FORM, payload: body() });
  assert.equal(save.statusCode, 303, save.body);
  assert.match(String(save.headers.location), /^\/admin\/challenges\?saved=2026-11-13$/);

  const today = (await app.inject({ method: 'GET', url: `/api/challenges/today?date=${date}` })).json();
  assert.equal(today.all_bonus_xp, 40);
  assert.deepEqual(
    today.challenges.map((c: { id: string; type: string; target: number; reward_xp: number; title: string }) => [c.id, c.type, c.target, c.reward_xp, c.title]),
    [['melodies-2', 'melodies', 2, 10, 'Warm up'], ['accuracy-95', 'accuracy', 95, 25, 'Sharp ear'], ['melodies-6', 'melodies', 6, 45, 'Marathon']],
  );

  const form = await app.inject({ method: 'GET', url: `/admin/challenges/${date}`, headers: AUTH });
  assert.match(form.body, /Вернуть генератор/);

  const reset = await app.inject({ method: 'POST', url: `/admin/challenges/${date}/reset`, headers: FORM });
  assert.equal(reset.statusCode, 303);
  const after = (await app.inject({ method: 'GET', url: `/api/challenges/today?date=${date}` })).json();
  assert.equal(after.all_bonus_xp, challengesFor(date).allBonusXp);
  assert.equal(after.challenges[0].title, challengesFor(date).challenges[0].title);
  await app.close();
});

test('a rejected form stores nothing and comes back with the reasons and the typed values', async () => {
  const { app, store } = make();
  const res = await app.inject({ method: 'POST', url: '/admin/challenges/2026-11-20', headers: FORM, payload: body({ target2: '30', title1: 'a "quoted" <x>' }) });
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /№2: цель/);
  assert.ok(res.body.includes('value="a &quot;quoted&quot; &lt;x&gt;"'));
  assert.equal(await store.get('2026-11-20'), null);
  await app.close();
});

test('today, the past and the far future cannot be changed; a non-date is not found', async () => {
  const { app, store } = make();
  for (const date of ['2026-11-12', '2026-11-01', '2027-06-01']) {
    for (const [method, url] of [['GET', `/admin/challenges/${date}`], ['POST', `/admin/challenges/${date}`], ['POST', `/admin/challenges/${date}/reset`]] as const) {
      const res = await app.inject({ method, url, headers: method === 'POST' ? FORM : AUTH, payload: method === 'POST' ? body() : undefined });
      assert.equal(res.statusCode, 400, `${method} ${url}`);
    }
    assert.equal(await store.get(date), null);
  }
  assert.equal((await app.inject({ method: 'GET', url: '/admin/challenges/tomorrow', headers: AUTH })).statusCode, 404);
  await app.close();
});

test('a form post from another site is refused', async () => {
  const { app, store } = make();
  const res = await app.inject({ method: 'POST', url: '/admin/challenges/2026-11-20', headers: { ...FORM, origin: 'https://evil.example', host: 'admin.example' }, payload: body() });
  assert.equal(res.statusCode, 403);
  assert.equal(await store.get('2026-11-20'), null);
  const same = await app.inject({ method: 'POST', url: '/admin/challenges/2026-11-20', headers: { ...FORM, origin: 'https://admin.example', host: 'admin.example' }, payload: body() });
  assert.equal(same.statusCode, 303);
  await app.close();
});

test('the public route falls back to the generator when the store fails', async () => {
  const broken: ChallengeStore = {
    get: async () => { throw new Error('db down'); },
    list: async () => [],
    set: async () => {},
    remove: async () => {},
  };
  const { app } = make(broken);
  const res = await app.inject({ method: 'GET', url: '/api/challenges/today?date=2026-11-12' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().challenges[0].title, challengesFor('2026-11-12').challenges[0].title);
  await app.close();
});
