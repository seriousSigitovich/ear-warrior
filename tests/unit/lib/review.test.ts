import { NoteResult } from '../../../src/models';
import {
  missSummary,
  mistakeChip,
  mistakesOf,
  noteStrip,
  praise,
  scoreOf,
} from '../../../src/lib/review';

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

  test('the strip is the tune note by note, in tune order, extras aside', () => {
    expect(noteStrip(results)).toEqual(['matched', 'wrong', 'missed', 'wrong']);
    expect(noteStrip([missed(1, 62), matched(0, 60)])).toEqual(['matched', 'missed']);
  });

  test('a wrong note is a short chip: where, played → right note', () => {
    const [wrongNote, , octave] = mistakesOf(results);
    expect(mistakeChip(wrongNote)).toBe('2 · E4 → D4');
    expect(mistakeChip(octave)).toBe('4 · G3 → G4');
  });

  test('the misses are summed up in one line, only the kinds that happened', () => {
    expect(missSummary(mistakesOf(results))).toBe('2 wrong · 1 not played · 1 extra');
    expect(missSummary(mistakesOf([missed(0, 60), missed(1, 62)]))).toBe('2 not played');
    expect(missSummary([])).toBe('Every note right');
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
});
