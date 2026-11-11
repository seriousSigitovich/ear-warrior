import { NoteResult } from '../../../src/models';
import { PhraseSave, RemotePlace } from '../../../src/lib/melodyProgress';
import { createInMemoryRowStore } from '../../../src/services/storage/db';
import { ProgressClient } from '../../../src/services/progress/client';
import { createMelodyProgressRepository } from '../../../src/services/progress/melodyProgress';
import { createMelodySync } from '../../../src/services/progress/melodySync';

const save = (...midis: number[]): PhraseSave => ({
  noteResults: midis.map<NoteResult>((m, i) => ({
    targetIndex: i,
    status: 'matched',
    expectedMidi: m,
    detectedMidi: m,
    octaveMismatch: false,
  })),
  answer: midis,
});

let t = Date.UTC(2026, 10, 12, 10, 0, 0);
const tick = () => new Date((t += 1000));

/** A server that keeps places the way the real one does: the latest write wins, a delete is remembered. */
function fakeServer() {
  const rows = new Map<string, RemotePlace & { deleted: boolean }>();
  let reachable = true;
  const log: string[] = [];
  const client = {
    async putMelody(_token: string, p: RemotePlace) {
      if (!reachable) return false;
      log.push(`put ${p.tuneId} ${p.phrase}`);
      const had = rows.get(p.tuneId);
      if (!had || Date.parse(had.updatedAt) <= Date.parse(p.updatedAt))
        rows.set(p.tuneId, { ...p, deleted: false });
      return true;
    },
    async deleteMelody(_token: string, tuneId: string, updatedAt: string) {
      if (!reachable) return false;
      log.push(`delete ${tuneId}`);
      const had = rows.get(tuneId);
      if (!had || Date.parse(had.updatedAt) <= Date.parse(updatedAt)) {
        rows.set(tuneId, { tuneId, phrase: 0, phrases: 1, grades: [], updatedAt, deleted: true });
      }
      return true;
    },
    async listMelodies() {
      if (!reachable) return null;
      return [...rows.values()]
        .filter((r) => !r.deleted)
        .map((r) => ({
          tuneId: r.tuneId,
          phrase: r.phrase,
          phrases: r.phrases,
          grades: r.grades,
          updatedAt: r.updatedAt,
        }));
    },
  } as unknown as ProgressClient;
  return { client, rows, log, down: () => (reachable = false), up: () => (reachable = true) };
}

function setup(token: string | null = 'tok') {
  const store = createInMemoryRowStore();
  const repo = createMelodyProgressRepository(store, tick);
  const server = fakeServer();
  const sync = createMelodySync({ repo, client: server.client, getToken: async () => token });
  return { store, repo, server, sync };
}

describe('melody places on the device', () => {
  test('saving keeps the place; leaving it again overwrites it; one per tune', async () => {
    const { repo } = setup();
    await repo.save('a', 5, [save(60)]);
    await repo.save('a', 5, [save(60), save(62)]);
    await repo.save('b', 3, []);
    expect((await repo.get('a'))?.phrase).toBe(2);
    expect((await repo.all()).map((p) => p.tuneId).sort()).toEqual(['a', 'b']);
  });

  test('clearing removes it from view and leaves a pending delete', async () => {
    const { repo } = setup();
    await repo.save('a', 5, [save(60)]);
    await repo.clear('a');
    expect(await repo.get('a')).toBeNull();
    expect(await repo.all()).toEqual([]);
    expect((await repo.pending()).map((p) => [p.tuneId, p.deleted])).toEqual([['a', true]]);
  });

  test('it survives a restart (a new repository over the same store)', async () => {
    const { store, repo } = setup();
    await repo.save('a', 5, [save(60), save(62)]);
    const again = createMelodyProgressRepository(store, tick);
    expect((await again.get('a'))?.grades).toEqual([save(60), save(62)]);
  });
});

describe('syncing with the server', () => {
  test('a saved place goes up and is then marked as synced', async () => {
    const { repo, server, sync } = setup();
    await repo.save('a', 5, [save(60)]);
    await sync.flush();
    expect(server.log).toEqual(['put a 1']);
    expect(await repo.pending()).toEqual([]);
    await sync.flush();
    expect(server.log).toEqual(['put a 1']); // nothing new to send
  });

  test('offline changes wait and go out later; nothing is lost', async () => {
    const { repo, server, sync } = setup();
    server.down();
    await repo.save('a', 5, [save(60)]);
    await sync.flush();
    expect((await repo.pending()).length).toBe(1);
    server.up();
    await sync.flush();
    expect(server.rows.get('a')?.phrase).toBe(1);
    expect(await repo.pending()).toEqual([]);
  });

  test('an anonymous learner keeps places on the device and sends them once signed in', async () => {
    const store = createInMemoryRowStore();
    const repo = createMelodyProgressRepository(store, tick);
    const server = fakeServer();
    let token: string | null = null;
    const sync = createMelodySync({ repo, client: server.client, getToken: async () => token });
    await repo.save('a', 5, [save(60)]);
    await sync.sync();
    expect(server.log).toEqual([]);
    token = 'tok';
    await sync.sync();
    expect(server.rows.get('a')?.phrase).toBe(1);
  });

  test('finishing a melody sends a delete, and the mark on the device goes away once the server has it', async () => {
    const { repo, server, sync } = setup();
    await repo.save('a', 5, [save(60)]);
    await sync.flush();
    await repo.clear('a');
    await sync.flush();
    expect(server.log).toEqual(['put a 1', 'delete a']);
    expect(server.rows.get('a')?.deleted).toBe(true);
    expect(await repo.pending()).toEqual([]);
  });

  test('another device’s place arrives on pull, and Continue can use it', async () => {
    const { repo, server, sync } = setup();
    server.rows.set('a', {
      tuneId: 'a',
      phrase: 3,
      phrases: 5,
      grades: [save(60), save(62), save(64)],
      updatedAt: new Date(t + 500).toISOString(),
      deleted: false,
    });
    await sync.sync();
    const p = await repo.get('a');
    expect(p?.phrase).toBe(3);
    expect(p?.grades).toHaveLength(3);
    expect(await repo.pending()).toEqual([]);
  });

  test('a melody finished on another device disappears here after a pull', async () => {
    const { repo, server, sync } = setup();
    await repo.save('a', 5, [save(60)]);
    await sync.sync();
    server.rows.set('a', {
      tuneId: 'a',
      phrase: 0,
      phrases: 1,
      grades: [],
      updatedAt: new Date(t + 500).toISOString(),
      deleted: true,
    });
    await sync.sync();
    expect(await repo.get('a')).toBeNull();
  });

  test('a change made while a sync is running is not lost', async () => {
    const { repo, server, sync } = setup();
    await repo.save('a', 5, [save(60)]);
    const sending = sync.flush();
    await repo.save('a', 5, [save(60), save(62)]);
    await sending;
    await sync.flush();
    expect(server.rows.get('a')?.phrase).toBe(2);
    expect(await repo.pending()).toEqual([]);
  });
});
