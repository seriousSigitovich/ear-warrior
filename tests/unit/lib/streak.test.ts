import { DAILY_GOAL, dayKey, daysLabel, practiceStreak, streakLine } from '../../../src/lib/streak';

/** A local time on a day of November 2026, as the ISO string an attempt stores. */
const at = (day: number, hour = 12) => new Date(2026, 10, day, hour).toISOString();
const now = new Date(2026, 10, 10, 18);

describe('practice streak', () => {
  test('no practice: nothing to show', () => {
    expect(practiceStreak([], now)).toEqual({
      days: 0,
      today: 0,
      goal: DAILY_GOAL,
      goalMet: false,
      best: 0,
    });
  });

  test('days in a row up to today count, and today counts its melodies', () => {
    const s = practiceStreak([at(8), at(9), at(10, 9), at(10, 10)], now);
    expect(s).toMatchObject({ days: 3, today: 2, goalMet: false, best: 3 });
  });

  test('a day not practised on yet keeps yesterday’s run alive', () => {
    expect(practiceStreak([at(8), at(9)], now)).toMatchObject({ days: 2, today: 0, best: 2 });
  });

  test('a missed day ends the run, but the best run is remembered', () => {
    const s = practiceStreak([at(3), at(4), at(5), at(6), at(10)], now);
    expect(s).toMatchObject({ days: 1, today: 1, best: 4 });
    expect(practiceStreak([at(3), at(4)], now)).toMatchObject({ days: 0, best: 2 });
  });

  test('the goal is met at the daily number of melodies', () => {
    const today = Array.from({ length: DAILY_GOAL }, (_, i) => at(10, 8 + i));
    expect(practiceStreak(today, now)).toMatchObject({ today: DAILY_GOAL, goalMet: true, days: 1 });
  });

  test('a day is the local calendar day: late evening and early morning are different days', () => {
    const s = practiceStreak([at(9, 23), at(10, 0)], new Date(2026, 10, 10, 0, 30));
    expect(s).toMatchObject({ days: 2, today: 1 });
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  test('unreadable times are ignored', () => {
    expect(practiceStreak(['', 'nope', at(10)], now)).toMatchObject({ days: 1, today: 1 });
  });

  test('wording', () => {
    expect([0, 1, 2].map(daysLabel)).toEqual(['0 days', '1 day', '2 days']);
    expect(streakLine(practiceStreak([at(10)], now))).toBe(`1 of ${DAILY_GOAL} today`);
    expect(streakLine(practiceStreak([at(8), at(9), at(10)], now))).toBe(
      `3-day streak · 1 of ${DAILY_GOAL} today`,
    );
    const done = [at(9), ...Array.from({ length: DAILY_GOAL }, (_, i) => at(10, 8 + i))];
    expect(streakLine(practiceStreak(done, now))).toBe("2-day streak · Today's goal done");
  });
});
