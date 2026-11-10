import { Attempt, NoteResult } from '../../../src/models';
import { mistakeLine, mistakesOf, praise, recentReviews, scoreOf } from '../../../src/lib/review';

const matched = (i: number, midi: number): NoteResult => ({
  targetIndex: i,
  status: 'matched',
  expectedMidi: midi,
  detectedMidi: midi,
  octaveMismatch: false,
});
const wrong = (i: number, expected: number, played: number, octave = false): NoteResult => ({
  targetIndex: i,
  status: 'wrong',
  expectedMidi: expected,
  detectedMidi: played,
  octaveMismatch: octave,
});
const missed = (i: number, expected: number): NoteResult => ({
  targetIndex: i,
  status: 'missed',
  expectedMidi: expected,
  detectedMidi: null,
  octaveMismatch: false,
});
const extra = (played: number): NoteResult => ({
  targetIndex: null,
  status: 'extra',
  expectedMidi: null,
  detectedMidi: played,
  octaveMismatch: false,
});

function attempt(id: string, createdAt: string, noteResults: NoteResult[]): Attempt {
  return {
    id,
    sessionId: 's',
    melodyId: `m-${id}`,
    detectedNotes: [],
    noteResults,
    verdict: noteResults.every((r) => r.status === 'matched') ? 'correct' : 'incorrect',
    confidence: 1,
    lowConfidence: false,
    timedOut: false,
    inputMode: 'fretboard',
    createdAt,
  };
}

describe('answer review', () => {
  const results = [
    matched(0, 60),
    wrong(1, 62, 64),
    missed(2, 64),
    wrong(3, 67, 55, true),
    extra(72),
  ];

  test('the score counts matched notes against the notes of the tune, extras aside', () => {
    expect(scoreOf(results)).toEqual({ matched: 1, notes: 4, pct: 25 });
    expect(scoreOf([matched(0, 60), matched(1, 62)])).toEqual({ matched: 2, notes: 2, pct: 100 });
    expect(scoreOf([])).toEqual({ matched: 0, notes: 0, pct: 0 });
  });

  test('each unmatched note says where it was, what was played and what it should have been', () => {
    expect(mistakesOf(results)).toEqual([
      { kind: 'wrong', position: 2, played: 'E4', expected: 'D4', octave: false },
      { kind: 'missed', position: 3, played: null, expected: 'E4', octave: false },
      { kind: 'wrong', position: 4, played: 'G3', expected: 'G4', octave: true },
      { kind: 'extra', position: null, played: 'C5', expected: null, octave: false },
    ]);
    expect(mistakesOf([matched(0, 60)])).toEqual([]);
  });

  test('a mistake reads as a sentence', () => {
    expect(mistakesOf(results).map(mistakeLine)).toEqual([
      'Note 2: you played E4, it was D4',
      'Note 3: not played, it was E4',
      'Note 4: you played G3, it was G4 (right note, wrong octave)',
      'Extra note: C5',
    ]);
  });

  test('praise follows the score', () => {
    expect([100, 80, 79, 50, 49, 0].map(praise)).toEqual([
      'Perfect',
      'Great job',
      'Good ear',
      'Good ear',
      'You played it through',
      'You played it through',
    ]);
  });

  test('recent reviews are the latest tunes first, named from their melodies', () => {
    const attempts = [
      attempt('a', '2026-11-08T10:00:00.000Z', [matched(0, 60)]),
      attempt('c', '2026-11-10T10:00:00.000Z', [wrong(0, 60, 62)]),
      attempt('b', '2026-11-09T10:00:00.000Z', [matched(0, 60)]),
    ];
    const reviews = recentReviews(attempts, [{ id: 'm-c', title: 'Ode to Joy' }], 2);
    expect(reviews.map((r) => [r.attemptId, r.title, r.score.pct, r.mistakes.length])).toEqual([
      ['c', 'Ode to Joy', 0, 1],
      ['b', 'Melody', 100, 0],
    ]);
  });
});
