import { KeyValueStore } from '../../../src/lib/deviceId';
import {
  doneCoach,
  isOnboarded,
  markOnboarded,
  missCoach,
  playCoach,
  rightPrefix,
  stringName,
} from '../../../src/lib/onboarding';
import { AttemptGrade, NoteResult } from '../../../src/models';

function fakeStore(): KeyValueStore {
  const data: Record<string, string> = {};
  return {
    async getItem(k) {
      return k in data ? data[k] : null;
    },
    async setItem(k, v) {
      data[k] = v;
    },
  };
}

function grade(results: NoteResult[]): AttemptGrade {
  return {
    noteResults: results,
    verdict: results.every((r) => r.status === 'matched') ? 'correct' : 'incorrect',
    confidence: 1,
    lowConfidence: false,
    timedOut: false,
  };
}

const r = (
  status: NoteResult['status'],
  expectedMidi: number | null,
  detectedMidi: number | null,
) => ({
  targetIndex: expectedMidi === null ? null : 0,
  status,
  expectedMidi,
  detectedMidi,
  octaveMismatch: false,
});

describe('first-run onboarding', () => {
  test('shows until it is marked seen, then never again', async () => {
    const kv = fakeStore();
    expect(await isOnboarded(kv)).toBe(false);
    await markOnboarded(kv);
    expect(await isOnboarded(kv)).toBe(true);
  });

  describe('play coach walks the Fifth one step at a time', () => {
    const fifth = [55, 55, 55, 51];
    const D = 2;
    test('first: the glowing fret', () => expect(playCoach(0, fifth, D)).toMatch(/glowing fret/));
    test('a repeat: tap it again', () => {
      expect(playCoach(1, fifth, D)).toMatch(/same/);
      expect(playCoach(2, fifth, D)).toMatch(/same/);
    });
    test('a lower note: which way to search, on which string', () => {
      const tip = playCoach(3, fifth, D);
      expect(tip).toMatch(/lower/);
      expect(tip).toMatch(/frets above/);
      expect(tip).toMatch(/D string/);
    });
    test('a higher note points below on the board', () => {
      expect(playCoach(1, [50, 52], D)).toMatch(/higher: tap the frets below/);
    });
    test('full: Check, or keep tapping to swap the last note', () => {
      expect(playCoach(4, fifth, D)).toMatch(/Check/);
      expect(playCoach(4, fifth, D)).toMatch(/replaces the last note/);
    });
    test('names the thin string "high E"', () => expect(stringName(5)).toBe('high E'));
  });

  describe('after a check', () => {
    // Target indexes in order, as the grader returns them.
    const miss = grade(
      [r('matched', 55, 55), r('matched', 55, 55), r('matched', 55, 55), r('wrong', 51, 53)].map(
        (x, targetIndex) => ({ ...x, targetIndex }),
      ),
    );
    test('keeps the notes right up to the first miss', () => {
      expect(rightPrefix(miss)).toBe(3);
      expect(rightPrefix(grade([r('wrong', 55, 54), r('matched', 55, 55)]))).toBe(0);
    });
    test('names the note that is off and which way', () => {
      expect(missCoach(miss)).toEqual({
        title: 'Almost: 3 of 4 right',
        line: 'Note 4 is off. It should be lower. The right ones stay on the board.',
      });
    });
    test('praise only when the learner found it', () => {
      expect(doneCoach(true).title).toMatch(/by ear/);
      expect(doneCoach(false).title).not.toMatch(/by ear/);
    });
  });
});
