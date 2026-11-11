import { Attempt, Melody, NoteResult } from '../../../src/models';
import {
  MIN_TRIES,
  NoteEvent,
  intervalKind,
  intervalLabel,
  intervalRise,
  intervalStats,
  noteEvents,
  scoredAttempts,
  weakSpotTitle,
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

  test('each kind is named in everyday words, not music theory', () => {
    expect(intervalLabel('repeat')).toBe('The same note again');
    expect(intervalLabel('step:up')).toBe('Small steps up');
    expect(intervalLabel('third:down')).toBe('Skips down');
    expect(intervalLabel('fourthFifth:up')).toBe('Jumps up');
    expect(intervalLabel('wide:down')).toBe('Big jumps down');
  });

  test('the rise of a kind grows with its size and follows its direction', () => {
    expect(
      (['repeat', 'step:up', 'third:up', 'fourthFifth:up', 'wide:up'] as const).map(intervalRise),
    ).toEqual([0, 1, 2, 3, 4]);
    expect((['step:down', 'wide:down'] as const).map(intervalRise)).toEqual([-1, -4]);
  });

  test('the weak spot is said as a sentence', () => {
    expect(weakSpotTitle('wide:up')).toBe('Big jumps up trip you');
    expect(weakSpotTitle('repeat')).toBe('The same note again trips you');
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
      { kind: 'wide:up', label: 'Big jumps up', tries: 6, hits: 2, pct: 33 },
      { kind: 'step:up', label: 'Small steps up', tries: 6, hits: 6, pct: 100 },
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
      { kind: 'step:up', label: 'Small steps up', tries: MIN_TRIES, hits: MIN_TRIES, pct: 100 },
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
    const weak = { kind: 'third:down', label: 'Skips down', tries: 9, hits: 3, pct: 33 } as const;
    const fine = { kind: 'step:up', label: 'Small steps up', tries: 9, hits: 8, pct: 89 } as const;
    expect(weakestInterval([weak, fine])).toEqual(weak);
    expect(weakestInterval([fine])).toBeNull();
    expect(weakestInterval([])).toBeNull();
  });
});
