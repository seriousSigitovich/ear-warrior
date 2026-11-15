// Practice days (spec 013): a day is the learner's local calendar day as "YYYY-MM-DD", fixed at the
// moment the practice happened, so a later change of timezone never moves it. The streak is the run of
// consecutive days with practice; the week strip draws the current week. Pure.

const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar day in local time as "YYYY-MM-DD". */
export function dayKey(d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Local noon of a day key: noon, so a DST shift never skips or repeats a day. */
function noonOf(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** The day `n` days after `key` (negative: before). */
export function shiftDay(key: string, n: number): string {
  return dayKey(new Date(noonOf(key).getTime() + n * DAY_MS));
}

/**
 * Days in a row with practice, counting today — or up to yesterday while today is still open. Opening
 * the app does not break it; only a whole day without practice does.
 */
export function activeStreak(days: ReadonlySet<string>, today: string): number {
  let n = 0;
  for (let back = days.has(today) ? 0 : 1; days.has(shiftDay(today, -back)); back++) n++;
  return n;
}

/** "3 days", "1 day", "0 days". */
export function daysLabel(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** One day of the current week as the week strip draws it. */
export interface WeekDay {
  /** "M", "T", … */
  letter: string;
  /** Practised on (past), not practised on (past), today, or still to come. */
  state: 'done' | 'empty' | 'today' | 'ahead';
  /** Today only: daily challenges done so far. */
  count: number;
  /** Today only: all of them done. */
  goalMet: boolean;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The current week, Monday to Sunday: past days by whether they had practice, today by its challenges. */
export function weekDays(
  active: ReadonlySet<string>,
  today: string,
  challengesDone: number,
  challenges: number,
): WeekDay[] {
  const sinceMonday = (noonOf(today).getDay() + 6) % 7; // getDay: 0 = Sunday
  return LETTERS.map((letter, i) => {
    const key = shiftDay(today, i - sinceMonday);
    const state: WeekDay['state'] =
      i === sinceMonday ? 'today' : i > sinceMonday ? 'ahead' : active.has(key) ? 'done' : 'empty';
    const isToday = i === sinceMonday;
    return {
      letter,
      state,
      count: isToday ? challengesDone : 0,
      goalMet: isToday && challengesDone >= challenges,
    };
  });
}
