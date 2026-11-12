// Manual override of a day's challenges (spec 020): validation and the store contract. The limits are exactly
// the ones the app applies to the server's answer (src/services/challenges/client.ts): an override the app
// would drop as a whole must never be stored.
import type { ChallengeType, DailyChallenge, DailyChallenges } from './daily.js';

export const SLOTS = 3;
export const MAX_DAYS_AHEAD = 90;

/** One slot as the owner types it; strings or numbers, nothing is trusted yet. */
export interface SlotInput {
  type: unknown;
  target: unknown;
  rewardXp: unknown;
  title: unknown;
  description: unknown;
}

export interface DayInput {
  challenges: SlotInput[];
  allBonusXp: unknown;
}

export type Parsed = { ok: true; day: DailyChallenges } | { ok: false; errors: string[] };

const int = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string' && /^\d{1,6}$/.test(v.trim())) return Number(v.trim());
  return null;
};

const range = (v: unknown, min: number, max: number): number | null => {
  const n = int(v);
  return n !== null && n >= min && n <= max ? n : null;
};

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
};

/** Validates a day typed by the owner; on success the challenges carry unique, app-valid ids. */
export function parseDay(date: string, input: DayInput): Parsed {
  const errors: string[] = [];
  const bonus = range(input.allBonusXp, 0, 500);
  if (bonus === null) errors.push('Бонус за все: целое число 0–500');
  if (!Array.isArray(input.challenges) || input.challenges.length !== SLOTS) {
    return { ok: false, errors: [...errors, `Нужно ровно ${SLOTS} челленджа`] };
  }

  const used = new Set<string>();
  const challenges: DailyChallenge[] = [];
  input.challenges.forEach((raw, i) => {
    const n = i + 1;
    const type = raw.type === 'melodies' || raw.type === 'accuracy' ? (raw.type as ChallengeType) : null;
    if (!type) errors.push(`№${n}: тип — melodies или accuracy`);
    const target = type === 'accuracy' ? range(raw.target, 50, 100) : range(raw.target, 1, 20);
    if (type && target === null) errors.push(`№${n}: цель — ${type === 'accuracy' ? 'процент 50–100' : 'мелодий 1–20'}`);
    const rewardXp = range(raw.rewardXp, 0, 500);
    if (rewardXp === null) errors.push(`№${n}: XP — целое число 0–500`);
    const title = text(raw.title, 80);
    if (title === null) errors.push(`№${n}: заголовок — 1–80 символов`);
    const description = text(raw.description, 120);
    if (description === null) errors.push(`№${n}: описание — 1–120 символов`);
    if (!type || target === null || rewardXp === null || title === null || description === null) return;

    // The app pays by id, so an id is stable for its content and unique within the day.
    let id = `${type}-${target}`;
    if (used.has(id)) id = `${id}-${n}`;
    used.add(id);
    challenges.push({ id, type, target, rewardXp, title, description });
  });

  return errors.length || bonus === null ? { ok: false, errors } : { ok: true, day: { date, challenges, allBonusXp: bonus } };
}

/** Where overrides live. Dates are `YYYY-MM-DD` calendar days. */
export interface ChallengeStore {
  get(date: string): Promise<DailyChallenges | null>;
  /** Overrides with `from <= date <= to`, oldest first. */
  list(from: string, to: string): Promise<DailyChallenges[]>;
  set(day: DailyChallenges): Promise<void>;
  remove(date: string): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number): string => utcDay(new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS));

/** The earliest editable day is tomorrow (UTC); today may already be on devices. */
export function isEditable(date: string, now: Date): boolean {
  const today = utcDay(now);
  return date >= addDays(today, 1) && date <= addDays(today, MAX_DAYS_AHEAD);
}
