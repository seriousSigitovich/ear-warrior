import { Attempt, Melody, NoteResult } from '../../../src/models';
import { GAMIFICATION } from '../../../src/config/gamification';
import {
  ATTEMPTS_TABLE,
  MELODIES_TABLE,
  RowStore,
  XP_AWARDS_TABLE,
  createInMemoryRowStore,
} from '../../../src/services/storage/db';
import {
  GamificationService,
  createGamificationService,
} from '../../../src/services/gamification/service';
import { DailyChallenges } from '../../../src/services/challenges/client';
import { allLevels } from '../../../src/services/melody/levels';

const LEVELS = allLevels().map((l) => l.id);
const L1 = LEVELS[0];

/** A clock the tests move: local time, as the app reads it. */
function clock(start: Date) {
  let t = start.getTime();
  return {
    now: () => new Date(t),
    set: (d: Date) => (t = d.getTime()),
    advance: (ms: number) => (t += ms),
  };
}
const nov = (d: number, h = 12, m = 0) => new Date(2026, 10, d, h, m);

function make(store: RowStore = createInMemoryRowStore(), c = clock(nov(10))) {
  const service = createGamificationService({ store, now: c.now });
  return { store, service, c };
}

let seq = 0;
/** One finished melody as the practice screen reports it. */
async function finish(
  s: GamificationService,
  level: string,
  accuracy: number,
  over: { hintsUsed?: number; id?: string; at?: Date } = {},
) {
  seq += 1;
  return s.exerciseCompleted({
    id: over.id ?? `att${seq}`,
    melodyId: `tune${seq}-${seq}`,
    level,
    accuracy,
    hintsUsed: over.hintsUsed ?? 0,
    at: over.at,
  });
}
/** Play `n` phrases of a fresh melody at `accuracy`. */
async function phrases(
  s: GamificationService,
  n: number,
  accuracy: number,
  melody = `m${++seq}-1`,
) {
  const out = [];
  for (let i = 0; i < n; i++)
    out.push(await s.phraseChecked({ melodyId: melody, phrase: i, accuracy, level: L1 }));
  return out;
}

describe('phrase XP', () => {
  test('a phrase at 80%+ pays once; 90% and 100% pay more', async () => {
    const { service } = make();
    expect(
      (await service.phraseChecked({ melodyId: 'a-1', phrase: 0, accuracy: 80, level: L1 }))?.xp,
    ).toBe(10);
    expect(
      (await service.phraseChecked({ melodyId: 'a-1', phrase: 1, accuracy: 90, level: L1 }))?.xp,
    ).toBe(15);
    expect(
      (await service.phraseChecked({ melodyId: 'a-1', phrase: 2, accuracy: 100, level: L1 }))?.xp,
    ).toBe(20);
    expect((await service.snapshot()).totalXp).toBe(45);
  });

  test('reporting the same phrase again changes nothing', async () => {
    const { service } = make();
    const input = { melodyId: 'a-1', phrase: 0, accuracy: 100, level: L1 };
    expect(await service.phraseChecked(input)).not.toBeNull();
    for (let i = 0; i < 5; i++) expect(await service.phraseChecked(input)).toBeNull();
    expect((await service.snapshot()).totalXp).toBe(20);
  });

  test('a phrase below the pass mark pays nothing, and a retry that passes pays once', async () => {
    const { service } = make();
    const base = { melodyId: 'a-1', phrase: 0, level: L1 };
    expect(await service.phraseChecked({ ...base, accuracy: 60 })).toBeNull();
    expect((await service.snapshot()).totalXp).toBe(0);
    expect((await service.phraseChecked({ ...base, accuracy: 85 }))?.xp).toBe(10);
    expect(await service.phraseChecked({ ...base, accuracy: 100 })).toBeNull();
    expect((await service.snapshot()).totalXp).toBe(10);
  });

  test('the same phrase in another play of the melody pays again', async () => {
    const { service } = make();
    await phrases(service, 2, 100, 'tune-1');
    await phrases(service, 2, 100, 'tune-2');
    expect((await service.snapshot()).totalXp).toBe(80);
  });

  test('a phrase answered after the answer was shown pays nothing, and neither does repeating it', async () => {
    const { service } = make();
    const base = { melodyId: 'a-1', phrase: 0, level: L1, accuracy: 100 };
    expect(await service.phraseChecked({ ...base, answerShown: true })).toBeNull();
    expect((await service.snapshot()).totalXp).toBe(0);
    // The phrase is not spent: answered honestly later in the same play, it still pays.
    expect((await service.phraseChecked(base))?.xp).toBe(20);
  });

  test('nonsense accuracy pays nothing and XP never goes negative', async () => {
    const { service } = make();
    for (const accuracy of [NaN, -5, Infinity * -1]) {
      expect(
        await service.phraseChecked({ melodyId: 'a-1', phrase: 0, accuracy, level: L1 }),
      ).toBeNull();
    }
    expect((await service.snapshot()).totalXp).toBe(0);
  });

  test('concurrent reports of one phrase pay once', async () => {
    const { service } = make();
    const input = { melodyId: 'a-1', phrase: 0, accuracy: 100, level: L1 };
    const results = await Promise.all([1, 2, 3, 4].map(() => service.phraseChecked(input)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await service.snapshot()).totalXp).toBe(20);
  });
});

describe('exercise completion and mastery', () => {
  test('a melody at 80%+ is recorded once, by its attempt id', async () => {
    const { service } = make();
    expect(await finish(service, L1, 79)).toBeNull();
    expect(await finish(service, L1, 85, { id: 'x' })).not.toBeNull();
    expect(await finish(service, L1, 85, { id: 'x' })).toBeNull();
    expect((await service.snapshot()).mastery[0]).toMatchObject({ level: L1, completed: 1 });
  });

  test('a level is mastered after ten good completions, once, with its date', async () => {
    const { service, c } = make();
    for (let i = 0; i < 9; i++)
      expect((await finish(service, L1, 100))?.masteryUnlocked).toEqual([]);
    c.set(nov(10, 15));
    const tenth = await finish(service, L1, 100);
    expect(tenth?.masteryUnlocked).toEqual([L1]);
    expect((await finish(service, L1, 100))?.masteryUnlocked).toEqual([]);
    const level = (await service.snapshot()).mastery[0];
    expect(level.mastered).toBe(true);
    expect(level.achievedAt).toBe(nov(10, 15).toISOString());
  });

  test('mastery is not lost when later melodies score lower', async () => {
    const { service } = make();
    for (let i = 0; i < 10; i++) await finish(service, L1, 100);
    for (let i = 0; i < 6; i++) await finish(service, L1, 80);
    expect((await service.snapshot()).mastery[0]).toMatchObject({
      mastered: true,
      recentAverage: 80,
    });
  });

  test('hints keep a level from mastery until three melodies were played without them', async () => {
    const { service } = make();
    for (let i = 0; i < 10; i++) await finish(service, L1, 100, { hintsUsed: 1 });
    expect((await service.snapshot()).mastery[0].mastered).toBe(false);
    await finish(service, L1, 100);
    await finish(service, L1, 100);
    expect((await service.snapshot()).mastery[0].mastered).toBe(false);
    const third = await finish(service, L1, 100);
    expect(third?.masteryUnlocked).toEqual([L1]);
  });
});

describe('ranks', () => {
  test('XP alone does not unlock Apprentice; mastery completes it, and the rank-up is reported once', async () => {
    const { service } = make();
    await phrases(service, 10, 100); // 200 XP, no mastery
    let snap = await service.snapshot();
    expect(snap.rank).toMatchObject({ name: 'Beginner', locked: true });
    expect(snap.rank.missing.levels).toEqual([L1]);

    const rankUps: (string | null)[] = [];
    for (let i = 0; i < 10; i++) rankUps.push((await finish(service, L1, 100))?.rankUp ?? null);
    expect(rankUps.filter(Boolean)).toEqual(['Apprentice']);
    expect(rankUps[9]).toBe('Apprentice');
    snap = await service.snapshot();
    expect(snap.rank.name).toBe('Apprentice');
  });

  test('a phrase that pushes the XP over the line of an already mastered level raises the rank', async () => {
    const { service } = make();
    // Ten melodies on one day also pay the day's challenges: 10 + 20 + 35 + 25 = 90 XP, level mastered.
    for (let i = 0; i < 10; i++) await finish(service, L1, 100);
    expect((await service.snapshot()).totalXp).toBe(90);
    expect((await service.snapshot()).rank.name).toBe('Beginner');
    const out = await phrases(service, 2, 100);
    expect(out.map((r) => r?.rankUp ?? null)).toEqual(['Apprentice', null]);
  });
});

describe('daily challenges', () => {
  test('progress follows the day’s completions and each reward is paid once', async () => {
    const { service } = make();
    await finish(service, L1, 85);
    await finish(service, L1, 85);
    let snap = await service.snapshot();
    expect(snap.challenges.map((c) => [c.progress, c.completed])).toEqual([
      [2, false],
      [0, false],
      [2, false],
    ]);
    const third = await finish(service, L1, 95);
    expect(third?.challengesCompleted.map((c) => [c.id, c.rewardXp])).toEqual([
      ['practice', 10],
      ['accuracy', 20],
    ]);
    expect(third?.allChallengesBonus).toBe(0);
    await finish(service, L1, 85);
    const fifth = await finish(service, L1, 85);
    expect(fifth?.challengesCompleted.map((c) => [c.id, c.rewardXp])).toEqual([
      ['consistency', 35],
    ]);
    expect(fifth?.allChallengesBonus).toBe(25);
    const sixth = await finish(service, L1, 85);
    expect(sixth?.challengesCompleted).toEqual([]);
    expect(sixth?.allChallengesBonus).toBe(0);
    snap = await service.snapshot();
    expect(snap.totalXp).toBe(10 + 20 + 35 + 25);
    expect(snap.allChallengesDone).toBe(true);
  });

  test('the same completion reported again pays no challenge reward', async () => {
    const { service } = make();
    for (let i = 0; i < 3; i++) await finish(service, L1, 85, { id: `d${i}` });
    for (let i = 0; i < 3; i++) await finish(service, L1, 85, { id: `d${i}` });
    expect((await service.snapshot()).totalXp).toBe(10);
  });

  test('challenges reset at local midnight and completed ones stay completed that day', async () => {
    const { service, c } = make(undefined, clock(nov(10, 23, 50)));
    for (let i = 0; i < 3; i++) await finish(service, L1, 85);
    c.set(nov(10, 23, 59));
    expect((await service.snapshot()).challenges[0]).toMatchObject({
      progress: 3,
      completed: true,
    });
    c.set(nov(11, 0, 1));
    const next = await service.snapshot();
    expect(next.today).toBe('2026-11-11');
    expect(next.challenges.map((x) => x.progress)).toEqual([0, 0, 0]);
    for (let i = 0; i < 3; i++) await finish(service, L1, 85); // a new day pays again
    expect((await service.snapshot()).totalXp).toBe(20);
  });

  test('a day’s challenges are marked started once', async () => {
    const { service, c } = make();
    expect(await service.markChallengesStarted()).toBe(true);
    expect(await service.markChallengesStarted()).toBe(false);
    c.set(nov(11));
    expect(await service.markChallengesStarted()).toBe(true);
  });
});

describe('streak', () => {
  test('practice extends it once a day; a missed day resets it', async () => {
    const { service, c } = make();
    const first = await phrases(service, 2, 100);
    expect(first.map((r) => r?.streak)).toEqual([
      { days: 1, extended: true },
      { days: 1, extended: false },
    ]);
    c.set(nov(11));
    expect((await service.snapshot()).streak).toMatchObject({ days: 1, practicedToday: false });
    expect((await phrases(service, 1, 100))[0]?.streak).toEqual({ days: 2, extended: true });
    c.set(nov(14)); // 12 and 13 missed
    expect((await service.snapshot()).streak.days).toBe(0);
    expect((await phrases(service, 1, 100))[0]?.streak).toEqual({ days: 1, extended: true });
  });

  test('opening the app on a new day does not reset it', async () => {
    const { service, c } = make();
    await phrases(service, 1, 100);
    c.set(nov(11, 9));
    expect((await service.snapshot()).streak.days).toBe(1);
    expect((await service.snapshot()).streak.days).toBe(1);
  });

  test('the day boundary is local midnight', async () => {
    const { service, c } = make(undefined, clock(nov(10, 23, 59)));
    await phrases(service, 1, 100);
    c.set(nov(11, 0, 1));
    expect((await phrases(service, 1, 100))[0]?.streak).toEqual({ days: 2, extended: true });
  });

  test('a stored day is not recomputed: a later timezone change cannot move it', async () => {
    const { service, store, c } = make();
    // Written at 23:59 on the 10th, local time of that moment. Its instant is the 11th in UTC.
    await store.insert(XP_AWARDS_TABLE, 'phrase:z-1:0', {
      id: 'phrase:z-1:0',
      kind: 'phrase',
      xp: 10,
      day: '2026-11-10',
      at: '2026-11-11T05:59:00.000Z',
    });
    c.set(nov(11, 9));
    expect((await service.snapshot()).streak).toMatchObject({ days: 1, practicedToday: false });
  });
});

describe('persistence', () => {
  test('after a restart every figure is the same', async () => {
    const { service, store, c } = make();
    await phrases(service, 4, 100);
    for (let i = 0; i < 10; i++) await finish(service, L1, 100);
    const before = await service.snapshot();

    const restarted = createGamificationService({ store, now: c.now });
    expect(await restarted.snapshot()).toEqual(before);
    // and it still knows what it paid
    expect(
      await restarted.phraseChecked({ melodyId: 'again-1', phrase: 0, accuracy: 100, level: L1 }),
    ).not.toBeNull();
    expect(
      await restarted.exerciseCompleted({
        id: 'att-dup',
        melodyId: 'm',
        level: L1,
        accuracy: 100,
        hintsUsed: 0,
      }),
    ).not.toBeNull();
  });

  test('a changed configuration does not rewrite what was already paid', async () => {
    const { service, store, c } = make();
    await phrases(service, 2, 100);
    const richer = {
      ...GAMIFICATION,
      phraseXp: { base: 100, accuracy90: 0, accuracy100: 0 },
    };
    const later = createGamificationService({ store, now: c.now, cfg: richer });
    expect((await later.snapshot()).totalXp).toBe(40);
    expect(
      (await later.phraseChecked({ melodyId: 'n-1', phrase: 0, accuracy: 100, level: L1 }))?.xp,
    ).toBe(100);
  });
});

describe('conversion of past attempts', () => {
  function results(statuses: ('matched' | 'wrong')[]): NoteResult[] {
    return statuses.map((status, i) => ({
      targetIndex: i,
      status,
      expectedMidi: 60,
      detectedMidi: status === 'matched' ? 60 : 62,
      octaveMismatch: false,
    }));
  }
  function melody(id: string, level: string, phraseLens: number[]): Melody {
    const n = phraseLens.reduce((a, b) => a + b, 0);
    return {
      id,
      difficultyId: level,
      scale: 'C',
      tempoBpm: 100,
      phrases: phraseLens,
      createdAt: '',
      notes: Array.from({ length: n }, (_, index) => ({
        index,
        midi: 60,
        noteName: 'C4',
        frequencyHz: 261,
        centsOffset: 0,
        durationBeats: 1,
      })),
    };
  }
  function attempt(
    id: string,
    melodyId: string,
    noteResults: NoteResult[],
    at: Date,
    over: Partial<Attempt> = {},
  ): Attempt {
    return {
      id,
      sessionId: 's',
      melodyId,
      detectedNotes: [],
      noteResults,
      verdict: noteResults.every((r) => r.status === 'matched') ? 'correct' : 'incorrect',
      confidence: 1,
      lowConfidence: false,
      timedOut: false,
      inputMode: 'fretboard',
      createdAt: at.toISOString(),
      ...over,
    };
  }
  async function seed(store: RowStore) {
    const perfect = melody('tuneA-1', L1, [2, 2]);
    const half = melody('tuneB-1', L1, [2, 2]);
    await store.insert(MELODIES_TABLE, perfect.id, perfect as never);
    await store.insert(MELODIES_TABLE, half.id, half as never);
    const rows = [
      attempt('p1', perfect.id, results(['matched', 'matched', 'matched', 'matched']), nov(8)),
      // 2 of 4 notes: first phrase right (pays), second wrong; the melody is below the pass mark
      attempt('p2', half.id, results(['matched', 'matched', 'wrong', 'wrong']), nov(9)),
      attempt('mic', perfect.id, results(['matched', 'matched', 'matched', 'matched']), nov(9), {
        inputMode: 'mic',
      }),
    ];
    for (const a of rows) await store.insert(ATTEMPTS_TABLE, a.id, a as never);
    return rows;
  }

  test('past attempts become completions, phrase XP and mastery progress, once', async () => {
    const store = createInMemoryRowStore();
    await seed(store);
    const { service } = make(store, clock(nov(10)));
    await service.init();
    const snap = await service.snapshot();
    expect(snap.totalXp).toBe(20 + 20 + 20); // p1: two perfect phrases, p2: one perfect phrase
    expect(snap.mastery[0]).toMatchObject({ level: L1, completed: 1 });
    expect(snap.streak.days).toBe(2); // the 8th and the 9th had practice, the 10th is still open
  });

  test('converting again changes nothing, and attempts are left as they were', async () => {
    const store = createInMemoryRowStore();
    const rows = await seed(store);
    const { service } = make(store, clock(nov(10)));
    await service.init();
    const once = await service.snapshot();
    await service.init();
    await createGamificationService({ store, now: () => nov(10) }).init();
    expect(await service.snapshot()).toEqual(once);
    expect(await store.all(ATTEMPTS_TABLE)).toHaveLength(rows.length);
  });

  test('no challenge rewards are paid for the past', async () => {
    const store = createInMemoryRowStore();
    await seed(store);
    const { service } = make(store, clock(nov(10)));
    await service.init();
    const awards = (await store.all<{ kind: string }>(XP_AWARDS_TABLE)).map((a) => a.kind);
    expect(awards.every((k) => k === 'phrase')).toBe(true);
  });
});

describe('daily challenges from the server', () => {
  const serverDay = (over: Partial<DailyChallenges> = {}): DailyChallenges => ({
    defs: [
      {
        id: 'melodies-2',
        type: 'melodies',
        target: 2,
        rewardXp: 15,
        title: 'Complete 2 melodies',
        description: 'Play 2 melodies through',
      },
      {
        id: 'accuracy-85',
        type: 'accuracy',
        target: 85,
        rewardXp: 18,
        title: 'Reach 85% accuracy',
        description: 'Land 85% of the notes in one melody',
      },
      {
        id: 'melodies-4',
        type: 'melodies',
        target: 4,
        rewardXp: 25,
        title: 'Complete 4 melodies',
        description: 'Keep going: 4 melodies today',
      },
    ],
    allBonusXp: 30,
    ...over,
  });

  /** A service whose server answers from `answers` (null = unreachable), counting the questions. */
  function withServer(
    answers: (DailyChallenges | null)[],
    store: RowStore = createInMemoryRowStore(),
    c = clock(nov(10)),
  ) {
    const asked: string[] = [];
    const service = createGamificationService({
      store,
      now: c.now,
      fetchChallenges: async (day) => {
        asked.push(day);
        return answers.shift() ?? null;
      },
    });
    return { service, store, c, asked };
  }

  test('without a server the built-in challenges and bonus are used', async () => {
    const { service } = make();
    const snap = await service.snapshot();
    expect(snap.challenges.map((x) => x.id)).toEqual(['practice', 'accuracy', 'consistency']);
    expect(snap.allChallengesBonus).toBe(25);
    expect(await service.refreshChallenges()).toBe(false);
  });

  test('the server’s challenges replace the built-in ones for the day and are asked for once', async () => {
    const { service, asked } = withServer([serverDay()]);
    expect(await service.refreshChallenges()).toBe(true);
    const snap = await service.snapshot();
    expect(snap.challenges.map((x) => [x.id, x.target, x.rewardXp])).toEqual([
      ['melodies-2', 2, 15],
      ['accuracy-85', 1, 18],
      ['melodies-4', 4, 25],
    ]);
    expect(snap.allChallengesBonus).toBe(30);
    expect(await service.refreshChallenges()).toBe(false);
    expect(asked).toEqual(['2026-11-10']);
  });

  test('they survive a restart, with no new question', async () => {
    const first = withServer([serverDay()]);
    await first.service.refreshChallenges();
    const second = withServer([], first.store, first.c);
    expect((await second.service.snapshot()).challenges[0].id).toBe('melodies-2');
    expect(await second.service.refreshChallenges()).toBe(false);
    expect(second.asked).toEqual([]);
  });

  test('an unreachable server leaves the built-in ones, and the next try can still succeed', async () => {
    const { service, asked } = withServer([null, serverDay()]);
    expect(await service.refreshChallenges()).toBe(false);
    expect((await service.snapshot()).challenges[0].id).toBe('practice');
    expect(await service.refreshChallenges()).toBe(true);
    expect((await service.snapshot()).challenges[0].id).toBe('melodies-2');
    expect(asked).toHaveLength(2);
  });

  test('rewards and the bonus are the server’s, each paid once', async () => {
    const { service } = withServer([serverDay()]);
    await service.refreshChallenges();
    const r1 = await finish(service, L1, 90);
    expect(r1?.challengesCompleted).toEqual([{ id: 'accuracy-85', rewardXp: 18 }]);
    const r2 = await finish(service, L1, 90);
    expect(r2?.challengesCompleted).toEqual([{ id: 'melodies-2', rewardXp: 15 }]);
    await finish(service, L1, 90);
    const r4 = await finish(service, L1, 90);
    expect(r4?.challengesCompleted).toEqual([{ id: 'melodies-4', rewardXp: 25 }]);
    expect(r4?.allChallengesBonus).toBe(30);
    expect((await service.snapshot()).totalXp).toBe(18 + 15 + 25 + 30);
  });

  test('once something was paid on the built-in challenges, the day stays on them', async () => {
    const { service, asked } = withServer([null, serverDay()]);
    await service.refreshChallenges(); // offline
    for (let i = 0; i < 3; i++) await finish(service, L1, 85); // pays "practice" (10)
    expect(await service.refreshChallenges()).toBe(false); // the server is back, but the day is fixed
    const snap = await service.snapshot();
    expect(snap.challenges.map((x) => x.id)).toEqual(['practice', 'accuracy', 'consistency']);
    expect(snap.totalXp).toBe(10);
    expect(asked).toHaveLength(1); // it did not even ask
  });

  test('a day paid before this existed (no stored challenges) is fixed to the built-in ones', async () => {
    const { service, store, c } = withServer([serverDay()]);
    await store.insert(XP_AWARDS_TABLE, 'challenge:2026-11-10:practice', {
      id: 'challenge:2026-11-10:practice',
      kind: 'challenge',
      xp: 10,
      day: '2026-11-10',
      at: c.now().toISOString(),
    });
    expect(await service.refreshChallenges()).toBe(false);
    expect((await service.snapshot()).challenges[0].id).toBe('practice');
  });

  test('a new day asks again', async () => {
    const { service, c, asked } = withServer([serverDay(), serverDay({ allBonusXp: 40 })]);
    await service.refreshChallenges();
    c.set(nov(11));
    expect(await service.refreshChallenges()).toBe(true);
    expect((await service.snapshot()).allChallengesBonus).toBe(40);
    expect(asked).toEqual(['2026-11-10', '2026-11-11']);
  });

  test('a slow server does not hold up the other calls', async () => {
    let release: (d: DailyChallenges) => void = () => undefined;
    const store = createInMemoryRowStore();
    const service = createGamificationService({
      store,
      now: clock(nov(10)).now,
      fetchChallenges: () => new Promise<DailyChallenges>((resolve) => (release = resolve)),
    });
    const refreshing = service.refreshChallenges();
    expect(
      (await service.phraseChecked({ melodyId: 'a-1', phrase: 0, accuracy: 100, level: L1 }))?.xp,
    ).toBe(20);
    release(serverDay());
    expect(await refreshing).toBe(true);
  });
});
