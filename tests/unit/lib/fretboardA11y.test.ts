import { AttemptGrade, NoteResult } from '../../../src/models';
import { makeTap } from '../../../src/lib/fretboard';
import {
  fretCellLabel,
  placementAnnouncement,
  resultBoardLabel,
  verdictAnnouncement,
} from '../../../src/lib/fretboardA11y';

function result(status: NoteResult['status'], targetIndex: number | null): NoteResult {
  return { targetIndex, status, expectedMidi: null, detectedMidi: null, octaveMismatch: false };
}

function grade(verdict: AttemptGrade['verdict'], results: NoteResult[]): AttemptGrade {
  return { noteResults: results, verdict, confidence: 1, lowConfidence: false, timedOut: false };
}

describe('fretCellLabel', () => {
  it('names the string and fret, open for fret 0', () => {
    expect(fretCellLabel({ string: 0, fret: 0 })).toBe('E string, open');
    expect(fretCellLabel({ string: 4, fret: 3 })).toBe('B string, fret 3');
  });

  it('adds the note number when a placed note sits on the cell', () => {
    expect(fretCellLabel({ string: 5, fret: 0 }, 2)).toBe('e string, open, note 2');
  });
});

describe('placementAnnouncement', () => {
  it('speaks the last pitch and the progress', () => {
    const taps = [makeTap({ string: 4, fret: 1 }, 0), makeTap({ string: 4, fret: 3 }, 100)];
    expect(placementAnnouncement(taps, 3)).toBe('D4, 2 of 3 placed');
  });

  it('handles an emptied answer', () => {
    expect(placementAnnouncement([], 3)).toBe('0 of 3 placed');
  });
});

describe('verdictAnnouncement', () => {
  it('matches the verdict card and ignores extras in the total', () => {
    const g = grade('incorrect', [
      result('matched', 0),
      result('missed', 1),
      result('extra', null),
    ]);
    expect(verdictAnnouncement(g)).toBe('Not quite, 1 of 2 notes matched');
    expect(verdictAnnouncement(grade('correct', [result('matched', 0)]))).toBe(
      'Correct, 1 of 1 notes matched',
    );
  });
});

describe('resultBoardLabel', () => {
  it('lists every tap with its place and grade', () => {
    const taps = [makeTap({ string: 4, fret: 1 }, 0), makeTap({ string: 1, fret: 0 }, 100)];
    expect(resultBoardLabel(taps, ['matched', 'wrong'])).toBe(
      'Your answer. 1: C4 on B string, fret 1, matched; 2: A2 on A string, open, wrong',
    );
  });

  it('says when nothing was placed', () => {
    expect(resultBoardLabel([], [])).toBe('Your answer: no notes placed');
  });
});
