import { activeStreak, dayKey, daysLabel, shiftDay, weekDays } from '../../../src/lib/streak';

const set = (...days: string[]) => new Set(days);

describe('days', () => {
  test('a day is the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 0, 6, 0, 0))).toBe('2026-01-06');
  });

  test('days are shifted across month and year ends and across a DST change', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    // US clocks go forward on 8 March 2026, back on 1 November: every day still has its own key.
    expect(shiftDay('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftDay('2026-03-09', -1)).toBe('2026-03-08');
    expect(shiftDay('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDay('2026-11-02', -1)).toBe('2026-11-01');
  });
});

describe('streak', () => {
  const today = '2026-11-10';

  test('no practice: no streak', () => {
    expect(activeStreak(set(), today)).toBe(0);
  });

  test('days in a row up to today', () => {
    expect(activeStreak(set('2026-11-08', '2026-11-09', today), today)).toBe(3);
  });

  test('a day not practised on yet keeps yesterday’s run alive', () => {
    expect(activeStreak(set('2026-11-08', '2026-11-09'), today)).toBe(2);
  });

  test('a missed day resets it', () => {
    expect(activeStreak(set('2026-11-07', '2026-11-08'), today)).toBe(0);
    expect(activeStreak(set('2026-11-07', '2026-11-08', today), today)).toBe(1);
  });

  test('several practices on one day are one day', () => {
    expect(activeStreak(new Set(['2026-11-10', '2026-11-10']), today)).toBe(1);
  });

  test('the run counts across a month end', () => {
    expect(activeStreak(set('2026-10-30', '2026-10-31', '2026-11-01'), '2026-11-01')).toBe(3);
  });

  test('wording', () => {
    expect([0, 1, 2].map(daysLabel)).toEqual(['0 days', '1 day', '2 days']);
  });
});

describe('week', () => {
  test('Monday to Sunday: past days by practice, today by its challenges, the rest ahead', () => {
    // 10 Nov 2026 is a Tuesday; the week is 9–15 Nov.
    const week = weekDays(set('2026-11-09', '2026-11-03'), '2026-11-10', 1, 3);
    expect(week.map((d) => d.letter).join('')).toBe('MTWTFSS');
    expect(week.map((d) => d.state)).toEqual([
      'done',
      'today',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
      'ahead',
    ]);
    expect(week[1]).toMatchObject({ count: 1, goalMet: false });
  });

  test('a past day without practice is empty; today is met when its challenges are', () => {
    // 13 Nov 2026 is a Friday.
    const week = weekDays(set('2026-11-10', '2026-11-13'), '2026-11-13', 3, 3);
    expect(week.map((d) => d.state)).toEqual([
      'empty',
      'done',
      'empty',
      'empty',
      'today',
      'ahead',
      'ahead',
    ]);
    expect(week[4]).toMatchObject({ count: 3, goalMet: true });
  });

  test('on a Sunday the week still starts on the Monday before', () => {
    const week = weekDays(set(), '2026-11-15', 0, 3);
    expect(week.map((d) => d.state)).toEqual([
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'empty',
      'today',
    ]);
  });
});
