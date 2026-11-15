import { GAMIFICATION } from '../../../src/config/gamification';
import { homeGreeting, rankGoalLine, rankXpLine } from '../../../src/lib/homeCopy';
import { rankProgress } from '../../../src/lib/gamification';
import { WEEKLY_GOAL_DAYS, weekPracticeDays } from '../../../src/lib/streak';

const mastery = (n: number) => GAMIFICATION.ranks[n].requiredMastery;

describe('the greeting', () => {
  test('asks to train before the standing is known and on a day without a streak', () => {
    expect(homeGreeting(null)).toBe('Ready to train?');
    expect(homeGreeting({ days: 0, practicedToday: false })).toBe('Ready to train?');
  });

  test('keeps a streak that is still open, and praises a day already practised', () => {
    expect(homeGreeting({ days: 3, practicedToday: false })).toBe('Keep your 3-day streak going.');
    expect(homeGreeting({ days: 1, practicedToday: false })).toBe('Keep your 1-day streak going.');
    expect(homeGreeting({ days: 1, practicedToday: true })).toBe('Your ear is getting stronger.');
    expect(homeGreeting({ days: 0, practicedToday: true })).toBe('Your ear is getting stronger.');
  });
});

describe('the rank card lines', () => {
  test('XP against the next rank threshold, and just XP at the top', () => {
    expect(rankXpLine(rankProgress(40, []))).toBe('40 / 100 XP');
    const top = rankProgress(9000, GAMIFICATION.ranks[6].requiredMastery);
    expect(top.next).toBeNull();
    expect(rankXpLine(top)).toBe('9000 XP');
  });

  test('what is still missing, in words', () => {
    expect(rankGoalLine(rankProgress(40, []))).toBe(
      '60 XP and mastery of Level 1 to reach Apprentice',
    );
    expect(rankGoalLine(rankProgress(100, []))).toBe('Master Level 1 to reach Apprentice');
    expect(rankGoalLine(rankProgress(40, mastery(1)))).toBe('60 XP to reach Apprentice');
  });

  test('the top rank has no next step', () => {
    expect(rankGoalLine(rankProgress(9000, GAMIFICATION.ranks[6].requiredMastery))).toBe(
      'Top rank reached',
    );
  });
});

describe('days practised this week', () => {
  // 2026-11-11 is a Wednesday: the week is 9 to 15 November.
  const days = (...d: string[]) => new Set(d);

  test('counts the days from Monday to today, and no others', () => {
    expect(weekPracticeDays(days(), '2026-11-11')).toBe(0);
    expect(weekPracticeDays(days('2026-11-09', '2026-11-11'), '2026-11-11')).toBe(2);
    expect(weekPracticeDays(days('2026-11-08', '2026-11-12'), '2026-11-11')).toBe(0);
  });

  test('a Sunday still counts its own week, from the Monday before', () => {
    expect(weekPracticeDays(days('2026-11-09', '2026-11-15'), '2026-11-15')).toBe(2);
  });

  test('the goal is a whole number of days that fits in a week', () => {
    expect(Number.isInteger(WEEKLY_GOAL_DAYS)).toBe(true);
    expect(WEEKLY_GOAL_DAYS).toBeGreaterThan(0);
    expect(WEEKLY_GOAL_DAYS).toBeLessThanOrEqual(7);
  });
});
