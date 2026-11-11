import {
  createChallengesClient,
  parseDailyChallenges,
} from '../../../src/services/challenges/client';

const good = (over: Record<string, unknown> = {}) => ({
  ok: true,
  date: '2026-11-12',
  all_bonus_xp: 25,
  challenges: [
    {
      id: 'melodies-2',
      type: 'melodies',
      target: 2,
      reward_xp: 10,
      title: 'Complete 2 melodies',
      description: 'Play 2 melodies through',
    },
    {
      id: 'accuracy-90',
      type: 'accuracy',
      target: 90,
      reward_xp: 20,
      title: 'Reach 90% accuracy',
      description: 'Land 90% of the notes in one melody',
    },
    {
      id: 'melodies-5',
      type: 'melodies',
      target: 5,
      reward_xp: 35,
      title: 'Complete 5 melodies',
      description: 'Keep going: 5 melodies today',
    },
  ],
  ...over,
});

describe('parseDailyChallenges', () => {
  test('a good answer becomes definitions and the all-done bonus', () => {
    const r = parseDailyChallenges(good(), '2026-11-12');
    expect(r?.allBonusXp).toBe(25);
    expect(r?.defs.map((d) => [d.id, d.type, d.target, d.rewardXp])).toEqual([
      ['melodies-2', 'melodies', 2, 10],
      ['accuracy-90', 'accuracy', 90, 20],
      ['melodies-5', 'melodies', 5, 35],
    ]);
    expect(r?.defs[0]).toMatchObject({
      title: 'Complete 2 melodies',
      description: 'Play 2 melodies through',
    });
  });

  test('anything off makes the whole answer unusable', () => {
    const base = good();
    const bad: unknown[] = [
      null,
      'x',
      { ...base, ok: false },
      { ...base, date: '2026-11-13' }, // another day than asked
      { ...base, all_bonus_xp: -1 },
      { ...base, all_bonus_xp: 'lots' },
      { ...base, challenges: base.challenges.slice(0, 2) },
      { ...base, challenges: [...base.challenges, base.challenges[0]] },
      { ...base, challenges: [base.challenges[0], base.challenges[0], base.challenges[2]] }, // ids repeat
      {
        ...base,
        challenges: base.challenges.map((c, i) => (i === 1 ? { ...c, type: 'phrases' } : c)),
      },
      { ...base, challenges: base.challenges.map((c, i) => (i === 0 ? { ...c, target: 0 } : c)) },
      { ...base, challenges: base.challenges.map((c, i) => (i === 0 ? { ...c, target: 2.5 } : c)) },
      { ...base, challenges: base.challenges.map((c, i) => (i === 1 ? { ...c, target: 150 } : c)) },
      {
        ...base,
        challenges: base.challenges.map((c, i) => (i === 2 ? { ...c, reward_xp: 100000 } : c)),
      },
      { ...base, challenges: base.challenges.map((c, i) => (i === 2 ? { ...c, title: '' } : c)) },
      {
        ...base,
        challenges: base.challenges.map((c, i) => (i === 2 ? { ...c, id: 'has space' } : c)),
      },
      {
        ...base,
        challenges: base.challenges.map((c, i) => (i === 0 ? { ...c, title: 'x'.repeat(200) } : c)),
      },
    ];
    for (const b of bad) expect(parseDailyChallenges(b, '2026-11-12')).toBeNull();
  });
});

describe('challenges client', () => {
  const reply = (body: unknown, ok = true) =>
    (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  test('no API address: no client, the app keeps its built-in challenges', () => {
    expect(createChallengesClient(undefined)).toBeNull();
  });

  test('asks for the learner’s local date and returns the parsed answer', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => good() };
    }) as unknown as typeof fetch;
    const client = createChallengesClient('https://api.test/', fake)!;
    const r = await client.today('2026-11-12');
    expect(calls).toEqual(['https://api.test/api/challenges/today?date=2026-11-12']);
    expect(r?.defs).toHaveLength(3);
  });

  test('a refusal, a bad answer, a failure and a hang are all null', async () => {
    expect(
      await createChallengesClient('https://api.test', reply({ ok: false }, false))!.today(
        '2026-11-12',
      ),
    ).toBeNull();
    expect(
      await createChallengesClient('https://api.test', reply({ nonsense: 1 }))!.today('2026-11-12'),
    ).toBeNull();
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await createChallengesClient('https://api.test', boom)!.today('2026-11-12')).toBeNull();
    const hang = ((_u: string, init?: { signal?: AbortSignal }) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )) as unknown as typeof fetch;
    jest.useFakeTimers();
    const pending = createChallengesClient('https://api.test', hang)!.today('2026-11-12');
    await jest.advanceTimersByTimeAsync(5000);
    expect(await pending).toBeNull();
    jest.useRealTimers();
  });
});
