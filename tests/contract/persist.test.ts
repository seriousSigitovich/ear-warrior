// T066 — attempt persistence + telemetry hand-off (FR-012, FR-019).
// Guards the boundary that converge found unreachable: the loop must actually write the attempt row
// and enqueue exactly one anonymized payload, without letting telemetry failure break the loop.
import { Attempt, DifficultyLevel, Melody } from '../../src/models';
import { createInMemoryRowStore } from '../../src/services/storage/db';
import {
  createAttemptRepository,
  createMelodyRepository,
} from '../../src/services/storage/repositories';
import { AttemptLogOutbox, AttemptLogPayload } from '../../src/services/logging/attemptLog';
import { persistGradedAttempt } from '../../src/features/practice/persist';
import { getLevelByRank } from '../../src/services/melody/levels';

const LEVEL: DifficultyLevel = getLevelByRank(1);

const MELODY: Melody = {
  id: 'mel1',
  notes: [],
  difficultyId: LEVEL.id,
  scale: 'C_major_pentatonic',
  createdAt: '2026-07-24T00:00:00.000Z',
};

function attempt(patch: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a1',
    sessionId: 's1',
    melodyId: MELODY.id,
    detectedNotes: [],
    noteResults: [],
    verdict: 'correct',
    confidence: 0.9,
    lowConfidence: false,
    timedOut: false,
    createdAt: '2026-07-24T00:00:01.000Z',
    ...patch,
  };
}

/** Outbox spy that records what it was handed. */
function spyOutbox(
  onLog?: () => Promise<void>,
): AttemptLogOutbox & { logged: AttemptLogPayload[] } {
  const logged: AttemptLogPayload[] = [];
  return {
    logged,
    async log(payload) {
      logged.push(payload);
      if (onLog) await onLog();
    },
    async flush() {},
    pending: () => 0,
  };
}

describe('persistGradedAttempt (FR-012, FR-019)', () => {
  test('writes the attempt row so it survives as the source of truth', async () => {
    const attempts = createAttemptRepository(createInMemoryRowStore());
    const outbox = spyOutbox();
    await persistGradedAttempt(attempt(), MELODY, LEVEL, {
      attempts,
      melodies: createMelodyRepository(createInMemoryRowStore()),
      outbox,
      appVersion: '0.1.0',
      deviceId: 'dev_test',
    });
    expect(await attempts.get('a1')).toMatchObject({ id: 'a1', verdict: 'correct' });
  });

  test('enqueues exactly one anonymized payload carrying no PII or audio', async () => {
    const outbox = spyOutbox();
    await persistGradedAttempt(attempt(), MELODY, LEVEL, {
      attempts: createAttemptRepository(createInMemoryRowStore()),
      melodies: createMelodyRepository(createInMemoryRowStore()),
      outbox,
      appVersion: '0.1.0',
      deviceId: 'dev_test',
    });
    expect(outbox.logged).toHaveLength(1);
    expect(outbox.logged[0]).toMatchObject({
      device_id: 'dev_test',
      difficulty_id: LEVEL.id,
      difficulty_rank: LEVEL.rank,
      verdict: 'correct',
    });
    // Nothing note-level or time-level may leave the device (SC-008).
    expect(Object.keys(outbox.logged[0])).not.toContain('detectedNotes');
    expect(Object.keys(outbox.logged[0])).not.toContain('createdAt');
  });

  test('does not write the session summary — useSession owns Session mutations', async () => {
    const store = createInMemoryRowStore();
    await persistGradedAttempt(attempt(), MELODY, LEVEL, {
      attempts: createAttemptRepository(store),
      melodies: createMelodyRepository(store),
      outbox: spyOutbox(),
      appVersion: '0.1.0',
      deviceId: 'dev_test',
    });
    expect(await store.all('sessions')).toHaveLength(0);
  });

  test('stores the melody so the attempt s melodyId resolves (data-model integrity)', async () => {
    const store = createInMemoryRowStore();
    const melodies = createMelodyRepository(store);
    await persistGradedAttempt(attempt(), MELODY, LEVEL, {
      attempts: createAttemptRepository(store),
      melodies,
      outbox: spyOutbox(),
      appVersion: '0.1.0',
      deviceId: 'dev_test',
    });
    expect(await melodies.get(MELODY.id)).toMatchObject({ id: MELODY.id, difficultyId: LEVEL.id });
  });

  test('a retry on the same melody upserts rather than duplicating it', async () => {
    const store = createInMemoryRowStore();
    const melodies = createMelodyRepository(store);
    const deps = {
      attempts: createAttemptRepository(store),
      melodies,
      outbox: spyOutbox(),
      appVersion: '0.1.0',
      deviceId: 'dev_test',
    };
    await persistGradedAttempt(attempt({ id: 'a1' }), MELODY, LEVEL, deps);
    await persistGradedAttempt(attempt({ id: 'a2' }), MELODY, LEVEL, deps);
    expect(await melodies.all()).toHaveLength(1);
  });

  test('resolves before telemetry settles, so logging never delays feedback', async () => {
    let released!: () => void;
    const blocked = new Promise<void>((r) => {
      released = r;
    });
    const outbox = spyOutbox(() => blocked);
    // Would hang if persistGradedAttempt awaited the outbox.
    await persistGradedAttempt(attempt(), MELODY, LEVEL, {
      attempts: createAttemptRepository(createInMemoryRowStore()),
      melodies: createMelodyRepository(createInMemoryRowStore()),
      outbox,
      appVersion: '0.1.0',
      deviceId: 'dev_test',
    });
    expect(outbox.logged).toHaveLength(1);
    released();
  });
});
