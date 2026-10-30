// Contract tests of /api/progress/*, through Fastify's inject with in-memory stores (no Postgres, no SMTP).
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createMemoryStore } from '../auth/memoryStore.js';
import { createRecordingMailer, type RecordingMailer } from '../auth/mailer.js';
import { createMemoryProgressStore } from '../progress/memoryStore.js';
import { RECENT_LIMIT } from '../progress/store.js';

const DEV = 'dev_00000000000000000000000000000001';

let clock: Date;
let mailer: RecordingMailer;
let app: FastifyInstance;

const wait = (seconds: number) => {
  clock = new Date(clock.getTime() + seconds * 1000);
};

beforeEach(() => {
  clock = new Date('2026-10-30T12:00:00Z');
  mailer = createRecordingMailer();
  app = buildApp({
    auth: { store: createMemoryStore(), mailer, now: () => clock, config: () => ({ pepper: 'test-pepper' }), randomCode: () => 123456 },
    progress: createMemoryProgressStore(),
    logger: false,
  });
});

async function signIn(email: string): Promise<{ authorization: string }> {
  await app.inject({ method: 'POST', url: '/api/auth/request', payload: { email }, remoteAddress: '10.0.0.1' });
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/verify',
    payload: { email, code: mailer.sent[mailer.sent.length - 1].code, device_id: DEV },
  });
  assert.equal(res.statusCode, 200, res.body);
  wait(61);
  return { authorization: `Bearer ${res.json().token}` };
}

let n = 0;
const attempt = (melodyId: string, verdict: 'correct' | 'incorrect', at: string) => ({
  id: `s_1-${++n}`,
  session_id: 's_1',
  melody_id: melodyId,
  verdict,
  confidence: 0.9,
  low_confidence: false,
  timed_out: false,
  input_mode: 'fretboard',
  note_results: [{ expected: 'E4', status: 'matched' }],
  created_at: at,
});

const postAttempt = (headers: object, body: object) =>
  app.inject({ method: 'POST', url: '/api/progress/attempts', headers, payload: body as object });
const history = (headers: object) => app.inject({ method: 'GET', url: '/api/progress/history', headers });

test('every progress route needs a live session', async () => {
  for (const [method, url] of [
    ['POST', '/api/progress/attempts'],
    ['GET', '/api/progress/history'],
    ['GET', '/api/progress/difficulty'],
    ['PUT', '/api/progress/difficulty'],
  ] as const) {
    const none = await app.inject({ method, url, payload: {} });
    assert.equal(none.statusCode, 401, `${method} ${url}`);
    const bad = await app.inject({ method, url, headers: { authorization: 'Bearer nope' }, payload: {} });
    assert.equal(bad.statusCode, 401, `${method} ${url}`);
    assert.deepEqual(bad.json(), { ok: false, error: 'invalid_session' });
  }
});

test('a posted attempt shows up in the history: mastered tunes and the latest tunes oldest first', async () => {
  const me = await signIn('a@x.co');
  await postAttempt(me, attempt('hotcrossbuns-111', 'correct', '2026-10-30T10:00:00.000Z'));
  await postAttempt(me, attempt('frere3-222', 'incorrect', '2026-10-30T10:05:00.000Z'));
  await postAttempt(me, attempt('hotcrossbuns-333', 'incorrect', '2026-10-30T10:10:00.000Z'));

  const res = await history(me);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true, mastered: ['hotcrossbuns'], recent: ['hotcrossbuns', 'frere3', 'hotcrossbuns'] });
});

test('posting the same attempt twice stores it once', async () => {
  const me = await signIn('a@x.co');
  const a = attempt('hotcrossbuns-1', 'correct', '2026-10-30T10:00:00.000Z');
  assert.equal((await postAttempt(me, a)).statusCode, 200);
  assert.equal((await postAttempt(me, a)).statusCode, 200);
  assert.deepEqual((await history(me)).json().recent, ['hotcrossbuns']);
});

test('the history holds only the latest attempts, not the whole past', async () => {
  const me = await signIn('a@x.co');
  for (let i = 0; i < RECENT_LIMIT + 5; i++) {
    const at = new Date(Date.UTC(2026, 9, 30, 10, 0, i)).toISOString();
    await postAttempt(me, attempt(i < 5 ? 'oldtune-1' : 'newtune-1', 'incorrect', at));
  }
  const { recent } = (await history(me)).json();
  assert.equal(recent.length, RECENT_LIMIT);
  assert.ok(!recent.includes('oldtune'));
});

test('one account never sees another account’s progress', async () => {
  const a = await signIn('a@x.co');
  const b = await signIn('b@x.co');
  await postAttempt(a, attempt('hotcrossbuns-1', 'correct', '2026-10-30T10:00:00.000Z'));
  assert.deepEqual((await history(b)).json(), { ok: true, mastered: [], recent: [] });
});

test('a malformed attempt is a 400', async () => {
  const me = await signIn('a@x.co');
  const res = await postAttempt(me, { ...attempt('hotcrossbuns-1', 'correct', '2026-10-30T10:00:00.000Z'), verdict: 'maybe' });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { ok: false, error: 'invalid_payload' });
});

const difficulty = { mode: 'adaptive', adaptive_rank: 3, fixed_rank: 1, streak_kind: 'correct', streak_count: 2 };

test('difficulty: 404 until saved, then the saved state, replaced by the next PUT', async () => {
  const me = await signIn('a@x.co');
  assert.equal((await app.inject({ method: 'GET', url: '/api/progress/difficulty', headers: me })).statusCode, 404);

  assert.equal((await app.inject({ method: 'PUT', url: '/api/progress/difficulty', headers: me, payload: difficulty })).statusCode, 200);
  const first = await app.inject({ method: 'GET', url: '/api/progress/difficulty', headers: me });
  assert.deepEqual(first.json(), { ok: true, ...difficulty });

  await app.inject({ method: 'PUT', url: '/api/progress/difficulty', headers: me, payload: { ...difficulty, adaptive_rank: 4, streak_count: 0 } });
  const second = await app.inject({ method: 'GET', url: '/api/progress/difficulty', headers: me });
  assert.equal(second.json().adaptive_rank, 4);
});

test('difficulty: a rank outside the ladder is a 400', async () => {
  const me = await signIn('a@x.co');
  const res = await app.inject({ method: 'PUT', url: '/api/progress/difficulty', headers: me, payload: { ...difficulty, adaptive_rank: 12 } });
  assert.equal(res.statusCode, 400);
});
