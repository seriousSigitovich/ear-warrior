// The daily habit: a small goal of melodies per day and the run of days in a row it was practised on.
// Derived from the finished tunes already on record (their `createdAt`), so nothing new is stored and
// nothing is invented. Days are the learner's own calendar days (local time). Pure.

/** Melodies a day that count as the day's practice done. Small on purpose: easy to keep up. */
export const DAILY_GOAL = 3;

export interface Streak {
  /** Days in a row with practice, counting today — or up to yesterday while today is still open. */
  days: number;
  /** Melodies finished today. */
  today: number;
  goal: number;
  goalMet: boolean;
  /** Longest run of days so far. */
  best: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar day in local time as "YYYY-MM-DD". */
export function dayKey(d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Local noon of the day `n` days before `d`'s day: noon, so a DST shift never skips or repeats a day. */
function daysBefore(d: Date, n: number): Date {
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  return new Date(noon.getTime() - n * DAY_MS);
}

/** The streak as of `now`, from the times (ISO) tunes were finished. */
export function practiceStreak(finishedAt: readonly string[], now: Date): Streak {
  const perDay = new Map<string, number>();
  for (const iso of finishedAt) {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    const key = dayKey(t);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const today = perDay.get(dayKey(now)) ?? 0;

  // A day not practised on yet does not break the run: it counts back from yesterday until it is.
  let days = 0;
  for (let back = today > 0 ? 0 : 1; perDay.has(dayKey(daysBefore(now, back))); back++) days++;

  let best = 0;
  for (const key of perDay.keys()) {
    const [y, m, d] = key.split('-').map(Number);
    const day = new Date(y, m - 1, d, 12);
    if (perDay.has(dayKey(daysBefore(day, 1)))) continue; // not the first day of its run
    let run = 1;
    while (perDay.has(dayKey(daysBefore(day, -run)))) run++;
    best = Math.max(best, run);
  }

  return { days, today, goal: DAILY_GOAL, goalMet: today >= DAILY_GOAL, best };
}

/** "3 days", "1 day", "0 days". */
export function daysLabel(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** What to say about the habit once a tune is finished, e.g. "3-day streak · 2 of 3 today". */
export function streakLine(s: Streak): string {
  const today = s.goalMet ? "Today's goal done" : `${s.today} of ${s.goal} today`;
  return s.days > 1 ? `${s.days}-day streak · ${today}` : today;
}
