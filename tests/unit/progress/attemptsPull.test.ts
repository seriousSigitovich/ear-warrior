import { Attempt } from '../../../src/models';
import { createInMemoryRowStore } from '../../../src/services/storage/db';
import {
  createAttemptRepository,
  createMelodyRepository,
} from '../../../src/services/storage/repositories';
import { ProgressClient } from '../../../src/services/progress/client';
import { createAttemptsPull } from '../../../src/services/progress/attemptsPull';
import { LIBRARY } from '../../../src/services/melody/curated';
import { KeyValueStore } from '../../../src/lib/deviceId';

const tune = LIBRARY[0];
const attempt = (melodyId: string, over: Partial<Attempt> = {}): Attempt => ({
  id: `s-${melodyId}`,
  sessionId: 's',
  melodyId,
  detectedNotes: [],
  noteResults: [
    {
      targetIndex: 0,
      status: 'matched',
      expectedMidi: 64,
      detectedMidi: 64,
      octaveMismatch: false,
    },
  ],
  verdict: 'correct',
  confidence: 1,
  lowConfidence: false,
  timedOut: false,
  inputMode: 'fretboard',
  createdAt: '2026-11-10T10:00:00.000Z',
  ...over,
});

function setup(remote: Attempt[], pageSize = 100, token: string | null = 'tok') {
  const store = createInMemoryRowStore();
  const attempts = createAttemptRepository(store);
  const melodies = createMelodyRepository(store);
  const mem = new Map<string, string>();
  const kv: KeyValueStore = {
    getItem: async (k) => mem.get(k) ?? null,
    setItem: async (k, v) => void mem.set(k, v),
  };
  const calls: number[] = [];
  const client = {
    async pullAttempts(_t: string, after: number) {
      calls.push(after);
      const rest = remote.map((a, i) => ({ a, seq: i + 1 })).filter((x) => x.seq > after);
      const page = rest.slice(0, pageSize);
      return {
        attempts: page.map((x) => x.a),
        next: page.length ? page[page.length - 1].seq : after,
        more: rest.length > pageSize,
      };
    },
  } as unknown as ProgressClient;
  const pull = createAttemptsPull({ attempts, melodies, client, getToken: async () => token, kv });
  return { attempts, melodies, pull, calls };
}

describe('pulling the account’s attempts', () => {
  test('attempts made elsewhere are added, with their melody rebuilt from the library', async () => {
    const { attempts, melodies, pull } = setup([attempt(`${tune.id}-4242`)]);
    expect(await pull.pull()).toBe(1);
    expect((await attempts.all()).map((a) => a.melodyId)).toEqual([`${tune.id}-4242`]);
    const melody = await melodies.get(`${tune.id}-4242`);
    expect(melody?.title).toBe(tune.title);
    expect(melody?.phrases).toEqual([...tune.phrases]);
    expect(melody?.difficultyId).toBe(`L${tune.rank}`);
  });

  test('an attempt the device already has is not added twice, and a second pull adds nothing', async () => {
    const remote = [attempt(`${tune.id}-1`), attempt(`${tune.id}-2`)];
    const { attempts, pull } = setup(remote);
    await attempts.create(remote[0]);
    expect(await pull.pull()).toBe(1);
    expect(await pull.pull()).toBe(0);
    expect(await attempts.all()).toHaveLength(2);
  });

  test('pages are read to the end and the cursor is kept', async () => {
    const remote = Array.from({ length: 5 }, (_, i) => attempt(`${tune.id}-${i}`));
    const { attempts, pull, calls } = setup(remote, 2);
    expect(await pull.pull()).toBe(5);
    expect(calls).toEqual([0, 2, 4]);
    calls.length = 0;
    await pull.pull();
    expect(calls).toEqual([5]);
    expect(await attempts.all()).toHaveLength(5);
  });

  test('a melody that is not in the library is still kept as an attempt, without a melody row', async () => {
    const { attempts, melodies, pull } = setup([attempt('gone-9')]);
    expect(await pull.pull()).toBe(1);
    expect(await attempts.all()).toHaveLength(1);
    expect(await melodies.get('gone-9')).toBeNull();
  });

  test('an anonymous learner pulls nothing', async () => {
    const { attempts, pull, calls } = setup([attempt(`${tune.id}-1`)], 100, null);
    expect(await pull.pull()).toBe(0);
    expect(calls).toEqual([]);
    expect(await attempts.all()).toEqual([]);
  });
});
