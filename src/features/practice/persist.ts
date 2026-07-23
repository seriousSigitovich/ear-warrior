// Attempt/session persistence + anonymous logging on each graded attempt (T033, FR-012/FR-018).
// Local SQLite is the source of truth; the anonymous log is best-effort and never blocks the loop (R9).
import { Attempt, DifficultyLevel, Melody, Session } from '../../models';
import { accuracyPct } from '../../lib/sessionState';
import { AttemptRepository, SessionRepository } from '../../services/storage/repositories';
import {
  AttemptLogOutbox,
  buildAttemptLogPayload,
} from '../../services/logging/attemptLog';

export interface PersistDeps {
  attempts: AttemptRepository;
  sessions: SessionRepository;
  outbox: AttemptLogOutbox;
  appVersion: string;
  deviceId: string;
}

/**
 * Persist a graded attempt, update the session summary, and enqueue an anonymous log.
 * The log call is fire-and-forget so telemetry never delays feedback.
 */
export async function persistGradedAttempt(
  attempt: Attempt,
  session: Session,
  melody: Melody,
  level: DifficultyLevel,
  deps: PersistDeps,
): Promise<void> {
  await deps.attempts.create(attempt);

  const attemptCount = session.attemptCount + 1;
  const correctSoFar =
    Math.round((session.accuracyPct / 100) * session.attemptCount) + (attempt.verdict === 'correct' ? 1 : 0);
  const updated: Partial<Session> = {
    attemptCount,
    accuracyPct: accuracyPct({ ...session, attemptCount, correctCount: correctSoFar } as never),
  };
  await deps.sessions.update(session.id, updated);

  // Best-effort, non-blocking telemetry.
  void deps.outbox.log(
    buildAttemptLogPayload(attempt, melody, level, deps.deviceId, deps.appVersion),
  );
}
