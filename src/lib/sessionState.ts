// Pure session lifecycle state machine (FR-018, data-model Session transitions).
// active → paused → active → ended; `ended` is terminal. Completed attempts are tallied and survive
// a pause. No IO — the React hook (src/features/practice/session.ts) drives this and persists it.

export type SessionStatus = 'active' | 'paused' | 'ended';

export interface SessionState {
  status: SessionStatus;
  attemptCount: number;
  correctCount: number;
  startedAtMs: number;
  endedAtMs: number | null;
}

export type SessionEvent =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end'; atMs: number }
  | { type: 'recordAttempt'; correct: boolean };

/** Begin a new active session. */
export function startSession(atMs: number): SessionState {
  return { status: 'active', attemptCount: 0, correctCount: 0, startedAtMs: atMs, endedAtMs: null };
}

/**
 * Apply a lifecycle event. Invalid transitions (e.g. anything after `ended`, resuming while active)
 * are no-ops so the UI can dispatch freely without crashing.
 */
export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  if (state.status === 'ended') {
    return state; // terminal
  }
  switch (event.type) {
    case 'pause':
      return state.status === 'active' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'active' } : state;
    case 'end':
      return { ...state, status: 'ended', endedAtMs: event.atMs };
    case 'recordAttempt':
      // A graded attempt is only recorded while actively practicing.
      if (state.status !== 'active') {
        return state;
      }
      return {
        ...state,
        attemptCount: state.attemptCount + 1,
        correctCount: state.correctCount + (event.correct ? 1 : 0),
      };
    default:
      return state;
  }
}

/** Session accuracy as a percentage (0 when no attempts yet). */
export function accuracyPct(state: SessionState): number {
  return state.attemptCount === 0 ? 0 : (state.correctCount / state.attemptCount) * 100;
}
