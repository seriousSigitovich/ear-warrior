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
    ['GET', '/api/progress/melodies'],
    ['POST', '/api/progress/gamification'],
    ['GET', '/api/progress/gamification'],
    ['GET', '/api/progress/attempts'],
    ['PUT', '/api/progress/melodies/hotcrossbuns'],
    ['DELETE', '/api/progress/melodies/hotcrossbuns?updated_at=2026-10-30T10:00:00.000Z'],
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

const placeBody = (over: object = {}) => ({
  phrase: 2,
  phrases: 5,
  grades: [
    { note_results: [{ status: 'matched' }, { status: 'wrong' }], answer: [64, 62] },
    { note_results: [{ status: 'matched' }], answer: [60] },
  ],
  updated_at: '2026-10-30T10:00:00.000Z',
  ...over,
});
const putPlace = (headers: object, tune: string, body: object) =>
  app.inject({ method: 'PUT', url: `/api/progress/melodies/${tune}`, headers, payload: body });
const places = (headers: object) => app.inject({ method: 'GET', url: '/api/progress/melodies', headers });
const dropPlace = (headers: object, tune: string, at: string) =>
  app.inject({ method: 'DELETE', url: `/api/progress/melodies/${tune}?updated_at=${encodeURIComponent(at)}`, headers });

test('a saved place comes back in the list, with its first tries', async () => {
  const me = await signIn('a@x.co');
  const put = await putPlace(me, 'hotcrossbuns', placeBody());
  assert.equal(put.statusCode, 200, put.body);
  assert.deepEqual(put.json(), { ok: true, stored: true });
  const list = (await places(me)).json();
  assert.equal(list.ok, true);
  assert.deepEqual(list.melodies, [{ tune_id: 'hotcrossbuns', ...placeBody() }]);
});

test('the latest write wins: a stale one is acknowledged but not stored', async () => {
  const me = await signIn('a@x.co');
  await putPlace(me, 'hotcrossbuns', placeBody({ phrase: 3, updated_at: '2026-10-30T10:05:00.000Z' }));
  const stale = await putPlace(me, 'hotcrossbuns', placeBody({ phrase: 1, updated_at: '2026-10-30T10:00:00.000Z' }));
  assert.deepEqual(stale.json(), { ok: true, stored: false });
  assert.equal((await places(me)).json().melodies[0].phrase, 3);
});

test('a finished melody’s place is deleted, and an older write cannot bring it back', async () => {
  const me = await signIn('a@x.co');
  await putPlace(me, 'hotcrossbuns', placeBody());
  assert.equal((await dropPlace(me, 'hotcrossbuns', '2026-10-30T10:10:00.000Z')).statusCode, 200);
  assert.deepEqual((await places(me)).json().melodies, []);
  await putPlace(me, 'hotcrossbuns', placeBody({ updated_at: '2026-10-30T10:05:00.000Z' }));
  assert.deepEqual((await places(me)).json().melodies, []);
});

test('one account never sees another account’s places', async () => {
  const a = await signIn('a@x.co');
  const b = await signIn('b@x.co');
  await putPlace(a, 'hotcrossbuns', placeBody());
  assert.deepEqual((await places(b)).json().melodies, []);
});

test('malformed places and delete requests are a 400', async () => {
  const me = await signIn('a@x.co');
  const bad: [string, object][] = [
    ['hotcrossbuns', placeBody({ phrase: -1 })],
    ['hotcrossbuns', placeBody({ phrase: 5 })], // the phrase to continue at must exist
    ['hotcrossbuns', placeBody({ phrases: 0 })],
    ['hotcrossbuns', placeBody({ updated_at: 'yesterday' })],
    ['hotcrossbuns', placeBody({ grades: 'none' })],
    ['hotcrossbuns', placeBody({ grades: [{ note_results: 'x', answer: [] }] })],
    ['hotcrossbuns', placeBody({ grades: [{ note_results: [], answer: ['C4'] }] })],
    ['hotcrossbuns', placeBody({ grades: Array.from({ length: 101 }, () => ({ note_results: [], answer: [] })) })],
    ['Hot-Cross', placeBody()],
    ['x'.repeat(61), placeBody()],
  ];
  for (const [tune, body] of bad) {
    const res = await putPlace(me, tune, body);
    assert.equal(res.statusCode, 400, `${tune} ${JSON.stringify(body).slice(0, 60)}`);
  }
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/progress/melodies/hotcrossbuns', headers: me })).statusCode, 400);
  assert.equal((await dropPlace(me, 'hotcrossbuns', 'soon')).statusCode, 400);
});

const gameRows = {
  award: { kind: 'award', id: 'phrase:hotcrossbuns-7:0', data: { id: 'phrase:hotcrossbuns-7:0', kind: 'phrase', xp: 20, day: '2026-11-12', at: '2026-11-12T10:00:00.000Z', level: 'L1', accuracy: 100 } },
  completion: { kind: 'completion', id: 'att-1', data: { id: 'att-1', melodyId: 'hotcrossbuns-7', level: 'L1', accuracy: 90, hintsUsed: 0, completedAt: '2026-11-12T10:05:00.000Z', day: '2026-11-12' } },
  mastery: { kind: 'mastery', id: 'L1', data: { id: 'L1', level: 'L1', achievedAt: '2026-11-12T10:05:00.000Z' } },
};
const pushGame = (headers: object, rows: object[]) =>
  app.inject({ method: 'POST', url: '/api/progress/gamification', headers, payload: { rows } });
const pullGame = (headers: object, query = '') => app.inject({ method: 'GET', url: `/api/progress/gamification${query}`, headers });

test('pushed game rows come back, with their order number, and pushing them again changes nothing', async () => {
  const me = await signIn('a@x.co');
  const rows = [gameRows.award, gameRows.completion, gameRows.mastery];
  assert.equal((await pushGame(me, rows)).statusCode, 200);
  assert.equal((await pushGame(me, rows)).statusCode, 200);
  const body = (await pullGame(me)).json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.rows.map((r: { kind: string; id: string }) => [r.kind, r.id]), [['award', 'phrase:hotcrossbuns-7:0'], ['completion', 'att-1'], ['mastery', 'L1']]);
  assert.deepEqual(body.rows[0].data, gameRows.award.data);
  assert.equal(body.more, false);
  assert.equal(body.next, body.rows[2].seq);
});

test('game rows are read in pages after a cursor', async () => {
  const me = await signIn('a@x.co');
  const many = Array.from({ length: 5 }, (_, i) => ({ ...gameRows.award, id: `p${i}`, data: { ...gameRows.award.data, id: `p${i}` } }));
  await pushGame(me, many);
  const first = (await pullGame(me, '?limit=2')).json();
  assert.deepEqual([first.rows.length, first.more], [2, true]);
  const second = (await pullGame(me, `?after=${first.next}&limit=10`)).json();
  assert.deepEqual([second.rows.map((r: { id: string }) => r.id), second.more], [['p2', 'p3', 'p4'], false]);
});

test('one account never sees another account’s game rows', async () => {
  const a = await signIn('a@x.co');
  const b = await signIn('b@x.co');
  await pushGame(a, [gameRows.award]);
  assert.deepEqual((await pullGame(b)).json().rows, []);
});

test('malformed game rows are a 400 and none of the batch is stored', async () => {
  const me = await signIn('a@x.co');
  const bad: object[][] = [
    [{ ...gameRows.award, kind: 'trophy' }],
    [{ ...gameRows.award, id: 'other-id' }], // the row's own id must match
    [{ ...gameRows.award, data: { ...gameRows.award.data, xp: -5 } }],
    [{ ...gameRows.award, data: { ...gameRows.award.data, day: 'today' } }],
    [{ ...gameRows.completion, data: { ...gameRows.completion.data, accuracy: 140 } }],
    [{ ...gameRows.mastery, data: { ...gameRows.mastery.data, achievedAt: 'soon' } }],
    [gameRows.award, { kind: 'award' }],
    Array.from({ length: 501 }, (_, i) => ({ ...gameRows.award, id: `p${i}`, data: { ...gameRows.award.data, id: `p${i}` } })),
  ];
  for (const rows of bad) assert.equal((await pushGame(me, rows)).statusCode, 400, JSON.stringify(rows).slice(0, 80));
  assert.deepEqual((await pullGame(me)).json().rows, []);
  assert.equal((await pullGame(me, '?after=-1')).statusCode, 400);
  assert.equal((await pullGame(me, '?limit=0')).statusCode, 400);
});

test('attempts are pulled in pages after a cursor, with their note results', async () => {
  const me = await signIn('a@x.co');
  await postAttempt(me, attempt('hotcrossbuns-1', 'correct', '2026-10-30T10:00:00.000Z'));
  await postAttempt(me, attempt('frere3-2', 'incorrect', '2026-10-30T10:05:00.000Z'));
  await postAttempt(me, attempt('hotcrossbuns-3', 'incorrect', '2026-10-30T10:10:00.000Z'));
  const pull = (query: string) => app.inject({ method: 'GET', url: `/api/progress/attempts${query}`, headers: me });
  const first = (await pull('?limit=2')).json();
  assert.equal(first.ok, true);
  assert.deepEqual(first.attempts.map((a: { melody_id: string }) => a.melody_id), ['hotcrossbuns-1', 'frere3-2']);
  assert.equal(first.more, true);
  assert.deepEqual(first.attempts[0].note_results, [{ expected: 'E4', status: 'matched' }]);
  assert.deepEqual(Object.keys(first.attempts[0]).sort(), [
    'confidence', 'created_at', 'id', 'input_mode', 'low_confidence', 'melody_id', 'note_results', 'seq', 'session_id', 'timed_out', 'verdict',
  ]);
  const rest = (await pull(`?after=${first.next}`)).json();
  assert.deepEqual([rest.attempts.map((a: { melody_id: string }) => a.melody_id), rest.more], [['hotcrossbuns-3'], false]);
});
