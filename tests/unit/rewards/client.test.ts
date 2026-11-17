import { createRewardsClient, parseResult, parseView } from '../../../src/services/rewards/client';
import type { QueuedCheck } from '../../../src/services/rewards/types';
import { checkBody, scriptedFetch, stateBody } from './fixtures';

const item: QueuedCheck = {
  checkId: 'c1',
  tuneId: 'mary',
  phrase: 0,
  played: [64, 62],
  checkedAt: '2026-11-16T10:00:00.000Z',
  localDay: '2026-11-16',
};
const DAY = '2026-11-16';

describe('parseView', () => {
  it('reads the standing, with the week strip and whether today is in it', () => {
    const v = parseView(stateBody(), DAY)!;
    expect(v.totalXp).toBe(20);
    expect(v.rank).toEqual({
      id: 'beginner',
      name: 'Beginner',
      index: 0,
      next: { id: 'apprentice', name: 'Apprentice', xp: 100 },
      xpToNext: 80,
      pct: 20,
    });
    expect(v.streak).toEqual({ days: 1, practicedToday: true });
    expect([...v.activeDays]).toEqual(['2026-11-16']);
    expect(v.challenges[0]).toMatchObject({ id: 'melodies-3', rewardXp: 15, completed: false });
    expect(v.allChallengesDone).toBe(false);
    expect(v.dailyBonusXp).toBe(25);
  });
  it('says all challenges are done only when there are some and all are', () => {
    const done = {
      id: 'a',
      title: '',
      description: '',
      progress: 1,
      target: 1,
      reward_xp: 5,
      completed: true,
    };
    expect(parseView(stateBody({ challenges: [done, done] }), DAY)!.allChallengesDone).toBe(true);
    expect(parseView(stateBody({ challenges: [] }), DAY)!.allChallengesDone).toBe(false);
  });
  it('is null for something that is not a standing, and the top rank has no next', () => {
    expect(parseView({ rank: {} }, DAY)).toBeNull();
    expect(parseView(null, DAY)).toBeNull();
    expect(
      parseView(
        stateBody({
          rank: { id: 'mozart', name: 'Mozart', index: 6, next: null, xp_to_next: 0, pct: 100 },
        }),
        DAY,
      )!.rank.next,
    ).toBeNull();
  });
  it('a day not in the strip is not practised today', () => {
    expect(parseView(stateBody({ active_days: ['2026-11-15'] }), DAY)!.streak.practicedToday).toBe(
      false,
    );
  });
});

describe('parseResult', () => {
  it('reads the grade, the payout and the standing after it', () => {
    const r = parseResult(checkBody(), DAY)!;
    expect(r.grade).toMatchObject({ accuracy: 100, passed: true, verdict: 'correct' });
    expect(r.grade.noteResults[0]).toEqual({
      targetIndex: 0,
      status: 'matched',
      expectedMidi: 64,
      detectedMidi: 64,
      octaveMismatch: false,
    });
    expect(r.payout).toMatchObject({
      paid: true,
      xp: 20,
      levelMult: 1,
      attemptNo: 1,
      reason: null,
    });
    expect(r.view.totalXp).toBe(20);
    expect(r.rankUp).toBeNull();
    expect(r.streakExtended).toBe(true);
    expect(r.replay).toBe(false);
  });
  it('carries a rank-up, challenges paid and the all-done bonus', () => {
    const body = checkBody();
    Object.assign(body.state, {
      rank_up: { id: 'apprentice', name: 'Apprentice' },
      challenges_paid: [{ id: 'melodies-3', reward_xp: 15 }],
      all_bonus_xp: 25,
    });
    const r = parseResult(body, DAY)!;
    expect(r.rankUp).toEqual({ id: 'apprentice', name: 'Apprentice' });
    expect(r.challengesPaid).toEqual([{ id: 'melodies-3', rewardXp: 15 }]);
    expect(r.allBonusXp).toBe(25);
  });
  it('marks a wrong note in another octave', () => {
    const body = checkBody();
    body.grade.note_results = [
      { status: 'wrong', target_index: 0, expected_midi: 64, detected_midi: 76 },
    ];
    expect(parseResult(body, DAY)!.grade.noteResults[0].octaveMismatch).toBe(true);
  });
  it('names why a passed phrase paid nothing', () => {
    const body = checkBody();
    Object.assign(body.payout, { paid: false, xp: 0, reason: 'attempts' });
    expect(parseResult(body, DAY)!.payout).toMatchObject({ paid: false, reason: 'attempts' });
  });
  it('is null for an answer that is not a check result', () => {
    expect(parseResult({ ok: false }, DAY)).toBeNull();
    expect(parseResult(checkBody({ grade: null }), DAY)).toBeNull();
  });
});

describe('the client', () => {
  it('is null without a backend', () => expect(createRewardsClient(undefined)).toBeNull());

  it('sends a check with the id, the raw notes and the local day, under the token', async () => {
    const f = scriptedFetch([{ status: 200, body: checkBody() }]);
    const out = await createRewardsClient('https://api/', f.impl)!.check('tok', item);
    expect(out.kind).toBe('ok');
    expect(f.calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api/api/progress/phrase',
      headers: { Authorization: 'Bearer tok' },
    });
    expect(f.calls[0].body).toEqual({
      check_id: 'c1',
      tune_id: 'mary',
      phrase: 0,
      played: [64, 62],
      checked_at: item.checkedAt,
      local_day: DAY,
    });
  });

  it.each([
    ['no network', new Error('offline'), 'offline'],
    ['a server error', { status: 502 }, 'offline'],
    ['a rate limit', { status: 429 }, 'offline'],
    ['an unreadable answer', { status: 200, body: 'nope' }, 'offline'],
    ['a session the server does not know', { status: 401 }, 'unauthorized'],
    ['an unknown tune', { status: 404 }, 'rejected'],
    ['a bad body', { status: 400 }, 'rejected'],
  ] as const)('a check answered with %s is %s', async (_name, res, kind) => {
    const out = await createRewardsClient('https://api', scriptedFetch([res as never]).impl)!.check(
      'tok',
      item,
    );
    expect(out.kind).toBe(kind);
  });

  it('asks for a hint and the answer, and gets nothing when it cannot', async () => {
    const c = createRewardsClient(
      'https://api',
      scriptedFetch([
        { status: 200, body: { ok: true, first_midi: 64 } },
        { status: 200, body: { ok: true, notes: [64, 62] } },
        { status: 500 },
        new Error('x'),
      ]).impl,
    )!;
    expect(await c.hint('t', 'mary', 0)).toBe(64);
    expect(await c.answer('t', 'mary', 0)).toEqual([64, 62]);
    expect(await c.hint('t', 'mary', 0)).toBeNull();
    expect(await c.answer('t', 'mary', 0)).toBeNull();
  });

  it('reads the standing with the ranks list, or says the session is gone', async () => {
    const ranks = [
      { id: 'beginner', name: 'Beginner', xp: 0 },
      { id: 'apprentice', name: 'Apprentice', xp: 100 },
    ];
    const c = createRewardsClient(
      'https://api',
      scriptedFetch([{ status: 200, body: stateBody({ ranks }) }, { status: 401 }, new Error('x')])
        .impl,
    )!;
    const ok = await c.state('t', DAY);
    expect(ok !== 'unauthorized' && ok?.view.ranks).toEqual(ranks);
    expect(await c.state('t', DAY)).toBe('unauthorized');
    expect(await c.state('t', DAY)).toBeNull();
  });

  it('makes an anonymous identity for a device', async () => {
    const f = scriptedFetch([{ status: 200, body: { ok: true, token: 'anon' } }, { status: 500 }]);
    const c = createRewardsClient('https://api', f.impl)!;
    expect(await c.anonymous('dev_' + '0'.repeat(32))).toBe('anon');
    expect(f.calls[0].body).toEqual({ device_id: 'dev_' + '0'.repeat(32) });
    expect(await c.anonymous('dev_x')).toBeNull();
  });

  it('the one-time import is done once the server has it, or already had it', async () => {
    const c = createRewardsClient(
      'https://api',
      scriptedFetch([
        { status: 200 },
        { status: 409 },
        { status: 410 },
        { status: 502 },
        new Error('x'),
      ]).impl,
    )!;
    const p = [{ tuneId: 'mary', phrase: 0, accuracy: 100, at: '2026-11-01T10:00:00.000Z' }];
    expect([
      await c.legacyImport('t', p),
      await c.legacyImport('t', p),
      await c.legacyImport('t', p),
    ]).toEqual([true, true, true]);
    expect([await c.legacyImport('t', p), await c.legacyImport('t', p)]).toEqual([false, false]);
  });
});
