import { Attempt, Session } from '../../src/models';
import { createInMemoryRowStore } from '../../src/services/storage/db';
import {
  createAttemptRepository,
  createSessionRepository,
} from '../../src/services/storage/repositories';

function session(id: string): Session {
  return {
    id,
    startedAt: '2026-07-23T00:00:00.000Z',
    endedAt: null,
    difficultyMode: 'adaptive',
    currentDifficultyId: 'L1',
    attemptCount: 0,
    accuracyPct: 0,
  };
}

function attempt(id: string, sessionId: string): Attempt {
  return {
    id,
    sessionId,
    melodyId: 'mel1',
    detectedNotes: [],
    noteResults: [],
    verdict: 'correct',
    confidence: 0.9,
    lowConfidence: false,
    timedOut: false,
    createdAt: '2026-07-23T00:00:01.000Z',
  };
}

describe('session & attempt repositories (T012, FR-012/FR-018)', () => {
  test('creates and reads back a session (round-trip)', async () => {
    const store = createInMemoryRowStore();
    const repo = createSessionRepository(store);
    await repo.create(session('s1'));
    expect(await repo.get('s1')).toMatchObject({ id: 's1', currentDifficultyId: 'L1' });
  });

  test('updates a session summary', async () => {
    const store = createInMemoryRowStore();
    const repo = createSessionRepository(store);
    await repo.create(session('s1'));
    await repo.update('s1', { attemptCount: 3, accuracyPct: 66.6, endedAt: '2026-07-23T00:10:00Z' });
    const s = await repo.get('s1');
    expect(s?.attemptCount).toBe(3);
    expect(s?.endedAt).toBe('2026-07-23T00:10:00Z');
  });

  test('completed records survive a "restart" (a fresh repo over the same store)', async () => {
    const store = createInMemoryRowStore();
    await createSessionRepository(store).create(session('s1'));
    // Simulate app restart: new repository instance, same durable store.
    expect(await createSessionRepository(store).get('s1')).not.toBeNull();
  });

  test('lists attempts filtered by session', async () => {
    const store = createInMemoryRowStore();
    const attempts = createAttemptRepository(store);
    await attempts.create(attempt('a1', 's1'));
    await attempts.create(attempt('a2', 's1'));
    await attempts.create(attempt('a3', 's2'));
    expect((await attempts.forSession('s1')).map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(await attempts.forSession('s2')).toHaveLength(1);
  });
});
