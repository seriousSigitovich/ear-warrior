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

const settings: DifficultySettings = {
  mode: 'adaptive',
  adaptiveRank: 3,
  fixedRank: 1,
  streakKind: 'correct',
  streakCount: 2,
};

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
    const refused = createProgressClient(
      'https://api.test',
      fakeFetch({ ok: false, error: 'invalid_session' }).impl,
    )!;
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
    expect(
      await createProgressClient('https://api.test', put.impl)!.putDifficulty('tok', settings),
    ).toBe(true);
    expect(put.calls[0].init.method).toBe('PUT');
    const wire = JSON.parse(put.calls[0].init.body as string);
    expect(wire).toEqual({
      mode: 'adaptive',
      adaptive_rank: 3,
      fixed_rank: 1,
      streak_kind: 'correct',
      streak_count: 2,
    });

    const get = fakeFetch({ ok: true, ...wire });
    expect(await createProgressClient('https://api.test', get.impl)!.getDifficulty('tok')).toEqual(
      settings,
    );
  });

  describe('melody places (spec 017)', () => {
    const place = {
      tuneId: 'hotcrossbuns',
      phrase: 2,
      phrases: 5,
      grades: [{ noteResults: [], answer: [64, 62] }],
      updatedAt: '2026-11-12T10:00:00.000Z',
    };

    test('putMelody sends the place to its tune’s endpoint in the server’s field names', async () => {
      const { impl, calls } = fakeFetch({ ok: true, stored: true });
      expect(await createProgressClient('https://api.test', impl)!.putMelody('tok', place)).toBe(
        true,
      );
      expect(calls[0].url).toBe('https://api.test/api/progress/melodies/hotcrossbuns');
      expect(calls[0].init.method).toBe('PUT');
      expect(JSON.parse(calls[0].init.body as string)).toEqual({
        phrase: 2,
        phrases: 5,
        grades: [{ note_results: [], answer: [64, 62] }],
        updated_at: '2026-11-12T10:00:00.000Z',
      });
    });

    test('deleteMelody names the time in the query', async () => {
      const { impl, calls } = fakeFetch({ ok: true });
      expect(
        await createProgressClient('https://api.test', impl)!.deleteMelody(
          'tok',
          'hotcrossbuns',
          place.updatedAt,
        ),
      ).toBe(true);
      expect(calls[0].url).toBe(
        'https://api.test/api/progress/melodies/hotcrossbuns?updated_at=2026-11-12T10%3A00%3A00.000Z',
      );
      expect(calls[0].init.method).toBe('DELETE');
    });

    test('listMelodies reads the places and drops any it cannot trust', async () => {
      const good = {
        tune_id: 'a',
        phrase: 1,
        phrases: 4,
        grades: [{ note_results: [], answer: [60] }],
        updated_at: '2026-11-12T10:00:00.000Z',
      };
      const { impl } = fakeFetch({
        ok: true,
        melodies: [
          good,
          { ...good, tune_id: 7 },
          { ...good, tune_id: 'b', phrase: 'x' },
          { ...good, tune_id: 'c', grades: 'no' },
          'junk',
        ],
      });
      expect(await createProgressClient('https://api.test', impl)!.listMelodies('tok')).toEqual([
        {
          tuneId: 'a',
          phrase: 1,
          phrases: 4,
          grades: [{ noteResults: [], answer: [60] }],
          updatedAt: '2026-11-12T10:00:00.000Z',
        },
      ]);
    });

    test('a refusal or no network is false / null', async () => {
      const refused = createProgressClient('https://api.test', fakeFetch({ ok: false }).impl)!;
      expect(await refused.putMelody('tok', place)).toBe(false);
      expect(await refused.deleteMelody('tok', 'a', place.updatedAt)).toBe(false);
      expect(await refused.listMelodies('tok')).toBeNull();
    });
  });

  describe('game rows and attempts (spec 019)', () => {
    const row = {
      kind: 'award' as const,
      id: 'phrase:a-1:0',
      data: {
        id: 'phrase:a-1:0',
        kind: 'phrase',
        xp: 20,
        day: '2026-11-12',
        at: '2026-11-12T10:00:00.000Z',
      },
    };

    test('pushGame sends the rows to the gamification endpoint', async () => {
      const { impl, calls } = fakeFetch({ ok: true });
      expect(await createProgressClient('https://api.test', impl)!.pushGame('tok', [row])).toBe(
        true,
      );
      expect(calls[0].url).toBe('https://api.test/api/progress/gamification');
      expect(calls[0].init.method).toBe('POST');
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ rows: [row] });
    });

    test('pullGame asks after a cursor and reads the page, dropping rows it cannot trust', async () => {
      const { impl, calls } = fakeFetch({
        ok: true,
        next: 9,
        more: true,
        rows: [
          { ...row, seq: 8 },
          { kind: 'trophy', id: 'x', data: {}, seq: 9 },
          { ...row, id: 'y', seq: 'no' },
          'junk',
          {
            kind: 'mastery',
            id: 'L1',
            data: { id: 'L1', level: 'L1', achievedAt: '2026-11-12T10:00:00.000Z' },
            seq: 9,
          },
        ],
      });
      const page = await createProgressClient('https://api.test', impl)!.pullGame('tok', 7);
      expect(calls[0].url).toBe('https://api.test/api/progress/gamification?after=7');
      expect(page?.next).toBe(9);
      expect(page?.more).toBe(true);
      expect(page?.rows.map((r) => [r.kind, r.id, r.seq])).toEqual([
        ['award', 'phrase:a-1:0', 8],
        ['mastery', 'L1', 9],
      ]);
    });

    test('pullAttempts reads attempts in the app’s shape', async () => {
      const { impl, calls } = fakeFetch({
        ok: true,
        next: 3,
        more: false,
        attempts: [
          {
            seq: 3,
            id: 'a1',
            session_id: 's',
            melody_id: 'hotcrossbuns-1',
            verdict: 'correct',
            confidence: 0.9,
            low_confidence: false,
            timed_out: false,
            input_mode: 'fretboard',
            note_results: [],
            created_at: '2026-11-10T10:00:00.000Z',
          },
          { seq: 4, id: 7 },
        ],
      });
      const page = await createProgressClient('https://api.test', impl)!.pullAttempts('tok', 2);
      expect(calls[0].url).toBe('https://api.test/api/progress/attempts?after=2');
      expect(page?.attempts).toEqual([
        {
          id: 'a1',
          sessionId: 's',
          melodyId: 'hotcrossbuns-1',
          detectedNotes: [],
          noteResults: [],
          verdict: 'correct',
          confidence: 0.9,
          lowConfidence: false,
          timedOut: false,
          inputMode: 'fretboard',
          createdAt: '2026-11-10T10:00:00.000Z',
        },
      ]);
      expect([page?.next, page?.more]).toEqual([3, false]);
    });

    test('a refusal or no network is false / null', async () => {
      const refused = createProgressClient('https://api.test', fakeFetch({ ok: false }).impl)!;
      expect(await refused.pushGame('tok', [row])).toBe(false);
      expect(await refused.pullGame('tok', 0)).toBeNull();
      expect(await refused.pullAttempts('tok', 0)).toBeNull();
    });
  });
});
