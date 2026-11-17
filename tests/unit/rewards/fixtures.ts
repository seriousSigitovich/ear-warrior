// A server answer to a phrase check and to the standing, as routes/phrase.ts sends them.
export const stateBody = (over: Record<string, unknown> = {}) => ({
  total_xp: 20,
  rank: {
    id: 'beginner',
    name: 'Beginner',
    index: 0,
    next: { id: 'apprentice', name: 'Apprentice', xp: 100 },
    xp_to_next: 80,
    pct: 20,
  },
  streak: { days: 1, extended: true },
  active_days: ['2026-11-16'],
  challenges: [
    {
      id: 'melodies-3',
      title: 'Three',
      description: 'Play three',
      progress: 1,
      target: 3,
      reward_xp: 15,
      completed: false,
    },
  ],
  daily_bonus_xp: 25,
  ...over,
});

export const checkBody = (over: Record<string, unknown> = {}) => ({
  ok: true,
  replay: false,
  grade: {
    accuracy: 100,
    passed: true,
    verdict: 'correct',
    note_results: [{ status: 'matched', target_index: 0, expected_midi: 64, detected_midi: 64 }],
  },
  payout: {
    paid: true,
    xp: 20,
    base: 20,
    level_mult: 1,
    attempt_no: 1,
    attempt_factor: 1,
    hint_factor: 1,
    cap_factor: 1,
    reason: null,
  },
  state: { ...stateBody(), rank_up: null, challenges_paid: [], all_bonus_xp: 0 },
  ...over,
});

export function memoryKv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
  };
}

export interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}
/** A fetch that answers from a script of `{status, body}` (or an Error for no network), in order; the last repeats. */
export function scriptedFetch(script: ({ status: number; body?: unknown } | Error)[]) {
  const calls: Call[] = [];
  let i = 0;
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({
      method: init.method ?? 'GET',
      url,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const step = script[Math.min(i++, script.length - 1)];
    if (step instanceof Error) throw step;
    return { status: step.status, ok: step.status < 300, json: async () => step.body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}
