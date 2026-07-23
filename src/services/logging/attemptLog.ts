// Anonymous, insert-only attempt logging with an offline outbox (R9, contracts/supabase-attempt-log.md).
// Best-effort: logging never blocks or fails the practice loop. Local SQLite stays the source of truth.
// The Supabase client is injected so queue/flush/retry logic is testable against a mock.
import { AttemptGrade, DifficultyLevel, Melody } from '../../models';

/** Anonymized aggregate payload — never audio, per-note pitches, timestamps, location, or PII (R9). */
export interface AttemptLogPayload {
  device_id: string;
  app_version: string;
  difficulty_id: string;
  difficulty_rank: number;
  note_count: number;
  verdict: 'correct' | 'incorrect';
  matched_count: number;
  wrong_count: number;
  missed_count: number;
  extra_count: number;
  confidence: number;
  octave_mismatch: boolean;
}

export interface AttemptLogClient {
  insert(row: AttemptLogPayload): Promise<void>;
}

/** Build the anonymized payload from a graded attempt. Pure. */
export function buildAttemptLogPayload(
  grade: AttemptGrade,
  melody: Melody,
  level: DifficultyLevel,
  deviceId: string,
  appVersion: string,
): AttemptLogPayload {
  const count = (status: string) => grade.noteResults.filter((r) => r.status === status).length;
  return {
    device_id: deviceId,
    app_version: appVersion,
    difficulty_id: level.id,
    difficulty_rank: level.rank,
    note_count: melody.notes.length,
    verdict: grade.verdict,
    matched_count: count('matched'),
    wrong_count: count('wrong'),
    missed_count: count('missed'),
    extra_count: count('extra'),
    confidence: grade.confidence,
    octave_mismatch: grade.noteResults.some((r) => r.octaveMismatch),
  };
}

export interface AttemptLogOutbox {
  /** Best-effort log; queues locally on failure and NEVER throws to the caller. */
  log(payload: AttemptLogPayload): Promise<void>;
  /** Attempt to insert all queued payloads; stops (keeping the rest) on the first failure. */
  flush(): Promise<void>;
  /** Number of payloads currently queued. */
  pending(): number;
}

/** Table the anonymized rows are inserted into (contracts/supabase-attempt-log.md). */
export const ATTEMPT_LOG_TABLE = 'attempt_log';

/**
 * Real Supabase-backed client (lazily required; never loaded under the pure-logic test runner).
 * Returns null when the project isn't configured, so a build without Supabase env simply logs
 * nothing rather than failing the loop.
 */
export function defaultAttemptLogClient(url?: string, anonKey?: string): AttemptLogClient | null {
  if (!url || !anonKey) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  return {
    async insert(row) {
      const { error } = await client.from(ATTEMPT_LOG_TABLE).insert(row);
      if (error) throw new Error(error.message);
    },
  };
}

/** Client that drops every row — used when Supabase is not configured. */
export function createNullAttemptLogClient(): AttemptLogClient {
  return { async insert() {} };
}

export function createAttemptLogOutbox(
  client: AttemptLogClient,
  queue: AttemptLogPayload[] = [],
): AttemptLogOutbox {
  return {
    async log(payload) {
      try {
        await client.insert(payload);
      } catch {
        queue.push(payload); // offline / failure → keep for later, never surface to the loop
      }
    },
    async flush() {
      while (queue.length > 0) {
        try {
          await client.insert(queue[0]);
          queue.shift();
        } catch {
          break; // still unreachable; retry on the next flush
        }
      }
    },
    pending: () => queue.length,
  };
}
