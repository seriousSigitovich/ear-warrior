// HTTP transport for the signed-in learner's progress, one call per action (server: routes/progress.ts):
//   POST /api/progress/attempts   PUT/GET /api/progress/difficulty   GET /api/progress/history
// Never throws and never waits forever: a refusal, an unreadable answer, no network or a slow server is
// `false` / `null`, so the practice loop just carries on with the local cache.
import type { Attempt, DifficultySettings } from '../../models';
import type { TuneHistory } from '../melody/curated';

export interface ProgressClient {
  /** True once the server has the attempt (storing it twice is harmless). */
  postAttempt(token: string, attempt: Attempt): Promise<boolean>;
  history(token: string): Promise<TuneHistory | null>;
  getDifficulty(token: string): Promise<DifficultySettings | null>;
  putDifficulty(token: string, settings: DifficultySettings): Promise<boolean>;
}

const TIMEOUT_MS = 5000;

type Body = Record<string, unknown>;

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Real HTTP client; null when no API base URL is configured, so such a build keeps progress on the device. */
export function createProgressClient(baseUrl?: string, fetchImpl: typeof fetch = fetch): ProgressClient | null {
  if (!baseUrl) return null;
  const root = baseUrl.replace(/\/$/, '');

  async function call(method: string, path: string, token: string, body?: Body): Promise<Body | null> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: abort.signal,
      });
      const json = (await res.json()) as Body;
      return json.ok === true ? json : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async postAttempt(token, a) {
      const sent = await call('POST', '/api/progress/attempts', token, {
        id: a.id,
        session_id: a.sessionId,
        melody_id: a.melodyId,
        verdict: a.verdict,
        confidence: a.confidence,
        low_confidence: a.lowConfidence,
        timed_out: a.timedOut,
        input_mode: a.inputMode ?? 'mic',
        note_results: a.noteResults,
        created_at: a.createdAt,
      });
      return sent !== null;
    },

    async history(token) {
      const json = await call('GET', '/api/progress/history', token);
      return json ? { mastered: strings(json.mastered), recent: strings(json.recent) } : null;
    },

    async getDifficulty(token) {
      const j = await call('GET', '/api/progress/difficulty', token);
      if (!j) return null;
      return {
        mode: j.mode as DifficultySettings['mode'],
        adaptiveRank: Number(j.adaptive_rank),
        fixedRank: Number(j.fixed_rank),
        streakKind: j.streak_kind as DifficultySettings['streakKind'],
        streakCount: Number(j.streak_count),
      };
    },

    async putDifficulty(token, s) {
      const sent = await call('PUT', '/api/progress/difficulty', token, {
        mode: s.mode,
        adaptive_rank: s.adaptiveRank,
        fixed_rank: s.fixedRank,
        streak_kind: s.streakKind,
        streak_count: s.streakCount,
      });
      return sent !== null;
    },
  };
}
