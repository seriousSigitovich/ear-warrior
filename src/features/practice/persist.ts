// Attempt persistence + anonymous logging on each graded attempt (T033, FR-012, FR-019).
// Local SQLite is the source of truth; the anonymous log is best-effort and never blocks the loop (R9).
//
// Session summary state (attemptCount / accuracyPct / endedAt) is deliberately NOT written here —
// `useSession` (./session.ts) owns every Session mutation, driven by the pure reducer in
// lib/sessionState. Having both write the summary produced conflicting tallies.
import { Attempt, DifficultyLevel, Melody } from '../../models';
import { AttemptRepository, MelodyRepository } from '../../services/storage/repositories';
import { AttemptLogOutbox, buildAttemptLogPayload } from '../../services/logging/attemptLog';

export interface PersistDeps {
  attempts: AttemptRepository;
  melodies: MelodyRepository;
  outbox: AttemptLogOutbox;
  appVersion: string;
  deviceId: string;
}

/**
 * Persist a graded attempt and enqueue an anonymous log.
 * The log call is fire-and-forget so telemetry never delays feedback.
 */
export async function persistGradedAttempt(
  attempt: Attempt,
  melody: Melody,
  level: DifficultyLevel,
  deps: PersistDeps,
): Promise<void> {
  // Upsert the melody first so the attempt's `melodyId` never dangles; a retry re-saves the same row.
  await deps.melodies.save(melody);
  await deps.attempts.create(attempt);

  // Best-effort, non-blocking telemetry.
  void deps.outbox.log(
    buildAttemptLogPayload(attempt, melody, level, deps.deviceId, deps.appVersion),
  );
}
