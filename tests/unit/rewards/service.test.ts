import { createCheckQueue } from '../../../src/services/rewards/checkQueue';
import { createRewardsClient } from '../../../src/services/rewards/client';
import { createIdentity } from '../../../src/services/rewards/identity';
import { createRewardsService, VIEW_KEY } from '../../../src/services/rewards/service';
import { checkBody, memoryKv, scriptedFetch, stateBody } from './fixtures';

const NOW = new Date(2026, 10, 16, 10, 0, 0); // local time: the day key is the learner's local day
const input = (phrase = 0, played = [64, 62]) => ({ tuneId: 'mary', phrase, played });

function setup(
  script: Parameters<typeof scriptedFetch>[0],
  opts: { account?: string | null; kv?: ReturnType<typeof memoryKv> } = {},
) {
  const kv = opts.kv ?? memoryKv();
  const f = scriptedFetch(script);
  const client = createRewardsClient('https://api', f.impl);
  const identity = createIdentity({
    accountToken: async () => (opts.account === undefined ? 'acct' : opts.account),
    kv,
    client,
    deviceId: async () => 'dev_1',
  });
  let n = 0;
  const service = createRewardsService({
    client,
    identity,
    queue: createCheckQueue(kv),
    kv,
    now: () => NOW,
    newId: () => `id${++n}`,
  });
  return { service, kv, f };
}

describe('check', () => {
  it("sends the check and hands back the server's grade and payout, keeping nothing queued", async () => {
    const { service, f } = setup([{ status: 200, body: checkBody() }]);
    const out = await service.check(input());
    expect(out.kind).toBe('graded');
    if (out.kind === 'graded') expect(out.result.payout.xp).toBe(20);
    expect(f.calls[0].body).toEqual({
      check_id: 'id1',
      tune_id: 'mary',
      phrase: 0,
      played: [64, 62],
      checked_at: NOW.toISOString(),
      local_day: '2026-11-16',
    });
    expect(await service.pending()).toBe(0);
    expect(service.view()?.totalXp).toBe(20);
  });

  it('keeps a check the server could not be asked, and says so', async () => {
    const { service } = setup([new Error('offline')]);
    const out = await service.check(input());
    expect(out).toEqual({ kind: 'queued', checkId: 'id1' });
    expect(await service.pending()).toBe(1);
  });

  it('sends the waiting checks in order when it can, and tells whoever listens', async () => {
    const { service, f } = setup([
      new Error('offline'),
      { status: 200, body: checkBody() },
      { status: 200, body: checkBody() },
    ]);
    const answers: string[] = [];
    service.onResult((id) => answers.push(id));
    await service.check(input(0)); // queued
    expect(await service.pending()).toBe(1);
    await service.check(input(1)); // flush sends id1 then id2
    expect(f.calls.map((c) => (c.body as { check_id: string }).check_id)).toEqual([
      'id1',
      'id1',
      'id2',
    ]);
    expect(answers).toEqual(['id1', 'id2']);
    expect(await service.pending()).toBe(0);
  });

  it('does not let a later check overtake an earlier one that is still waiting', async () => {
    const { service, f } = setup([new Error('offline')]);
    await service.check(input(0));
    await service.check(input(1));
    expect(f.calls.map((c) => (c.body as { check_id: string }).check_id)).toEqual(['id1', 'id1']);
    expect(await service.pending()).toBe(2);
  });

  it('a check the server refuses is dropped, not kept for ever', async () => {
    const { service } = setup([{ status: 404 }]);
    expect(await service.check(input())).toEqual({ kind: 'rejected' });
    expect(await service.pending()).toBe(0);
  });

  it('survives the app being killed: a new service sends what the old one queued', async () => {
    const kv = memoryKv();
    await setup([new Error('offline')], { kv }).service.check(input());
    const next = setup([{ status: 200, body: checkBody() }], { kv });
    await next.service.flush();
    expect(await next.service.pending()).toBe(0);
    expect(next.service.view()?.totalXp).toBe(20);
  });

  it('a session the server does not know is replaced once, and the check is sent again under the new one', async () => {
    const kv = memoryKv();
    const { service, f } = setup(
      [
        { status: 200, body: { ok: true, token: 'anon1' } },
        { status: 401 },
        { status: 200, body: { ok: true, token: 'anon2' } },
        { status: 200, body: checkBody() },
      ],
      { account: null, kv },
    );
    const out = await service.check(input());
    expect(out.kind).toBe('graded');
    expect(f.calls.map((c) => c.url.replace('https://api', ''))).toEqual([
      '/api/auth/anonymous',
      '/api/progress/phrase',
      '/api/auth/anonymous',
      '/api/progress/phrase',
    ]);
    expect(f.calls[3].headers.Authorization).toBe('Bearer anon2');
  });

  it('keeps the check when there is no identity to send it under', async () => {
    const { service } = setup([{ status: 500 }], { account: null });
    expect((await service.check(input())).kind).toBe('queued');
  });
});

describe('help', () => {
  it('asks the server for the first note and the answer', async () => {
    const { service, f } = setup([
      { status: 200, body: { ok: true, first_midi: 64 } },
      { status: 200, body: { ok: true, notes: [64, 62] } },
    ]);
    expect(await service.hint('mary', 0)).toBe(64);
    expect(await service.answer('mary', 0)).toEqual([64, 62]);
    expect(f.calls[0].body).toEqual({ tune_id: 'mary', phrase: 0 });
  });
  it('gets nothing offline', async () => {
    const { service } = setup([new Error('offline')]);
    expect(await service.hint('mary', 0)).toBeNull();
    expect(await service.answer('mary', 0)).toBeNull();
  });
});

describe('the standing', () => {
  it('is read from the server, kept for the next launch, and announced to screens', async () => {
    const kv = memoryKv();
    const a = setup(
      [{ status: 200, body: stateBody({ ranks: [{ id: 'beginner', name: 'Beginner', xp: 0 }] }) }],
      { kv },
    );
    let told = 0;
    a.service.subscribe(() => told++);
    expect(a.service.view()).toBeNull();
    expect((await a.service.refresh())?.totalXp).toBe(20);
    expect(told).toBe(1);
    expect(a.f.calls[0].url).toContain('/api/progress/state?date=2026-11-16');

    const b = setup([new Error('offline')], { kv });
    await b.service.init();
    expect(b.service.view()).toMatchObject({ totalXp: 20, today: '2026-11-16' });
    expect(b.service.view()?.ranks).toEqual([{ id: 'beginner', name: 'Beginner', xp: 0 }]);
    expect(b.service.view()?.activeDays.has('2026-11-16')).toBe(true);
  });

  it('keeps the last standing when the server cannot be reached, and ignores a damaged copy', async () => {
    const a = setup([{ status: 200, body: stateBody() }, new Error('offline')]);
    await a.service.refresh();
    expect((await a.service.refresh())?.totalXp).toBe(20);
    const damaged = setup([new Error('x')], { kv: memoryKv({ [VIEW_KEY]: '{nope' }) });
    await damaged.service.init();
    expect(damaged.service.view()).toBeNull();
  });

  it('keeps the ranks list the server sent once an answer to a check (which carries none) arrives', async () => {
    const { service } = setup([
      { status: 200, body: stateBody({ ranks: [{ id: 'beginner', name: 'Beginner', xp: 0 }] }) },
      { status: 200, body: checkBody() },
    ]);
    await service.refresh();
    await service.check(input());
    expect(service.view()?.ranks).toHaveLength(1);
    expect(service.view()?.totalXp).toBe(20);
  });
});

describe('without a backend', () => {
  it('queues checks and has nothing else to say', async () => {
    const kv = memoryKv();
    const service = createRewardsService({
      client: null,
      identity: createIdentity({
        accountToken: async () => null,
        kv,
        client: null,
        deviceId: async () => 'd',
      }),
      queue: createCheckQueue(kv),
      kv,
      now: () => NOW,
      newId: () => 'x',
    });
    expect((await service.check(input())).kind).toBe('queued');
    expect(await service.hint('mary', 0)).toBeNull();
    expect(await service.refresh()).toBeNull();
  });
});
