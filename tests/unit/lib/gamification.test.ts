import { GAMIFICATION } from '../../../src/config/gamification';
import {
  Completion,
  challengeStates,
  challengesLeft,
  levelMastery,
  masteredAt,
  phraseReward,
  rankProgress,
  rankUp,
} from '../../../src/lib/gamification';
import { allLevels } from '../../../src/services/melody/levels';

const LEVELS = allLevels().map((l) => l.id);
const L1 = LEVELS[0];
const L2 = LEVELS[1];

let seq = 0;
function done(level: string, accuracy: number, over: Partial<Completion> = {}): Completion {
  seq += 1;
  return {
    id: `c${seq}`,
    melodyId: `m${seq}`,
    level,
    accuracy,
    hintsUsed: 0,
    completedAt: new Date(2026, 10, 10, 8, seq).toISOString(),
    day: '2026-11-10',
    ...over,
  };
}
const many = (n: number, level: string, accuracy: number, over: Partial<Completion> = {}) =>
  Array.from({ length: n }, () => done(level, accuracy, over));

describe('configuration', () => {
  test('there are seven ranks, from 0 XP up, and nine levels taken from the app', () => {
    expect(GAMIFICATION.ranks.map((r) => r.name)).toEqual([
      'Beginner',
      'Apprentice',
      'Listener',
      'Musician',
      'Virtuoso',
      'Maestro',
      'Mozart',
    ]);
    expect(GAMIFICATION.ranks.map((r) => r.requiredXp)).toEqual([
      0, 100, 300, 700, 1500, 3000, 5000,
    ]);
    expect(GAMIFICATION.ranks.map((r) => r.requiredMastery.length)).toEqual([0, 1, 2, 4, 6, 8, 9]);
    expect(GAMIFICATION.ranks[6].requiredMastery).toEqual(LEVELS);
    expect(LEVELS).toHaveLength(9);
  });
});

describe('phrase XP', () => {
  test('nothing below the pass mark', () => {
    expect(phraseReward(79)).toBeNull();
    expect(phraseReward(0)).toBeNull();
  });

  test('10 XP from 80%, +5 from 90%, +5 more at 100%', () => {
    expect(phraseReward(80)).toEqual({ base: 10, bonus: 0, xp: 10 });
    expect(phraseReward(89)).toEqual({ base: 10, bonus: 0, xp: 10 });
    expect(phraseReward(90)).toEqual({ base: 10, bonus: 5, xp: 15 });
    expect(phraseReward(99)).toEqual({ base: 10, bonus: 5, xp: 15 });
    expect(phraseReward(100)).toEqual({ base: 10, bonus: 10, xp: 20 });
  });

  test('the numbers come from the configuration', () => {
    const cfg = {
      ...GAMIFICATION,
      passAccuracy: 50,
      phraseXp: { base: 1, accuracy90: 2, accuracy100: 3 },
    };
    expect(phraseReward(50, cfg)).toEqual({ base: 1, bonus: 0, xp: 1 });
    expect(phraseReward(100, cfg)).toEqual({ base: 1, bonus: 5, xp: 6 });
  });
});

describe('level mastery', () => {
  test('needs ten completions, a recent average of 85% and three without hints', () => {
    const nine = many(9, L1, 100);
    expect(levelMastery(nine, L1).mastered).toBe(false);
    expect(levelMastery([...nine, done(L1, 100)], L1).mastered).toBe(true);
  });

  test('averages only the latest five completions', () => {
    const early = many(6, L1, 80);
    const late = many(5, L1, 90);
    const m = levelMastery([...early, ...late], L1);
    expect(m).toMatchObject({ completed: 11, recentAverage: 90, mastered: true });
    const slip = levelMastery([...many(8, L1, 100), ...many(5, L1, 80)], L1);
    expect(slip).toMatchObject({ recentAverage: 80, mastered: false });
  });

  test('needs three completions without hints', () => {
    const hinted = many(10, L1, 100, { hintsUsed: 1 });
    expect(levelMastery(hinted, L1)).toMatchObject({ withoutHints: 0, mastered: false });
    const two = [...many(8, L1, 100, { hintsUsed: 2 }), ...many(2, L1, 100)];
    expect(levelMastery(two, L1).mastered).toBe(false);
    const three = [...many(7, L1, 100, { hintsUsed: 2 }), ...many(3, L1, 100)];
    expect(levelMastery(three, L1).mastered).toBe(true);
  });

  test('levels are independent', () => {
    const all = [...many(10, L1, 100), ...many(3, L2, 100)];
    expect(levelMastery(all, L1).mastered).toBe(true);
    expect(levelMastery(all, L2)).toMatchObject({ completed: 3, mastered: false });
  });

  test('a completion reported twice is counted once', () => {
    const one = done(L1, 100);
    expect(levelMastery([one, one, one], L1).completed).toBe(1);
  });

  test('says what is still needed', () => {
    expect(levelMastery(many(4, L1, 80), L1).needs).toEqual({
      completed: { have: 4, need: 10 },
      average: { have: 80, need: 85 },
      withoutHints: { have: 4, need: 3 },
    });
  });

  test('the date mastery was reached is that of the completion that completed it', () => {
    const list = many(12, L1, 100);
    expect(masteredAt(list, L1)).toBe(list[9].completedAt);
    expect(masteredAt(many(9, L1, 100), L1)).toBeNull();
  });
});

describe('ranks', () => {
  test('XP alone never unlocks a rank', () => {
    const p = rankProgress(5000, []);
    expect(p.name).toBe('Beginner');
    expect(p.locked).toBe(true);
    expect(p.missing).toEqual({ xp: 0, levels: [L1] });
  });

  test('both conditions together unlock it', () => {
    expect(rankProgress(100, [L1]).name).toBe('Apprentice');
    expect(rankProgress(99, [L1]).name).toBe('Beginner');
  });

  test('mastery alone does not unlock it either', () => {
    expect(rankProgress(40, [L1]).name).toBe('Beginner');
  });

  test('ranks are climbed in order: a high rank needs the ones below it', () => {
    // Enough for Listener (300 XP, L1–2) but L1 is not mastered.
    expect(rankProgress(400, [L2]).name).toBe('Beginner');
    expect(rankProgress(400, [L1, L2]).name).toBe('Listener');
  });

  test('the top rank needs every level', () => {
    expect(rankProgress(9000, LEVELS.slice(0, 8)).name).toBe('Maestro');
    const top = rankProgress(5000, LEVELS);
    expect(top).toMatchObject({ name: 'Mozart', next: null, pct: 100, locked: false });
  });

  test('progress to the next rank', () => {
    const p = rankProgress(250, [L1]);
    expect(p).toMatchObject({ name: 'Apprentice', index: 1, xp: 250, pct: 75 });
    expect(p.next?.name).toBe('Listener');
    expect(p.missing).toEqual({ xp: 50, levels: [L2] });
    expect(p.locked).toBe(false);
  });

  test('a rank-up is named when the rank rises', () => {
    expect(rankUp(rankProgress(90, [L1]), rankProgress(100, [L1]))).toBe('Apprentice');
    expect(rankUp(rankProgress(100, [L1]), rankProgress(150, [L1]))).toBeNull();
    expect(rankUp(rankProgress(300, [L1]), rankProgress(300, [L1, L2]))).toBe('Listener');
  });
});

describe('daily challenges', () => {
  const day = '2026-11-10';

  test('three challenges at zero on a fresh day', () => {
    const states = challengeStates(day, []);
    expect(states.map((s) => [s.id, s.progress, s.target, s.rewardXp, s.completed])).toEqual([
      ['practice', 0, 3, 10, false],
      ['accuracy', 0, 1, 20, false],
      ['consistency', 0, 5, 35, false],
    ]);
  });

  test('progress follows the completions of that day only', () => {
    const today = many(3, L1, 85);
    const yesterday = many(4, L1, 100, { day: '2026-11-09' });
    const states = challengeStates(day, [...today, ...yesterday]);
    expect(states.map((s) => [s.progress, s.completed])).toEqual([
      [3, true],
      [0, false],
      [3, false],
    ]);
  });

  test('the accuracy challenge needs one melody at 90%', () => {
    expect(challengeStates(day, [done(L1, 89)])[1].completed).toBe(false);
    expect(challengeStates(day, [done(L1, 90)])[1]).toMatchObject({ progress: 1, completed: true });
  });

  test('progress is capped at the target', () => {
    expect(challengeStates(day, many(8, L1, 100))[0].progress).toBe(3);
  });

  test('a completion counted twice is one', () => {
    const one = done(L1, 100);
    expect(challengeStates(day, [one, one])[0].progress).toBe(1);
  });

  test('how many challenges are still to do', () => {
    expect(challengesLeft(challengeStates(day, []))).toBe(3);
    expect(challengesLeft(challengeStates(day, many(3, L1, 85)))).toBe(2);
    expect(challengesLeft(challengeStates(day, many(3, L1, 95)))).toBe(1);
    expect(challengesLeft(challengeStates(day, many(5, L1, 95)))).toBe(0);
    expect(challengesLeft([])).toBe(0);
  });
});
