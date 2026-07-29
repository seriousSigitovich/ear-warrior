// T042 (US3, FR-013): progress aggregation over stored attempts/sessions/melodies.
// Pure function, so the whole US3 reporting surface is unit-testable under the ts-jest runner
// without a store, a hook, or a device. Covers: accuracy trend by session, practice volume, weak
// areas by melody length and interval size, difficulty reached, and the empty-history case.
import { Attempt, DetectedNote, Melody, Note, NoteResult, Session, Verdict } from '../../../src/models';
import { computeProgress } from '../../../src/services/storage/progress';

// ---- fixtures -------------------------------------------------------------

function note(index: number, midi: number): Note {
  return { index, midi, noteName: `m${midi}`, frequencyHz: 440, centsOffset: 0, durationBeats: 1 };
}

/** A target melody at a given rank (id "L{rank}") from an explicit set of midis. */
function melody(id: string, rank: number, midis: number[]): Melody {
  return {
    id,
    notes: midis.map((m, i) => note(i, m)),
    difficultyId: `L${rank}`,
    scale: 'C_major',
    createdAt: new Date(0).toISOString(),
  };
}

function session(id: string, startedAt: string, endedAt: string | null): Session {
  return {
    id,
    startedAt,
    endedAt,
    difficultyMode: 'adaptive',
    currentDifficultyId: 'L1',
    attemptCount: 0,
    accuracyPct: 0,
  };
}

interface AttemptOpts {
  timedOut?: boolean;
  lowConfidence?: boolean;
  detected?: DetectedNote[];
}

function attempt(
  id: string,
  sessionId: string,
  melodyId: string,
  verdict: Verdict,
  opts: AttemptOpts = {},
): Attempt {
  return {
    id,
    sessionId,
    melodyId,
    detectedNotes: opts.detected ?? [],
    noteResults: [] as NoteResult[],
    verdict,
    confidence: 1,
    lowConfidence: opts.lowConfidence ?? false,
    timedOut: opts.timedOut ?? false,
    createdAt: new Date(0).toISOString(),
  };
}

describe('computeProgress (US3 aggregation, FR-013)', () => {
  test('empty history yields zeros and no trend/weak areas', () => {
    const p = computeProgress({ sessions: [], attempts: [], melodies: [] });
    expect(p.accuracyTrend).toEqual([]);
    expect(p.weakAreas).toEqual([]);
    expect(p.practiceVolume).toEqual({ totalAttempts: 0, totalSessions: 0, totalMinutes: 0 });
    expect(p.difficultyReached).toBe(0);
  });

  test('accuracy trend has one point per session with graded attempts, ordered by start', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', '2026-07-01T10:05:00.000Z');
    const s2 = session('s2', '2026-07-02T10:00:00.000Z', '2026-07-02T10:10:00.000Z');
    const mel = melody('mel', 1, [60, 62]);
    const attempts = [
      // s1: 1 correct of 2 graded → 50%
      attempt('a1', 's1', 'mel', 'correct'),
      attempt('a2', 's1', 'mel', 'incorrect'),
      // s2: 2 correct of 2 graded → 100%
      attempt('a3', 's2', 'mel', 'correct'),
      attempt('a4', 's2', 'mel', 'correct'),
    ];
    // Pass sessions out of order to prove the aggregator sorts by startedAt.
    const p = computeProgress({ sessions: [s2, s1], attempts, melodies: [mel] });
    expect(p.accuracyTrend).toEqual([
      { date: '2026-07-01T10:00:00.000Z', accuracyPct: 50 },
      { date: '2026-07-02T10:00:00.000Z', accuracyPct: 100 },
    ]);
  });

  test('ungraded captures (timed-out / low-confidence) are excluded from accuracy but counted as volume', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', null);
    const mel = melody('mel', 1, [60, 62]);
    const attempts = [
      attempt('a1', 's1', 'mel', 'correct'),
      attempt('a2', 's1', 'mel', 'incorrect', { timedOut: true }),
      attempt('a3', 's1', 'mel', 'incorrect', { lowConfidence: true }),
    ];
    const p = computeProgress({ sessions: [s1], attempts, melodies: [mel] });
    // Only a1 is graded → 100% accuracy for the session…
    expect(p.accuracyTrend).toEqual([{ date: '2026-07-01T10:00:00.000Z', accuracyPct: 100 }]);
    // …but all three attempts count toward practice volume.
    expect(p.practiceVolume.totalAttempts).toBe(3);
  });

  test('a session with only ungraded attempts contributes no trend point', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', null);
    const mel = melody('mel', 1, [60, 62]);
    const attempts = [attempt('a1', 's1', 'mel', 'incorrect', { timedOut: true })];
    const p = computeProgress({ sessions: [s1], attempts, melodies: [mel] });
    expect(p.accuracyTrend).toEqual([]);
    expect(p.practiceVolume.totalAttempts).toBe(1);
  });

  test('practice volume sums attempts, sessions, and elapsed minutes of ended sessions', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', '2026-07-01T10:05:00.000Z'); // 5 min
    const s2 = session('s2', '2026-07-02T10:00:00.000Z', '2026-07-02T10:15:00.000Z'); // 15 min
    const s3 = session('s3', '2026-07-03T10:00:00.000Z', null); // active → 0 min
    const mel = melody('mel', 1, [60, 62]);
    const attempts = [
      attempt('a1', 's1', 'mel', 'correct'),
      attempt('a2', 's2', 'mel', 'correct'),
    ];
    const p = computeProgress({ sessions: [s1, s2, s3], attempts, melodies: [mel] });
    expect(p.practiceVolume).toEqual({ totalAttempts: 2, totalSessions: 3, totalMinutes: 20 });
  });

  test('difficultyReached is the highest rank ever attempted', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', null);
    const melA = melody('a', 2, [60, 62, 64]);
    const melB = melody('b', 5, [60, 62, 64, 65, 67, 69]);
    const attempts = [
      attempt('a1', 's1', 'a', 'correct'),
      attempt('a2', 's1', 'b', 'incorrect'),
    ];
    const p = computeProgress({ sessions: [s1], attempts, melodies: [melA, melB] });
    expect(p.difficultyReached).toBe(5);
  });

  test('weak areas: miss rate grouped by melody length and largest-interval bucket, worst first', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', null);
    // Two-note stepwise melody (len 2, interval bucket "step": max leap = 2 semitones).
    const stepMel = melody('step', 1, [60, 62]);
    // Three-note melody with a big leap (len 3, interval bucket "leap": 60→67 = 7 semitones).
    const leapMel = melody('leap', 2, [60, 67, 65]);
    const attempts = [
      // step melody: 2 attempts, both correct → missRate 0
      attempt('a1', 's1', 'step', 'correct'),
      attempt('a2', 's1', 'step', 'correct'),
      // leap melody: 2 attempts, both incorrect → missRate 1
      attempt('a3', 's1', 'leap', 'incorrect'),
      attempt('a4', 's1', 'leap', 'incorrect'),
    ];
    const p = computeProgress({ sessions: [s1], attempts, melodies: [stepMel, leapMel] });
    const byDescriptor = Object.fromEntries(p.weakAreas.map((w) => [w.descriptor, w.missRate]));
    expect(byDescriptor['length:2']).toBe(0);
    expect(byDescriptor['length:3']).toBe(1);
    expect(byDescriptor['interval:step']).toBe(0);
    expect(byDescriptor['interval:leap']).toBe(1);
    // Sorted worst-first: the first entry must be a 100%-miss group.
    expect(p.weakAreas[0].missRate).toBe(1);
  });

  test('weak areas ignore ungraded attempts (no phantom miss from room noise)', () => {
    const s1 = session('s1', '2026-07-01T10:00:00.000Z', null);
    const mel = melody('mel', 1, [60, 62]);
    const attempts = [
      attempt('a1', 's1', 'mel', 'correct'),
      // a low-confidence capture must not count as a miss against this melody's length/interval
      attempt('a2', 's1', 'mel', 'incorrect', { lowConfidence: true }),
    ];
    const p = computeProgress({ sessions: [s1], attempts, melodies: [mel] });
    const byDescriptor = Object.fromEntries(p.weakAreas.map((w) => [w.descriptor, w.missRate]));
    expect(byDescriptor['length:2']).toBe(0);
  });
});
