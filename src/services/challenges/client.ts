// The day's challenges from the server (spec 018): GET /api/challenges/today?date=<local day>. The answer is
// validated completely before it is used — one wrong field and the whole answer is dropped, so the app
// carries on with its built-in challenges. Never throws and never waits forever (a refusal, an unreadable
// answer, no network or a slow server is `null`).
import type { ChallengeDef } from '../../config/gamification';

export interface DailyChallenges {
  defs: ChallengeDef[];
  /** Extra XP for finishing all of them. */
  allBonusXp: number;
}

export interface ChallengesClient {
  /** The challenges of local day `date` (YYYY-MM-DD), or null when the server cannot give them. */
  today(date: string): Promise<DailyChallenges | null>;
}

const TIMEOUT_MS = 5000;
const COUNT = 3;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const int = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length >= 1 && v.length <= max;

/** The server's answer as definitions, or null when anything in it is off. */
export function parseDailyChallenges(json: unknown, date: string): DailyChallenges | null {
  if (!isObject(json) || json.ok !== true || json.date !== date) return null;
  if (
    !int(json.all_bonus_xp, 0, 500) ||
    !Array.isArray(json.challenges) ||
    json.challenges.length !== COUNT
  ) {
    return null;
  }
  const defs: ChallengeDef[] = [];
  for (const raw of json.challenges) {
    if (!isObject(raw)) return null;
    const { id, type, target, reward_xp: reward, title, description } = raw;
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id)) return null;
    if (type !== 'melodies' && type !== 'accuracy') return null;
    // Melodies to complete, or the percent one melody must reach.
    if (!(type === 'melodies' ? int(target, 1, 20) : int(target, 50, 100))) return null;
    if (!int(reward, 0, 500) || !text(title, 80) || !text(description, 120)) return null;
    defs.push({
      id,
      type,
      target: target as number,
      rewardXp: reward as number,
      title,
      description,
    });
  }
  return new Set(defs.map((d) => d.id)).size === COUNT
    ? { defs, allBonusXp: json.all_bonus_xp }
    : null;
}

/** Real HTTP client; null when no API base URL is configured (such a build keeps its built-in challenges). */
export function createChallengesClient(
  baseUrl?: string,
  fetchImpl: typeof fetch = fetch,
): ChallengesClient | null {
  if (!baseUrl) return null;
  const root = baseUrl.replace(/\/$/, '');
  return {
    async today(date) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
      try {
        const res = await fetchImpl(
          `${root}/api/challenges/today?date=${encodeURIComponent(date)}`,
          {
            signal: abort.signal,
          },
        );
        return parseDailyChallenges(await res.json(), date);
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
