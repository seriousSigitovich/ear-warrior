// Anonymous identities and their merge into an account at sign-in (spec 024, FR-021), through Fastify's inject.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createMemoryStore } from '../auth/memoryStore.js';
import { createRecordingMailer, type RecordingMailer } from '../auth/mailer.js';
import { createMemoryChallengeStore } from '../challenges/memoryStore.js';
import { createMemoryLedgerStore } from '../progress/ledgerMemoryStore.js';
import { createMemoryProgressStore } from '../progress/memoryStore.js';
import { TUNES } from '../tunes/library.data.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import { phraseMidis } from '../tunes/notes.js';
import { seedTunes } from '../tunes/seed.js';

const NOW = new Date('2026-11-16T10:00:00Z');
const DAY = '2026-11-16';
const DEV = 'dev_00000000000000000000000000000001';
const DEV2 = 'dev_00000000000000000000000000000002';

let app: FastifyInstance;
let mailer: RecordingMailer;
let clock: Date;
let n = 0;

beforeEach(async () => {
  clock = new Date(NOW);
  mailer = createRecordingMailer();
  const tunes = createMemoryTuneStore();
  await seedTunes(tunes, NOW);
  for (const t of TUNES) {
    await tunes.setAudio(t.id, { url: `https://blob.example/${t.id}.m4a`, sha256: 'a'.repeat(64), bytes: 1 }, NOW);
    await tunes.setHidden(t.id, false, NOW);
  }
  app = buildApp({
    auth: { store: createMemoryStore(), mailer, now: () => clock, config: () => ({ pepper: 'p' }), randomCode: () => 123456 },
    progress: createMemoryProgressStore(),
    ledger: createMemoryLedgerStore(),
    challengeStore: createMemoryChallengeStore(),
    tunes,
    now: () => NOW,
    logger: false,
  });
});

const anonymous = async (device = DEV) => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/anonymous', payload: { device_id: device } });
  assert.equal(res.statusCode, 200, res.body);
  return { authorization: `Bearer ${res.json().token}` };
};
const phrase = (headers: object, tune: string, p: number) => {
  const t = TUNES.find((x) => x.id === tune)!;
  return app.inject({
    method: 'POST',
    url: '/api/progress/phrase',
    headers,
    payload: { check_id: `k${++n}`, tune_id: tune, phrase: p, played: phraseMidis(t.notes, [...t.phrases])![p], checked_at: NOW.toISOString(), local_day: DAY },
  });
};
const state = (headers: object) => app.inject({ method: 'GET', url: `/api/progress/state?date=${DAY}`, headers });

async function signIn(email: string, device = DEV) {
  await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email }, remoteAddress: '10.0.0.1' });
  clock = new Date(clock.getTime() + 61_000);
  return app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email, code: mailer.sent.at(-1)!.code, device_id: device } });
}

test('an anonymous identity gets a token that works for practice, without any account', async () => {
  const h = await anonymous();
  assert.equal((await phrase(h, 'hotcrossbuns', 0)).json().payout.xp, 20);
  assert.equal((await state(h)).json().total_xp, 20);
});

test('a device asking twice keeps one identity (the second token sees the same XP)', async () => {
  const first = await anonymous();
  await phrase(first, 'hotcrossbuns', 0);
  const second = await anonymous();
  assert.notEqual(first.authorization, second.authorization);
  assert.equal((await state(second)).json().total_xp, 20);
});

test('another device is another identity', async () => {
  const a = await anonymous(DEV);
  await phrase(a, 'hotcrossbuns', 0);
  assert.equal((await state(await anonymous(DEV2))).json().total_xp, 0);
});

test('a malformed device id is refused', async () => {
  for (const device_id of ['', 'x', 'dev_short', 'DEV_' + '0'.repeat(32)]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/anonymous', payload: { device_id } })).statusCode, 400, device_id);
  }
});

test('signing in on the device merges its anonymous XP into the account; the anonymous token is then dead', async () => {
  const anon = await anonymous();
  await phrase(anon, 'hotcrossbuns', 0);
  await phrase(anon, 'hotcrossbuns', 1);
  const earned = (await state(anon)).json().total_xp;
  assert.ok(earned >= 40, 'at least the two phrases');

  const res = await signIn('a@x.co');
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().merged, true);
  const account = { authorization: `Bearer ${res.json().token}` };
  const s = (await state(account)).json();
  assert.equal(s.total_xp, earned, 'everything the anonymous identity had, phrases and challenge rewards');
  assert.deepEqual(s.phrases, { hotcrossbuns: ['passed', 'passed'] });
  assert.equal((await state(anon)).statusCode, 401);
});

test('a phrase paid anonymously and again on the account counts once', async () => {
  const anon = await anonymous();
  await phrase(anon, 'twinkle', 0);
  const account = { authorization: `Bearer ${(await signIn('a@x.co')).json().token}` };
  const before = (await state(account)).json().total_xp;
  assert.equal((await phrase(account, 'twinkle', 0)).json().payout.reason, 'already_paid');
  assert.equal((await state(account)).json().total_xp, before);
});

test('signing in without an anonymous identity merges nothing; another device\'s identity is left alone', async () => {
  assert.equal((await signIn('a@x.co')).json().merged, false);
  const other = await anonymous(DEV2);
  await phrase(other, 'hotcrossbuns', 0);
  assert.equal((await signIn('b@x.co', DEV)).json().merged, false);
  assert.equal((await state(other)).json().total_xp, 20);
});

test('a merge failure never blocks the sign-in', async () => {
  const failing = buildApp({
    auth: {
      store: createMemoryStore(),
      mailer,
      now: () => clock,
      config: () => ({ pepper: 'p' }),
      randomCode: () => 123456,
      afterSignIn: async () => {
        throw new Error('boom');
      },
    },
    progress: createMemoryProgressStore(),
    ledger: createMemoryLedgerStore(),
    challengeStore: createMemoryChallengeStore(),
    tunes: createMemoryTuneStore(),
    logger: false,
  });
  await failing.inject({ method: 'POST', url: '/api/auth/request', payload: { email: 'z@x.co' }, remoteAddress: '10.0.0.9' });
  clock = new Date(clock.getTime() + 61_000);
  const res = await failing.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'z@x.co', code: mailer.sent.at(-1)!.code, device_id: DEV } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().merged, false);
});
