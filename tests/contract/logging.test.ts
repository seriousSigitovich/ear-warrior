import { AttemptGrade, DifficultyLevel, Melody } from '../../src/models';
import {
  AttemptLogClient,
  AttemptLogPayload,
  buildAttemptLogPayload,
  createAttemptLogOutbox,
} from '../../src/services/logging/attemptLog';

const LEVEL: DifficultyLevel = {
  id: 'L2',
  rank: 2,
  noteCount: 2,
  scale: 'C_major',
  rangeLowMidi: 60,
  rangeHighMidi: 72,
  tempoBpm: 90,
};

const MELODY = { notes: [{}, {}] } as unknown as Melody; // only notes.length is used

const GRADE: AttemptGrade = {
  noteResults: [
    {
      targetIndex: 0,
      status: 'matched',
      expectedMidi: 60,
      detectedMidi: 60,
      octaveMismatch: false,
    },
    { targetIndex: 1, status: 'wrong', expectedMidi: 62, detectedMidi: 74, octaveMismatch: true },
  ],
  verdict: 'incorrect',
  confidence: 0.8,
  lowConfidence: false,
  timedOut: false,
};

const ALLOWED_KEYS = [
  'app_version',
  'confidence',
  'device_id',
  'difficulty_id',
  'difficulty_rank',
  'extra_count',
  'matched_count',
  'missed_count',
  'note_count',
  'octave_mismatch',
  'verdict',
  'wrong_count',
];

/** Supabase client mock whose success can be toggled. */
function fakeClient() {
  const inserted: AttemptLogPayload[] = [];
  let ok = true;
  const client: AttemptLogClient = {
    async insert(row) {
      if (!ok) {
        throw new Error('network down');
      }
      inserted.push(row);
    },
  };
  return { client, inserted, setOnline: (v: boolean) => (ok = v) };
}

describe('anonymous attempt logging (contracts/supabase-attempt-log.md)', () => {
  test('payload carries only anonymized aggregate fields (no PII)', () => {
    const p = buildAttemptLogPayload(GRADE, MELODY, LEVEL, 'dev_abc', '0.1.0');
    expect(Object.keys(p).sort()).toEqual(ALLOWED_KEYS);
    expect(p).toMatchObject({
      note_count: 2,
      verdict: 'incorrect',
      matched_count: 1,
      wrong_count: 1,
      missed_count: 0,
      extra_count: 0,
      octave_mismatch: true,
      difficulty_id: 'L2',
      difficulty_rank: 2,
    });
  });

  test('best-effort insert succeeds → nothing queued', async () => {
    const f = fakeClient();
    const outbox = createAttemptLogOutbox(f.client);
    await outbox.log(buildAttemptLogPayload(GRADE, MELODY, LEVEL, 'dev_abc', '0.1.0'));
    expect(outbox.pending()).toBe(0);
    expect(f.inserted).toHaveLength(1);
  });

  test('failure queues locally and never throws to the caller', async () => {
    const f = fakeClient();
    f.setOnline(false);
    const outbox = createAttemptLogOutbox(f.client);
    await expect(
      outbox.log(buildAttemptLogPayload(GRADE, MELODY, LEVEL, 'dev_abc', '0.1.0')),
    ).resolves.toBeUndefined();
    expect(outbox.pending()).toBe(1);
  });

  test('flush drains the queue once reconnected', async () => {
    const f = fakeClient();
    f.setOnline(false);
    const outbox = createAttemptLogOutbox(f.client);
    await outbox.log(buildAttemptLogPayload(GRADE, MELODY, LEVEL, 'dev_abc', '0.1.0'));
    expect(outbox.pending()).toBe(1);
    f.setOnline(true);
    await outbox.flush();
    expect(outbox.pending()).toBe(0);
    expect(f.inserted).toHaveLength(1);
  });
});
