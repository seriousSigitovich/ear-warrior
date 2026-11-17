// The practice routes of spec 024 through Fastify's inject, with in-memory stores (no Postgres, no SMTP).
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { createMemoryStore } from '../auth/memoryStore.js';
import { createRecordingMailer } from '../auth/mailer.js';
import { hashToken } from '../auth/tokens.js';
import { createMemoryChallengeStore } from '../challenges/memoryStore.js';
import { createMemoryLedgerStore } from '../progress/ledgerMemoryStore.js';
import type { LedgerStore } from '../progress/ledger.js';
import { createMemoryProgressStore } from '../progress/memoryStore.js';
import { TUNES } from '../tunes/library.data.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import { phraseMidis } from '../tunes/notes.js';
import { seedTunes } from '../tunes/seed.js';
import type { TuneStore } from '../tunes/store.js';

const NOW = new Date('2026-11-16T10:00:00Z');
const DAY = '2026-11-16';
const DEV = 'dev_00000000000000000000000000000001';

let app: FastifyInstance;
let tunes: TuneStore;
let ledger: LedgerStore;
let auth: { authorization: string };
let userId: string;
let seq = 0;

const answerOf = (id: string, phrase: number): number[] => {
  const t = TUNES.find((x) => x.id === id)!;
  return phraseMidis(t.notes, [...t.phrases])![phrase];
};

beforeEach(async () => {
  tunes = createMemoryTuneStore();
  await seedTunes(tunes, NOW);
  for (const t of TUNES) {
    await tunes.setAudio(t.id, { url: `https://blob.example/${t.id}.m4a`, sha256: 'a'.repeat(64), bytes: 1000 }, NOW);
    if (t.id !== 'hiddentune') await tunes.setHidden(t.id, false, NOW);
  }
  await tunes.setHidden('mary', true, NOW); // a hidden tune
  ledger = createMemoryLedgerStore();
  const store = createMemoryStore();
  app = buildApp({
    auth: { store, mailer: createRecordingMailer(), now: () => NOW, config: () => ({ pepper: 'p' }), randomCode: () => 1 },
    progress: createMemoryProgressStore(),
    challengeStore: createMemoryChallengeStore(),
    tunes,
    ledger,
    now: () => NOW,
    logger: false,
  });
  const token = `tok${++seq}`;
  const r = await store.signIn({ email: `u${seq}@x.co`, deviceId: DEV, tokenHash: hashToken(token), now: NOW });
  userId = r.userId;
  auth = { authorization: `Bearer ${token}` };
});

const check = (tune: string, phrase: number, played: number[], over: Record<string, unknown> = {}, headers = auth) =>
  app.inject({
    method: 'POST',
    url: '/api/progress/phrase',
    headers,
    payload: { check_id: `c${++seq}`, tune_id: tune, phrase, played, checked_at: NOW.toISOString(), local_day: DAY, ...over },
  });
const perfect = (tune: string, phrase: number, over: Record<string, unknown> = {}) => check(tune, phrase, answerOf(tune, phrase), over);
const post = (url: string, payload: object, headers = auth) => app.inject({ method: 'POST', url, headers, payload });

test('without a session every route answers 401', async () => {
  for (const [method, url] of [['POST', '/api/progress/phrase'], ['POST', '/api/phrase/hint'], ['POST', '/api/phrase/answer'], ['GET', '/api/progress/state']] as const) {
    const res = await app.inject({ method, url, payload: method === 'POST' ? {} : undefined });
    assert.equal(res.statusCode, 401, url);
  }
});

test('a perfect first check: graded, paid, ranked, streak started', async () => {
  const res = await perfect('hotcrossbuns', 0);
  assert.equal(res.statusCode, 200, res.body);
  const b = res.json();
  assert.equal(b.grade.accuracy, 100);
  assert.equal(b.grade.passed, true);
  assert.equal(b.grade.verdict, 'correct');
  assert.equal(b.grade.note_results.length, 6);
  assert.equal(b.payout.xp, 20);
  assert.equal(b.payout.paid, true);
  assert.equal(b.payout.level_mult, 1);
  assert.equal(b.payout.attempt_no, 1);
  assert.equal(b.payout.reason, null);
  assert.equal(b.state.total_xp, 20);
  assert.equal(b.state.rank.id, 'beginner');
  assert.equal(b.state.rank.xp_to_next, 80);
  assert.equal(b.state.rank_up, null);
  assert.deepEqual(b.state.streak, { days: 1, extended: true });
  assert.equal(b.state.challenges.length, 3);
});

test('resending a check id returns the same grade and payout and pays nothing more', async () => {
  const first = await perfect('hotcrossbuns', 0, { check_id: 'once' });
  const again = await perfect('hotcrossbuns', 0, { check_id: 'once' });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().replay, true);
  assert.deepEqual(again.json().grade, first.json().grade);
  assert.deepEqual(again.json().payout, first.json().payout);
  assert.equal(again.json().state.total_xp, 20);
  assert.equal(again.json().state.rank_up, null);
});

test('a phrase that already passed pays nothing again', async () => {
  await perfect('hotcrossbuns', 0);
  const b = (await perfect('hotcrossbuns', 0)).json();
  assert.equal(b.payout.xp, 0);
  assert.equal(b.payout.reason, 'already_paid');
  assert.equal(b.state.total_xp, 20);
});

test('attempts: first full, second half, third and later pass for nothing', async () => {
  const wrong = answerOf('hotcrossbuns', 0).map((m) => m + 1);
  const f1 = (await check('hotcrossbuns', 0, wrong)).json();
  assert.equal(f1.grade.passed, false);
  assert.equal(f1.payout.xp, 0);
  assert.equal(f1.payout.reason, 'below_pass');
  assert.equal((await perfect('hotcrossbuns', 0)).json().payout.xp, 10, 'second attempt');

  await check('hotcrossbuns', 1, []);
  await check('hotcrossbuns', 1, []);
  const third = (await perfect('hotcrossbuns', 1)).json();
  assert.equal(third.payout.attempt_no, 3);
  assert.equal(third.payout.xp, 0);
  assert.equal(third.payout.reason, 'attempts');
  assert.equal(third.grade.passed, true, 'still counts as passed');
});

test('the first-note hint halves the payout, the shown answer pays nothing', async () => {
  const hint = await post('/api/phrase/hint', { tune_id: 'hotcrossbuns', phrase: 0 });
  assert.equal(hint.statusCode, 200);
  assert.deepEqual(hint.json(), { ok: true, first_midi: answerOf('hotcrossbuns', 0)[0] });
  assert.equal((await perfect('hotcrossbuns', 0)).json().payout.xp, 10);

  const shown = await post('/api/phrase/answer', { tune_id: 'hotcrossbuns', phrase: 1 });
  assert.deepEqual(shown.json(), { ok: true, notes: answerOf('hotcrossbuns', 1) });
  const b = (await perfect('hotcrossbuns', 1)).json();
  assert.equal(b.payout.xp, 0);
  assert.equal(b.payout.reason, 'answer_shown');
  assert.equal(b.grade.passed, true);
});

test('a harder level pays proportionally more', async () => {
  const hard = TUNES.find((t) => t.rank === 9)!;
  const b = (await perfect(hard.id, 0)).json();
  assert.equal(b.payout.level_mult, 15);
  assert.equal(b.payout.xp, 300);
  assert.equal((await perfect('hotcrossbuns', 0)).json().payout.xp, 20);
});

test('the daily cap halves what is practised beyond it', async () => {
  const easy = TUNES.filter((t) => t.rank === 1 && t.id !== 'mary');
  const paid: number[] = [];
  for (const t of easy) {
    for (let p = 0; p < t.phrases.length; p++) {
      const b = (await perfect(t.id, p)).json();
      paid.push(b.payout.xp);
      if (paid.length >= 17) break;
    }
    if (paid.length >= 17) break;
  }
  assert.deepEqual(paid.slice(0, 15), new Array(15).fill(20), 'the first 300 base XP in full');
  assert.deepEqual(paid.slice(15), [10, 10], 'beyond it at half');
});

test('a rank-up is announced once, on the check that crossed the threshold', async () => {
  const easy = TUNES.filter((t) => t.rank === 1 && t.id !== 'mary');
  const ups: (string | null)[] = [];
  for (const t of easy.slice(0, 3)) {
    for (let p = 0; p < t.phrases.length; p++) ups.push((await perfect(t.id, p)).json().state.rank_up?.id ?? null);
  }
  assert.deepEqual(ups.filter(Boolean), ['apprentice']);
  assert.equal(ups.indexOf('apprentice'), 4, 'the fifth phrase brings 100 XP');
});

test('the shown answer and hint endpoints, unknown or hidden tunes, bad input', async () => {
  assert.equal((await post('/api/phrase/hint', { tune_id: 'nope', phrase: 0 })).statusCode, 404);
  assert.equal((await post('/api/phrase/hint', { tune_id: 'hotcrossbuns', phrase: 9 })).statusCode, 404);
  assert.equal((await post('/api/phrase/answer', { tune_id: 'mary', phrase: 0 })).statusCode, 404, 'hidden tune');
  assert.equal((await perfect('mary', 0)).statusCode, 404);
  assert.equal((await post('/api/phrase/hint', { tune_id: 'Bad-Id', phrase: 0 })).statusCode, 400);
  assert.equal((await check('hotcrossbuns', 0, [999])).statusCode, 400);
  assert.equal((await check('hotcrossbuns', 0, new Array(65).fill(60))).statusCode, 400);
  assert.equal((await post('/api/progress/phrase', { tune_id: 'hotcrossbuns' })).statusCode, 400);
});

test('an answer revealed after the phrase passed costs nothing and is not recorded', async () => {
  await perfect('hotcrossbuns', 0);
  assert.equal((await post('/api/phrase/answer', { tune_id: 'hotcrossbuns', phrase: 0 })).statusCode, 200);
  assert.equal((await perfect('hotcrossbuns', 0)).json().payout.reason, 'already_paid');
});

test('the learner\'s local day is kept within what a clock can say', async () => {
  await perfect('hotcrossbuns', 0, { local_day: '2030-01-01' });
  await perfect('hotcrossbuns', 1, { local_day: '2026-11-17' });
  await perfect('twinkle', 0, { local_day: '2026-11-10' });
  const { days } = await ledger.totals(userId);
  assert.deepEqual(days, ['2026-11-10', '2026-11-16', '2026-11-17']);
});

test('challenges are paid from accepted phrases, once, and the all-done bonus with them', async () => {
  const challengeStore = createMemoryChallengeStore();
  await challengeStore.set({
    date: DAY,
    allBonusXp: 25,
    challenges: [
      { id: 'melodies-1', type: 'melodies', target: 1, rewardXp: 10, title: 'One', description: 'One melody' },
      { id: 'accuracy-90', type: 'accuracy', target: 90, rewardXp: 20, title: '90', description: 'Reach 90%' },
      { id: 'melodies-2', type: 'melodies', target: 2, rewardXp: 15, title: 'Two', description: 'Two melodies' },
    ],
  });
  const store = createMemoryStore();
  const local = buildApp({
    auth: { store, mailer: createRecordingMailer(), now: () => NOW, config: () => ({ pepper: 'p' }), randomCode: () => 1 },
    progress: createMemoryProgressStore(),
    challengeStore,
    tunes,
    ledger: createMemoryLedgerStore(),
    now: () => NOW,
    logger: false,
  });
  await store.signIn({ email: 'c@x.co', deviceId: DEV, tokenHash: hashToken('ctok'), now: NOW });
  const h = { authorization: 'Bearer ctok' };
  const go = (tune: string, phrase: number) =>
    local.inject({ method: 'POST', url: '/api/progress/phrase', headers: h, payload: { check_id: `x${++seq}`, tune_id: tune, phrase, played: answerOf(tune, phrase), checked_at: NOW.toISOString(), local_day: DAY } });

  assert.equal((await go('hotcrossbuns', 0)).json().state.challenges_paid.length, 0);
  const done = (await go('hotcrossbuns', 1)).json();
  assert.deepEqual(done.state.challenges_paid, [{ id: 'melodies-1', reward_xp: 10 }, { id: 'accuracy-90', reward_xp: 20 }]);
  assert.equal(done.state.total_xp, 40 + 30);
  assert.equal(done.state.all_bonus_xp, 0);

  await go('twinkle', 0);
  const last = TUNES.find((t) => t.id === 'twinkle')!.phrases.length - 1;
  let final = (await go('twinkle', 0)).json();
  for (let p = 1; p <= last; p++) final = (await go('twinkle', p)).json();
  assert.deepEqual(final.state.challenges_paid, [{ id: 'melodies-2', reward_xp: 15 }]);
  assert.equal(final.state.all_bonus_xp, 25);
  const again = (await go('hotcrossbuns', 0)).json();
  assert.deepEqual(again.state.challenges_paid, [], 'nothing is paid twice');
});

test('GET /api/progress/state: total, rank, streak, challenges and which phrases passed', async () => {
  await perfect('hotcrossbuns', 0);
  await check('hotcrossbuns', 1, []);
  const res = await app.inject({ method: 'GET', url: `/api/progress/state?date=${DAY}`, headers: auth });
  assert.equal(res.statusCode, 200, res.body);
  const b = res.json();
  assert.equal(b.total_xp, 20);
  assert.equal(b.rank.id, 'beginner');
  assert.equal(b.streak.days, 1);
  assert.deepEqual(b.phrases, { hotcrossbuns: ['passed', 'open'] });
  assert.equal(b.challenges.length, 3);
  assert.deepEqual(b.ranks.map((r: { id: string }) => r.id), ['beginner', 'apprentice', 'listener', 'musician', 'virtuoso', 'maestro', 'mozart']);
  assert.equal(b.ranks[1].xp, 100);
  assert.deepEqual(b.active_days, [DAY]);
  assert.equal(typeof b.daily_bonus_xp, 'number');
  assert.deepEqual(b.rank.next, { id: 'apprentice', name: 'Apprentice', xp: 100 });
  assert.equal((await app.inject({ method: 'GET', url: '/api/progress/state?date=nonsense', headers: auth })).statusCode, 400);
});

test('a fresh account has nothing', async () => {
  const b = (await app.inject({ method: 'GET', url: `/api/progress/state?date=${DAY}`, headers: auth })).json();
  assert.equal(b.total_xp, 0);
  assert.equal(b.streak.days, 0);
  assert.deepEqual(b.phrases, {});
});

test('a store failure answers 502 and leaks nothing', async () => {
  ledger.recordCheck = async () => {
    throw new Error('db down');
  };
  const res = await perfect('hotcrossbuns', 0);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { ok: false, error: 'store_failed' });
});

test('SC-001: rows an old app pushes as awards never change XP or rank, and the route is gone after the cutover', async () => {
  const forged = { rows: [{ kind: 'award', id: 'phrase:hotcrossbuns-1:0', data: { id: 'phrase:hotcrossbuns-1:0', kind: 'phrase', xp: 1000, day: DAY, at: NOW.toISOString() } }] };
  const push = await app.inject({ method: 'POST', url: '/api/progress/gamification', headers: auth, payload: forged });
  assert.equal(push.statusCode, 200);
  const b = (await app.inject({ method: 'GET', url: `/api/progress/state?date=${DAY}`, headers: auth })).json();
  assert.equal(b.total_xp, 0);
  assert.equal(b.rank.id, 'beginner');

  process.env.GAMIFICATION_GONE = '1';
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/api/progress/gamification', headers: auth, payload: forged })).statusCode, 410);
    assert.equal((await app.inject({ method: 'GET', url: '/api/progress/gamification', headers: auth })).statusCode, 410);
    assert.equal((await app.inject({ method: 'POST', url: '/api/progress/gamification', payload: forged })).statusCode, 401, 'still 401 without a session');
  } finally {
    delete process.env.GAMIFICATION_GONE;
  }
});

const legacy = (phrases: object[], headers = auth) => app.inject({ method: 'POST', url: '/api/progress/legacy-import', headers, payload: { phrases } });
const old = (tune_id: string, phrase: number, accuracy: number) => ({ tune_id, phrase, accuracy, at: '2026-11-01T10:00:00.000Z' });

test('legacy import: the server pays the accuracies as first attempts, once per identity', async () => {
  const res = await legacy([old('hotcrossbuns', 0, 100), old('hotcrossbuns', 1, 95), old('twinkle', 0, 60)]);
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().imported, 2);
  assert.ok(res.json().total_xp >= 35, 'the two phrases at 20 and 15, perhaps with the challenges they completed');
  assert.equal((await perfect('hotcrossbuns', 0)).json().payout.reason, 'already_paid', 'the phrase counts as passed');
  assert.equal((await legacy([old('twinkle', 0, 100)])).statusCode, 409, 'a second import is refused');
  assert.equal((await perfect('twinkle', 0)).json().payout.xp, 20, 'and pays nothing it did not already');
});

test('legacy import: bad bodies, the cutoff and a missing session', async () => {
  assert.equal((await legacy([{ tune_id: 'Bad-Id', phrase: 0, accuracy: 100, at: NOW.toISOString() }])).statusCode, 400);
  assert.equal((await legacy([{ tune_id: 'twinkle', phrase: 0, accuracy: 101, at: NOW.toISOString() }])).statusCode, 400);
  assert.equal((await legacy(new Array(501).fill(old('twinkle', 0, 100)))).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/progress/legacy-import', payload: { phrases: [] } })).statusCode, 401);
  process.env.LEGACY_IMPORT_UNTIL = '2026-11-01';
  try {
    assert.equal((await legacy([old('twinkle', 0, 100)])).statusCode, 410);
  } finally {
    delete process.env.LEGACY_IMPORT_UNTIL;
  }
});

test('legacy import: the daily cap and the level multiplier apply, nothing is paid for unknown tunes', async () => {
  const hard = TUNES.find((t) => t.rank === 9)!;
  const res = await legacy([old(hard.id, 0, 100), old('nope', 0, 100)]);
  assert.equal(res.json().imported, 1);
  assert.ok(res.json().total_xp >= 300);
});
