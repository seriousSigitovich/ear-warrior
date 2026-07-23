// Session lifecycle hook (T035B, FR-018). Wraps the pure session reducer with React state and mirrors
// pause/resume/end + attempt tallies into the durable session repository so results survive interruption.
import { useCallback, useReducer } from 'react';
import { Session } from '../../models';
import {
  SessionEvent,
  SessionState,
  accuracyPct,
  sessionReducer,
  startSession,
} from '../../lib/sessionState';
import { SessionRepository } from '../../services/storage/repositories';

export function useSession(
  sessionId: string,
  repo: SessionRepository,
  nowMs: () => number = Date.now,
) {
  const [state, rawDispatch] = useReducer(sessionReducer, startSession(nowMs()));

  const persist = useCallback(
    (next: SessionState) => {
      const patch: Partial<Session> = {
        attemptCount: next.attemptCount,
        accuracyPct: accuracyPct(next),
        endedAt: next.endedAtMs === null ? null : new Date(next.endedAtMs).toISOString(),
      };
      void repo.update(sessionId, patch);
    },
    [repo, sessionId],
  );

  const dispatch = useCallback(
    (event: SessionEvent) => {
      rawDispatch(event);
      // Reducer is pure; compute the next state to persist deterministically.
      persist(sessionReducer(state, event));
    },
    [persist, state],
  );

  return {
    state,
    pause: () => dispatch({ type: 'pause' }),
    resume: () => dispatch({ type: 'resume' }),
    end: () => dispatch({ type: 'end', atMs: nowMs() }),
    recordAttempt: (correct: boolean) => dispatch({ type: 'recordAttempt', correct }),
  };
}
