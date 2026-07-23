import { accuracyPct, sessionReducer, startSession } from '../../../src/lib/sessionState';

describe('session lifecycle (FR-018)', () => {
  test('starts active with zeroed counters', () => {
    const s = startSession(1000);
    expect(s.status).toBe('active');
    expect(s.attemptCount).toBe(0);
    expect(s.endedAtMs).toBeNull();
  });

  test('transitions active → paused → active → ended', () => {
    let s = startSession(0);
    s = sessionReducer(s, { type: 'pause' });
    expect(s.status).toBe('paused');
    s = sessionReducer(s, { type: 'resume' });
    expect(s.status).toBe('active');
    s = sessionReducer(s, { type: 'end', atMs: 5000 });
    expect(s.status).toBe('ended');
    expect(s.endedAtMs).toBe(5000);
  });

  test('ended is terminal — later events are ignored', () => {
    let s = sessionReducer(startSession(0), { type: 'end', atMs: 1 });
    s = sessionReducer(s, { type: 'resume' });
    s = sessionReducer(s, { type: 'recordAttempt', correct: true });
    expect(s.status).toBe('ended');
    expect(s.attemptCount).toBe(0);
  });

  test('records attempts and computes accuracy', () => {
    let s = startSession(0);
    s = sessionReducer(s, { type: 'recordAttempt', correct: true });
    s = sessionReducer(s, { type: 'recordAttempt', correct: false });
    expect(s.attemptCount).toBe(2);
    expect(s.correctCount).toBe(1);
    expect(accuracyPct(s)).toBe(50);
  });

  test('completed attempts survive a pause; none are recorded while paused', () => {
    let s = startSession(0);
    s = sessionReducer(s, { type: 'recordAttempt', correct: true });
    s = sessionReducer(s, { type: 'pause' });
    s = sessionReducer(s, { type: 'recordAttempt', correct: true }); // ignored while paused
    expect(s.attemptCount).toBe(1);
    s = sessionReducer(s, { type: 'resume' });
    expect(s.attemptCount).toBe(1);
  });
});
