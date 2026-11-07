import { AttemptGrade, Melody, NoteResult } from '../../../src/models';
import { hzFromMidi, noteName } from '../../../src/lib/pitchNote';
import {
  combinePhraseGrades,
  phraseCount,
  phraseLengths,
  phraseMelody,
  phraseRange,
  phraseStartBeats,
  tuneSummary,
} from '../../../src/lib/phrases';

function melody(beats: number[], phrases?: number[]): Melody {
  return {
    id: 'tune-1',
    difficultyId: 'L1',
    scale: 'C_major',
    tempoBpm: 120,
    createdAt: '',
    phrases,
    notes: beats.map((durationBeats, index) => ({
      index,
      midi: 60 + index,
      noteName: noteName(60 + index),
      frequencyHz: hzFromMidi(60 + index),
      centsOffset: 0,
      durationBeats,
    })),
  };
}

function grade(statuses: NoteResult['status'][], confidence = 1): AttemptGrade {
  let t = 0;
  const noteResults = statuses.map((status) => ({
    targetIndex: status === 'extra' ? null : t++,
    status,
    expectedMidi: status === 'extra' ? null : 60,
    detectedMidi: status === 'missed' ? null : 60,
    octaveMismatch: false,
  }));
  const correct = statuses.every((s) => s === 'matched');
  return {
    noteResults,
    verdict: correct ? 'correct' : 'incorrect',
    confidence,
    lowConfidence: false,
    timedOut: false,
  };
}

describe('phrases', () => {
  const m = melody([1, 1, 2, 1, 1, 1, 2], [3, 4]);

  test('splits by the marked lengths; unmarked or inconsistent marks mean one phrase', () => {
    expect(phraseLengths(m)).toEqual([3, 4]);
    expect(phraseCount(m)).toBe(2);
    expect(phraseLengths(melody([1, 1, 1]))).toEqual([3]);
    expect(phraseLengths(melody([1, 1, 1], [2, 2]))).toEqual([3]);
  });

  test('gives each phrase its note range', () => {
    expect(phraseRange(m, 0)).toEqual({ start: 0, end: 3 });
    expect(phraseRange(m, 1)).toEqual({ start: 3, end: 7 });
    expect(() => phraseRange(m, 2)).toThrow();
  });

  test('a phrase is a melody of its own, numbered from 0, same tune and tempo', () => {
    const p = phraseMelody(m, 1);
    expect(p.notes.map((n) => [n.index, n.midi])).toEqual([
      [0, 63],
      [1, 64],
      [2, 65],
      [3, 66],
    ]);
    expect(p.id).toBe('tune-1');
    expect(p.tempoBpm).toBe(120);
    expect(p.phrases).toEqual([4]);
  });

  test('knows where each phrase starts in the tune, in beats', () => {
    expect(phraseStartBeats(m, 0)).toBe(0);
    expect(phraseStartBeats(m, 1)).toBe(4);
  });

  test('rolls phrase grades up into one grade for the tune', () => {
    const tune = combinePhraseGrades(m, [
      grade(['matched', 'matched', 'matched'], 0.9),
      grade(['matched', 'wrong', 'matched', 'extra', 'matched'], 0.7),
    ]);
    expect(tune.verdict).toBe('incorrect');
    expect(tune.confidence).toBe(0.7);
    expect(tune.noteResults.map((r) => r.targetIndex)).toEqual([0, 1, 2, 3, 4, 5, null, 6]);
    expect(
      combinePhraseGrades(m, [
        grade(['matched', 'matched', 'matched']),
        grade(['matched', 'matched', 'matched', 'matched']),
      ]).verdict,
    ).toBe('correct');
    expect(() => combinePhraseGrades(m, [grade(['matched'])])).toThrow();
  });

  test('sums the tune up for the closing card', () => {
    expect(
      tuneSummary([
        grade(['matched', 'matched', 'matched']),
        grade(['matched', 'wrong', 'missed', 'extra']),
      ]),
    ).toEqual({ phrasesRight: 1, phrases: 2, notesMatched: 4, notes: 6 });
  });
});
