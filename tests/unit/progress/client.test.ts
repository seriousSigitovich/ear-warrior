import { createProgressClient } from '../../../src/services/progress/client';
import { Attempt, DifficultySettings } from '../../../src/models';

const attempt: Attempt = {
  id: 's_1-1',
  sessionId: 's_1',
  melodyId: 'hotcrossbuns-42',
  detectedNotes: [],
  noteResults: [],
  verdict: 'correct',
  confidence: 0.9,
  lowConfidence: false,
  timedOut: false,
  inputMode: 'fretboard',
  createdAt: '2026-10-30T10:00:00.000Z',
};

const settings: DifficultySettings = { mode: 'adaptive', adaptiveRank: 3, fixedRank: 1, streakKind: 'correct', streakCount: 2 };

function fakeFetch(answer: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return { json: async () => answer };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('progress client', () => {
  test('no API url, no client', () => {
    expect(createProgressClient(undefined)).toBeNull();
  });

  test('postAttempt sends one attempt to its own endpoint with the bearer token', async () => {
    const { impl, calls } = fakeFetch({ ok: true });
    const client = createProgressClient('https://api.test/', impl)!;
    expect(await client.postAttempt('tok', attempt)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/api/progress/attempts');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      id: 's_1-1',
      melody_id: 'hotcrossbuns-42',
      verdict: 'correct',
      input_mode: 'fretboard',
      created_at: '2026-10-30T10:00:00.000Z',
    });
  });

  test('a refusal or no network is false / null, never a throw', async () => {
    const refused = createProgressClient('https://api.test', fakeFetch({ ok: false, error: 'invalid_session' }).impl)!;
    expect(await refused.postAttempt('tok', attempt)).toBe(false);
    expect(await refused.history('tok')).toBeNull();
    const offline = createProgressClient('https://api.test', fakeFetch(new Error('offline')).impl)!;
    expect(await offline.postAttempt('tok', attempt)).toBe(false);
    expect(await offline.getDifficulty('tok')).toBeNull();
  });

  test('history reads the two lists of tune ids', async () => {
    const { impl, calls } = fakeFetch({ ok: true, mastered: ['a'], recent: ['a', 'b'] });
    const client = createProgressClient('https://api.test', impl)!;
    expect(await client.history('tok')).toEqual({ mastered: ['a'], recent: ['a', 'b'] });
    expect(calls[0].url).toBe('https://api.test/api/progress/history');
  });

  test('difficulty round-trips between the app shape and the wire shape', async () => {
    const put = fakeFetch({ ok: true });
    expect(await createProgressClient('https://api.test', put.impl)!.putDifficulty('tok', settings)).toBe(true);
    expect(put.calls[0].init.method).toBe('PUT');
    const wire = JSON.parse(put.calls[0].init.body as string);
    expect(wire).toEqual({ mode: 'adaptive', adaptive_rank: 3, fixed_rank: 1, streak_kind: 'correct', streak_count: 2 });

    const get = fakeFetch({ ok: true, ...wire });
    expect(await createProgressClient('https://api.test', get.impl)!.getDifficulty('tok')).toEqual(settings);
  });
});
