import {
  RowStore,
  createInMemoryRowStore,
  XP_AWARDS_TABLE,
  MASTERY_TABLE,
} from '../../../src/services/storage/db';
import { GameRow, ProgressClient, RemoteGameRow } from '../../../src/services/progress/client';
import { createGamificationService } from '../../../src/services/gamification/service';
import { createGameSync } from '../../../src/services/gamification/sync';
import { allLevels } from '../../../src/services/melody/levels';

const L1 = allLevels()[0].id;
const nov = (d: number, h = 12) => new Date(2026, 10, d, h);

/** The server as the app sees it: rows by kind and id, an arrival order, the earlier mastery date winning. */
function fakeServer(pageSize = 500) {
  const rows = new Map<string, RemoteGameRow>();
  let seq = 0;
  let reachable = true;
  const calls: string[] = [];
  const client = {
    async pushGame(_token: string, batch: GameRow[]) {
      if (!reachable) return false;
      calls.push(`push ${batch.length}`);
      for (const r of batch) {
        const key = `${r.kind}|${r.id}`;
        const had = rows.get(key);
        const earlier =
          r.kind === 'mastery' && had && String(r.data.achievedAt) < String(had.data.achievedAt);
        if (!had || earlier) rows.set(key, { ...r, seq: ++seq });
      }
      return true;
    },
    async pullGame(_token: string, after: number) {
      if (!reachable) return null;
      calls.push(`pull ${after}`);
      const all = [...rows.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq);
      const page = all.slice(0, pageSize);
      return {
        rows: page,
        next: page.length ? page[page.length - 1].seq : after,
        more: all.length > pageSize,
      };
    },
  } as unknown as ProgressClient;
  return { client, rows, calls, down: () => (reachable = false), up: () => (reachable = true) };
}

/** One device: its own store, its own clock, signed in or not. */
function device(server: ReturnType<typeof fakeServer>, token: string | null = 'tok', at = nov(12)) {
  const store: RowStore = createInMemoryRowStore();
  const service = createGamificationService({ store, now: () => at });
  const sync = createGameSync({ store, client: server.client, getToken: async () => token });
  return { store, service, sync };
}

const earn = async (d: ReturnType<typeof device>, tag: string, accuracy = 100) => {
  await d.service.phraseChecked({ melodyId: `${tag}-1`, phrase: 0, accuracy, level: L1 });
};
const finishMelody = (d: ReturnType<typeof device>, id: string) =>
  d.service.exerciseCompleted({ id, melodyId: `m${id}-1`, level: L1, accuracy: 100, hintsUsed: 0 });

describe('game sync', () => {
  test('what a device earned goes up, and a fresh device of the account sees the same figures', async () => {
    const server = fakeServer();
    const a = device(server);
    await earn(a, 'tuneA');
    for (let i = 0; i < 10; i++) await finishMelody(a, `a${i}`); // mastery of the first level
    await a.sync.sync();

    const b = device(server);
    expect(await b.sync.sync()).toBe(true);
    const mine = await a.service.snapshot();
    const theirs = await b.service.snapshot();
    expect(theirs.totalXp).toBe(mine.totalXp);
    expect(theirs.rank).toEqual(mine.rank);
    expect(theirs.mastery.map((m) => m.mastered)).toEqual(mine.mastery.map((m) => m.mastered));
    expect(theirs.streak).toEqual(mine.streak);
    expect(theirs.challenges.map((c) => c.progress)).toEqual(
      mine.challenges.map((c) => c.progress),
    );
  });

  test('a row is sent once: once the server has it, the next sync sends nothing', async () => {
    const server = fakeServer();
    const a = device(server);
    await earn(a, 'tuneA');
    await a.sync.sync();
    await a.sync.sync();
    expect(server.calls.filter((c) => c.startsWith('push'))).toEqual(['push 1']);
  });

  test('syncing twice changes nothing', async () => {
    const server = fakeServer();
    const a = device(server);
    await earn(a, 'tuneA');
    await a.sync.sync();
    const before = await a.service.snapshot();
    expect(await a.sync.sync()).toBe(false);
    expect((await a.service.snapshot()).totalXp).toBe(before.totalXp);
  });

  test('two devices that both earned before syncing end up with both sets, each counted once', async () => {
    const server = fakeServer();
    const a = device(server);
    const b = device(server);
    await earn(a, 'tuneA');
    await earn(b, 'tuneB');
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();
    expect((await a.service.snapshot()).totalXp).toBe(40);
    expect((await b.service.snapshot()).totalXp).toBe(40);
  });

  test('the same reward made on two devices (one day’s challenge) counts once', async () => {
    const server = fakeServer();
    const a = device(server);
    const b = device(server);
    for (let i = 0; i < 3; i++) await finishMelody(a, `a${i}`); // pays "practice" (10) and "accuracy" (20) on a
    for (let i = 0; i < 3; i++) await finishMelody(b, `b${i}`); // pays the same challenge row on b
    await a.sync.sync();
    await b.sync.sync();
    await a.sync.sync();
    const challengeRows = [...server.rows.values()].filter((r) => r.id.startsWith('challenge:'));
    // a hundred-percent melody also pays the accuracy challenge: one row per challenge, not one per device
    expect(challengeRows.map((r) => r.id).sort()).toEqual([
      'challenge:2026-11-12:accuracy',
      'challenge:2026-11-12:practice',
    ]);
    expect((await a.service.snapshot()).totalXp).toBe((await b.service.snapshot()).totalXp);
    expect((await a.service.snapshot()).totalXp).toBe(30);
  });

  test('mastery reached on two devices keeps the earlier date', async () => {
    const server = fakeServer();
    const early = device(server, 'tok', nov(10));
    const late = device(server, 'tok', nov(12));
    for (let i = 0; i < 10; i++) await finishMelody(late, `l${i}`);
    for (let i = 0; i < 10; i++) await finishMelody(early, `e${i}`);
    await late.sync.sync();
    await early.sync.sync();
    await late.sync.sync();
    const date = (await late.service.snapshot()).mastery[0].achievedAt;
    expect(date).toBe((await early.service.snapshot()).mastery[0].achievedAt);
    expect(new Date(date as string).getDate()).toBe(10);
  });

  test('pages are read to the end, and the cursor is kept so the next sync asks only for what is new', async () => {
    const server = fakeServer(2);
    const a = device(server);
    for (let i = 0; i < 5; i++) await earn(a, `t${i}`);
    await a.sync.sync();
    const b = device(server);
    await b.sync.sync();
    expect((await b.service.snapshot()).totalXp).toBe(100);
    server.calls.length = 0;
    await earn(a, 'later');
    await a.sync.sync();
    await b.sync.sync();
    const pulls = server.calls.filter((c) => c.startsWith('pull'));
    expect(pulls[pulls.length - 1]).not.toBe('pull 0');
    expect((await b.service.snapshot()).totalXp).toBe(120);
  });

  test('offline, rows wait and nothing breaks; online again they go up', async () => {
    const server = fakeServer();
    const a = device(server);
    server.down();
    await earn(a, 'tuneA');
    expect(await a.sync.sync()).toBe(false);
    expect(server.rows.size).toBe(0);
    server.up();
    await a.sync.sync();
    expect(server.rows.size).toBe(1);
  });

  test('an anonymous learner syncs nothing, and what was earned goes up after signing in', async () => {
    const server = fakeServer();
    const store = createInMemoryRowStore();
    const service = createGamificationService({ store, now: () => nov(12) });
    let token: string | null = null;
    const sync = createGameSync({ store, client: server.client, getToken: async () => token });
    await service.phraseChecked({ melodyId: 'x-1', phrase: 0, accuracy: 100, level: L1 });
    expect(await sync.sync()).toBe(false);
    expect(server.calls).toEqual([]);
    token = 'tok';
    await sync.sync();
    expect(server.rows.size).toBe(1);
  });

  test('rows made before sync existed (no flag) are sent', async () => {
    const server = fakeServer();
    const a = device(server);
    await a.store.insert(XP_AWARDS_TABLE, 'phrase:old-1:0', {
      id: 'phrase:old-1:0',
      kind: 'phrase',
      xp: 10,
      day: '2026-11-01',
      at: '2026-11-01T10:00:00.000Z',
    });
    await a.sync.sync();
    expect(server.rows.has('award|phrase:old-1:0')).toBe(true);
    expect(await a.store.getById(XP_AWARDS_TABLE, 'phrase:old-1:0')).toMatchObject({
      synced: true,
    });
  });

  test('the server’s earlier mastery replaces a later local one', async () => {
    const server = fakeServer();
    const a = device(server);
    server.rows.set('mastery|L1', {
      kind: 'mastery',
      id: 'L1',
      data: { id: 'L1', level: 'L1', achievedAt: '2026-11-01T10:00:00.000Z' },
      seq: 1,
    });
    await a.store.insert(MASTERY_TABLE, 'L1', {
      id: 'L1',
      level: 'L1',
      achievedAt: '2026-11-12T10:00:00.000Z',
      synced: true,
    });
    await a.sync.sync();
    expect(await a.store.getById(MASTERY_TABLE, 'L1')).toMatchObject({
      achievedAt: '2026-11-01T10:00:00.000Z',
    });
  });
});
