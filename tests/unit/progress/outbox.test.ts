import { Attempt } from '../../../src/models';
import { KeyValueStore } from '../../../src/lib/deviceId';
import { ProgressClient } from '../../../src/services/progress/client';
import { PROGRESS_OUTBOX_KEY, createProgressOutbox } from '../../../src/services/progress/outbox';

const attempt = (id: string): Attempt => ({
  id,
  sessionId: 's_1',
  melodyId: 'hotcrossbuns-1',
  detectedNotes: [],
  noteResults: [],
  verdict: 'correct',
  confidence: 1,
  lowConfidence: false,
  timedOut: false,
  createdAt: '2026-10-30T10:00:00.000Z',
});

function setup(opts: { token?: string | null; online?: boolean } = {}) {
  const state = { token: opts.token === undefined ? 'tok' : opts.token, online: opts.online ?? true };
  const data: Record<string, string> = {};
  const kv: KeyValueStore = {
    getItem: async (k) => (k in data ? data[k] : null),
    setItem: async (k, v) => void (data[k] = v),
  };
  const posted: string[] = [];
  const client = {
    postAttempt: async (_t: string, a: Attempt) => {
      if (!state.online) return false;
      posted.push(a.id);
      return true;
    },
  } as unknown as ProgressClient;
  const known = new Map<string, Attempt>();
  const outbox = createProgressOutbox({ client, getToken: async () => state.token, kv, getAttempt: async (id) => known.get(id) ?? null });
  const add = (id: string) => {
    const a = attempt(id);
    known.set(id, a);
    return a;
  };
  const queued = () => JSON.parse(data[PROGRESS_OUTBOX_KEY] ?? '[]') as string[];
  return { state, outbox, posted, add, queued, known };
}

describe('progress outbox', () => {
  test('a signed-in attempt is posted at once, on its own, and leaves nothing queued', async () => {
    const t = setup();
    await t.outbox.enqueue(t.add('a1'));
    expect(t.posted).toEqual(['a1']);
    expect(t.queued()).toEqual([]);
  });

  test('anonymous: nothing is queued or posted', async () => {
    const t = setup({ token: null });
    await t.outbox.enqueue(t.add('a1'));
    expect(t.posted).toEqual([]);
    expect(t.queued()).toEqual([]);
  });

  test('offline: the attempt stays queued and the next flush sends it, in order, once', async () => {
    const t = setup({ online: false });
    await t.outbox.enqueue(t.add('a1'));
    await t.outbox.enqueue(t.add('a2'));
    expect(t.queued()).toEqual(['a1', 'a2']);

    t.state.online = true;
    await t.outbox.flush();
    await t.outbox.flush();
    expect(t.posted).toEqual(['a1', 'a2']);
    expect(t.queued()).toEqual([]);
  });

  test('a queued attempt that no longer exists locally is dropped instead of blocking the rest', async () => {
    const t = setup({ online: false });
    await t.outbox.enqueue(t.add('a1'));
    await t.outbox.enqueue(t.add('a2'));
    t.known.delete('a1');
    t.state.online = true;
    await t.outbox.flush();
    expect(t.posted).toEqual(['a2']);
    expect(t.queued()).toEqual([]);
  });

  test('a flush racing an enqueue never posts the same attempt twice', async () => {
    const t = setup();
    await Promise.all([t.outbox.enqueue(t.add('a1')), t.outbox.flush(), t.outbox.flush()]);
    expect(t.posted).toEqual(['a1']);
  });
});
