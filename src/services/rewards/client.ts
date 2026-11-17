// HTTP transport of the server-authoritative practice routes (spec 024, server: routes/phrase.ts). Never throws and
// never waits forever. A check distinguishes "the server could not be reached" (keep it and send it later) from "the
// server refused it" (it will never be accepted: drop it) from "who are you?" (the session is gone).
import type { NoteResult } from '../../models';
import type {
  ChallengeView,
  CheckInput,
  PayoutView,
  PhraseResult,
  QueuedCheck,
  RankRef,
  RankView,
  RewardsView,
} from './types';

const TIMEOUT_MS = 8000;

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function rankRef(raw: unknown): RankRef | null {
  return isObject(raw) && typeof raw.id === 'string'
    ? { id: raw.id, name: str(raw.name, raw.id), xp: num(raw.xp) }
    : null;
}

function rankView(raw: unknown): RankView | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    name: str(raw.name, raw.id),
    index: num(raw.index),
    next: rankRef(raw.next),
    xpToNext: num(raw.xp_to_next),
    pct: Math.min(100, Math.max(0, num(raw.pct))),
  };
}

function challengeView(raw: unknown): ChallengeView | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    title: str(raw.title),
    description: str(raw.description),
    progress: num(raw.progress),
    target: Math.max(1, num(raw.target, 1)),
    rewardXp: num(raw.reward_xp),
    completed: raw.completed === true,
  };
}

/** The standing as the server states it for `today`; null when it is not what the app expects. */
export function parseView(raw: unknown, today: string, ranks: RankRef[] = []): RewardsView | null {
  if (!isObject(raw)) return null;
  const rank = rankView(raw.rank);
  if (!rank || typeof raw.total_xp !== 'number') return null;
  const streak = isObject(raw.streak) ? raw.streak : {};
  const days = Array.isArray(raw.active_days)
    ? raw.active_days.filter((d): d is string => typeof d === 'string')
    : [];
  const challenges = (Array.isArray(raw.challenges) ? raw.challenges : [])
    .map(challengeView)
    .filter((c): c is ChallengeView => c !== null);
  return {
    totalXp: raw.total_xp,
    rank,
    ranks,
    streak: { days: num(streak.days), practicedToday: days.includes(today) },
    today,
    activeDays: new Set(days),
    challenges,
    allChallengesDone: challenges.length > 0 && challenges.every((c) => c.completed),
    dailyBonusXp: num(raw.daily_bonus_xp),
  };
}

function noteResults(raw: unknown): NoteResult[] {
  return (Array.isArray(raw) ? raw : []).filter(isObject).map((r): NoteResult => {
    const expected = typeof r.expected_midi === 'number' ? r.expected_midi : null;
    const detected = typeof r.detected_midi === 'number' ? r.detected_midi : null;
    const status = ['matched', 'wrong', 'missed', 'extra'].includes(r.status as string)
      ? (r.status as NoteResult['status'])
      : 'wrong';
    return {
      targetIndex: typeof r.target_index === 'number' ? r.target_index : null,
      status,
      expectedMidi: expected,
      detectedMidi: detected,
      octaveMismatch:
        status === 'wrong' &&
        expected !== null &&
        detected !== null &&
        expected !== detected &&
        expected % 12 === detected % 12,
    };
  });
}

function payoutView(raw: unknown): PayoutView | null {
  if (!isObject(raw)) return null;
  const reasons = ['below_pass', 'answer_shown', 'attempts', 'already_paid'];
  return {
    paid: raw.paid === true,
    xp: num(raw.xp),
    base: num(raw.base),
    levelMult: num(raw.level_mult, 1),
    attemptNo: num(raw.attempt_no, 1),
    attemptFactor: num(raw.attempt_factor, 1),
    hintFactor: num(raw.hint_factor, 1),
    capFactor: num(raw.cap_factor, 1),
    reason: reasons.includes(raw.reason as string) ? (raw.reason as PayoutView['reason']) : null,
  };
}

/** The answer to a phrase check; null when it is not what the app expects. */
export function parseResult(raw: unknown, today: string): PhraseResult | null {
  if (!isObject(raw) || raw.ok !== true || !isObject(raw.grade) || !isObject(raw.state))
    return null;
  const payout = payoutView(raw.payout);
  const view = parseView(raw.state, today);
  if (!payout || !view) return null;
  const up =
    isObject(raw.state.rank_up) && typeof raw.state.rank_up.id === 'string'
      ? { id: raw.state.rank_up.id, name: str(raw.state.rank_up.name) }
      : null;
  const paid = (Array.isArray(raw.state.challenges_paid) ? raw.state.challenges_paid : [])
    .filter(isObject)
    .map((c) => ({ id: str(c.id), rewardXp: num(c.reward_xp) }));
  return {
    grade: {
      accuracy: num(raw.grade.accuracy),
      passed: raw.grade.passed === true,
      verdict: raw.grade.verdict === 'correct' ? 'correct' : 'incorrect',
      noteResults: noteResults(raw.grade.note_results),
    },
    payout,
    replay: raw.replay === true,
    view,
    rankUp: up,
    streakExtended: isObject(raw.state.streak) && raw.state.streak.extended === true,
    challengesPaid: paid,
    allBonusXp: num(raw.state.all_bonus_xp),
  };
}

export type CheckAnswer =
  | { kind: 'ok'; result: PhraseResult }
  /** The server was not reached (no network, a timeout, a 5xx): keep the check. */
  | { kind: 'offline' }
  /** The server will never accept it (unknown tune or phrase, a bad body): drop it. */
  | { kind: 'rejected' }
  /** The session is not valid (an anonymous identity that was merged, a signed-out account). */
  | { kind: 'unauthorized' };

export interface RewardsClient {
  /** A device-only identity (one per device); the token, or null when the server cannot be reached. */
  anonymous(deviceId: string): Promise<string | null>;
  check(token: string, item: QueuedCheck): Promise<CheckAnswer>;
  /** The first note of a phrase (recorded: it halves the phrase's payout); null when it cannot be had. */
  hint(token: string, tuneId: string, phrase: number): Promise<number | null>;
  /** The whole phrase (recorded: the phrase then pays nothing); null when it cannot be had. */
  answer(token: string, tuneId: string, phrase: number): Promise<number[] | null>;
  state(token: string, today: string): Promise<{ view: RewardsView } | 'unauthorized' | null>;
  /** The one-time import of what was done before the server graded phrases. True once the server has it (or already had). */
  legacyImport(
    token: string,
    phrases: { tuneId: string; phrase: number; accuracy: number; at: string }[],
  ): Promise<boolean>;
}

export function createRewardsClient(
  apiUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): RewardsClient | null {
  if (!apiUrl) return null;
  const base = apiUrl.replace(/\/$/, '');

  async function call(
    method: 'GET' | 'POST',
    path: string,
    token: string | null,
    body?: unknown,
  ): Promise<{ status: number; json: unknown } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${base}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async anonymous(deviceId) {
      const res = await call('POST', '/api/auth/anonymous', null, { device_id: deviceId });
      return res?.status === 200 && isObject(res.json) && typeof res.json.token === 'string'
        ? res.json.token
        : null;
    },

    async check(token, item) {
      const res = await call('POST', '/api/progress/phrase', token, {
        check_id: item.checkId,
        tune_id: item.tuneId,
        phrase: item.phrase,
        played: item.played,
        checked_at: item.checkedAt,
        local_day: item.localDay,
      });
      if (!res || res.status >= 500 || res.status === 429) return { kind: 'offline' };
      if (res.status === 401) return { kind: 'unauthorized' };
      if (res.status === 200) {
        const result = parseResult(res.json, item.localDay);
        return result ? { kind: 'ok', result } : { kind: 'offline' };
      }
      return { kind: 'rejected' };
    },

    async hint(token, tuneId, phrase) {
      const res = await call('POST', '/api/phrase/hint', token, { tune_id: tuneId, phrase });
      return res?.status === 200 && isObject(res.json) && typeof res.json.first_midi === 'number'
        ? res.json.first_midi
        : null;
    },

    async answer(token, tuneId, phrase) {
      const res = await call('POST', '/api/phrase/answer', token, { tune_id: tuneId, phrase });
      if (res?.status !== 200 || !isObject(res.json) || !Array.isArray(res.json.notes)) return null;
      const notes = res.json.notes.filter((n): n is number => typeof n === 'number');
      return notes.length === res.json.notes.length ? notes : null;
    },

    async state(token, today) {
      const res = await call('GET', `/api/progress/state?date=${encodeURIComponent(today)}`, token);
      if (!res) return null;
      if (res.status === 401) return 'unauthorized';
      if (res.status !== 200 || !isObject(res.json)) return null;
      const ranks = (Array.isArray(res.json.ranks) ? res.json.ranks : [])
        .map(rankRef)
        .filter((r): r is RankRef => r !== null);
      const view = parseView(res.json, today, ranks);
      return view ? { view } : null;
    },

    async legacyImport(token, phrases) {
      const res = await call('POST', '/api/progress/legacy-import', token, {
        phrases: phrases.map((p) => ({
          tune_id: p.tuneId,
          phrase: p.phrase,
          accuracy: p.accuracy,
          at: p.at,
        })),
      });
      // 409: the server already has an import for this identity; 410: the window is closed. Either way, done.
      return res !== null && (res.status === 200 || res.status === 409 || res.status === 410);
    },
  };
}

export type { CheckInput };
