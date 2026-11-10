import { Attempt, Melody, NoteResult } from '../../../src/models';
import {
  MIN_TRIES,
  NoteEvent,
  intervalKind,
  intervalLabel,
  intervalStats,
  missPatterns,
  noteAccuracy,
  noteEvents,
  scoredAttempts,
  weakestInterval,
} from '../../../src/lib/insights';

/** Results for a tune `expected`, answered with `played` (null = not played). */
function results(expected: number[], played: (number | null)[]): NoteResult[] {
  return expected.map((e, i) => {
    const p = played[i];
    return {
      targetIndex: i,
      status: p === null ? 'missed' : p === e ? 'matched' : 'wrong',
      expectedMidi: e,
      detectedMidi: p,
      octaveMismatch: p !== null && p !== e && (p - e) % 12 === 0,
    };
  });
}

let seq = 0;
function attempt(noteResults: NoteResult[], over: Partial<Attempt> = {}): Attempt {
  seq += 1;
  return {
    id: `a${seq}`,
    sessionId: 's',
    melodyId: `m${seq}`,
    detectedNotes: [],
    noteResults,
    verdict: noteResults.every((r) => r.status === 'matched') ? 'correct' : 'incorrect',
    confidence: 1,
    lowConfidence: false,
    timedOut: false,
    inputMode: 'fretboard',
    createdAt: new Date(2026, 10, 10, 12).toISOString(),
    ...over,
  };
}

const phrased = (id: string, phrases: number[]): Pick<Melody, 'id' | 'phrases'> => ({
  id,
  phrases,
});
const at = (day: number) => new Date(2026, 10, day, 12).toISOString();
const now = new Date(2026, 10, 10, 18);

describe('interval kinds', () => {
  test('a move is classed by size and direction', () => {
    expect([0, 1, 2, 3, 4, 5, 7, 8, 12, 19].map(intervalKind)).toEqual([
      'repeat',
      'step:up',
      'step:up',
      'third:up',
      'third:up',
      'fourthFifth:up',
      'fourthFifth:up',
      'wide:up',
      'wide:up',
      'wide:up',
    ]);
    expect([-1, -4, -6, -9].map(intervalKind)).toEqual([
      'step:down',
      'third:down',
      'fourthFifth:down',
      'wide:down',
    ]);
  });

  test('each kind has a plain name', () => {
    expect(intervalLabel('repeat')).toBe('Repeated notes');
    expect(intervalLabel('step:up')).toBe('Steps up');
    expect(intervalLabel('third:down')).toBe('Thirds down');
    expect(intervalLabel('fourthFifth:up')).toBe('Fourths & fifths up');
    expect(intervalLabel('wide:down')).toBe('Wide leaps down');
  });
});

describe('note events', () => {
  test('each note carries the expected note before it, except at the start of a phrase', () => {
    const a = attempt(results([60, 62, 64, 65], [60, 61, null, 65]));
    const events = noteEvents([a], [phrased(a.melodyId, [2, 2])]);
    expect(events).toEqual<NoteEvent[]>([
      { expected: 60, played: 60, hit: true, prev: null, octave: false },
      { expected: 62, played: 61, hit: false, prev: 60, octave: false },
      { expected: 64, played: null, hit: false, prev: null, octave: false },
      { expected: 65, played: 65, hit: true, prev: 64, octave: false },
    ]);
  });

  test('a tune with no phrase marks is one phrase; extra notes are left out', () => {
    const extra: NoteResult = {
      targetIndex: null,
      status: 'extra',
      expectedMidi: null,
      detectedMidi: 70,
      octaveMismatch: false,
    };
    const a = attempt([...results([60, 62], [60, 62]), extra]);
    expect(noteEvents([a], []).map((e) => e.prev)).toEqual([null, 60]);
  });

  test('microphone-era and timed-out attempts are not scored', () => {
    const ok = attempt(results([60], [60]));
    const mic = attempt(results([60], [61]), { inputMode: 'mic' });
    const old = attempt(results([60], [61]), { inputMode: undefined });
    const timedOut = attempt(results([60], [null]), { timedOut: true });
    expect(scoredAttempts([ok, mic, old, timedOut])).toEqual([ok]);
  });
});

describe('note accuracy', () => {
  test('counts notes, not tunes: one wrong note in four is 75%', () => {
    const acc = noteAccuracy([attempt(results([60, 62, 64, 65], [60, 62, 64, 66]))], now);
    expect(acc.week).toEqual({ matched: 3, notes: 4, pct: 75 });
    expect(acc.all).toEqual({ matched: 3, notes: 4, pct: 75 });
    expect(acc.before).toBeNull();
    expect(acc.delta).toBeNull();
  });

  test('compares the last 7 days with the 7 before', () => {
    const acc = noteAccuracy(
      [
        attempt(results([60, 62], [60, 62]), { createdAt: at(10) }),
        attempt(results([60, 62], [60, 61]), { createdAt: at(4) }), // 6 days ago: this week
        attempt(results([60, 62], [61, 61]), { createdAt: at(3) }), // 7 days ago: the week before
        attempt(results([60, 62], [60, 61]), { createdAt: at(1) }),
      ],
      now,
    );
    expect(acc.week).toMatchObject({ matched: 3, notes: 4, pct: 75 });
    expect(acc.before).toMatchObject({ matched: 1, notes: 4, pct: 25 });
    expect(acc.delta).toBe(50);
  });

  test('gives one point per practice day, oldest first', () => {
    const acc = noteAccuracy(
      [
        attempt(results([60, 62], [60, 62]), { createdAt: at(10) }),
        attempt(results([60, 62], [61, 61]), { createdAt: at(8) }),
        attempt(results([60, 62], [60, 61]), { createdAt: at(8) }),
      ],
      now,
    );
    expect(acc.byDay).toEqual([
      { day: '2026-11-08', pct: 25, notes: 4 },
      { day: '2026-11-10', pct: 100, notes: 2 },
    ]);
  });

  test('nothing lately: only the all-time figure', () => {
    const acc = noteAccuracy([attempt(results([60], [60]), { createdAt: at(1) })], now);
    expect(acc.week).toBeNull();
    expect(acc.all).toMatchObject({ pct: 100 });
    expect(noteAccuracy([], now)).toEqual({
      week: null,
      before: null,
      all: null,
      delta: null,
      byDay: [],
    });
  });
});

describe('interval map', () => {
  const ev = (prev: number | null, expected: number, played: number | null): NoteEvent => ({
    expected,
    played,
    hit: played === expected,
    prev,
    octave: false,
  });
  const many = (n: number, e: NoteEvent) => Array.from({ length: n }, () => e);

  test('accuracy per kind of move, weakest first', () => {
    const { stats, thin } = intervalStats([
      ...many(6, ev(60, 62, 62)), // steps up: all right
      ...many(4, ev(60, 69, 67)), // wide up: wrong
      ...many(2, ev(60, 69, 69)), // wide up: right
    ]);
    expect(stats).toEqual([
      { kind: 'wide:up', label: 'Wide leaps up', tries: 6, hits: 2, pct: 33 },
      { kind: 'step:up', label: 'Steps up', tries: 6, hits: 6, pct: 100 },
    ]);
    expect(thin).toBe(0);
  });

  test('unplayed notes and phrase starts are not tries', () => {
    const { stats } = intervalStats([
      ...many(MIN_TRIES, ev(60, 62, 62)),
      ...many(10, ev(60, 62, null)),
      ...many(10, ev(null, 62, 61)),
    ]);
    expect(stats).toEqual([
      { kind: 'step:up', label: 'Steps up', tries: MIN_TRIES, hits: MIN_TRIES, pct: 100 },
    ]);
  });

  test('a kind with too few tries is held back and counted as thin', () => {
    const { stats, thin } = intervalStats([
      ...many(MIN_TRIES - 1, ev(60, 64, 63)),
      ...many(MIN_TRIES, ev(60, 60, 60)),
    ]);
    expect(stats.map((s) => s.kind)).toEqual(['repeat']);
    expect(thin).toBe(1);
  });

  test('the weakest kind is the first one below "nothing to fix"', () => {
    const weak = { kind: 'third:down', label: 'Thirds down', tries: 9, hits: 3, pct: 33 } as const;
    const fine = { kind: 'step:up', label: 'Steps up', tries: 9, hits: 8, pct: 89 } as const;
    expect(weakestInterval([weak, fine])).toEqual(weak);
    expect(weakestInterval([fine])).toBeNull();
    expect(weakestInterval([])).toBeNull();
  });
});

describe('how the misses go', () => {
  const wrong = (
    prev: number | null,
    expected: number,
    played: number,
    octave = false,
  ): NoteEvent => ({
    expected,
    played,
    hit: false,
    prev,
    octave,
  });
  const many = (n: number, e: NoteEvent) => Array.from({ length: n }, () => e);

  test('too few wrong notes: nothing to say', () => {
    expect(missPatterns(many(7, wrong(60, 64, 65)))).toEqual([]);
    expect(missPatterns([])).toEqual([]);
  });

  test('a lean upwards, close misses and the right direction are each named', () => {
    // Expected a third up (60→64), played a fourth up (65): above, within a tone, right direction.
    expect(missPatterns(many(10, wrong(60, 64, 65)))).toEqual([
      'You tend to land too high: 100% of your wrong notes are above the right one.',
      'Your misses are close: 100% are within a tone of the right note.',
      'You hear which way the melody moves: 100% of your wrong notes go the right way and stop on the wrong note.',
    ]);
  });

  test('a lean downwards, the wrong direction and octave slips', () => {
    const events = [
      ...many(6, wrong(60, 64, 57)), // below, far, moved down instead of up
      ...many(4, wrong(60, 64, 52, true)), // an octave below
    ];
    expect(missPatterns(events)).toEqual([
      'You tend to land too low: 100% of your wrong notes are below the right one.',
      '40% of your wrong notes are the right note in the wrong octave.',
      'Listen for the direction first: 100% of your wrong notes move the wrong way.',
    ]);
  });

  test('no pattern, no sentence', () => {
    const events = [
      ...many(5, wrong(null, 64, 70)), // above, far, no note before
      ...many(5, wrong(null, 64, 58)), // below, far
    ];
    expect(missPatterns(events)).toEqual([]);
  });
});
