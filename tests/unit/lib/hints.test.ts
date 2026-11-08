import {
  fingering,
  oneStringFingering,
  firstMissDirection,
  shouldOfferHelp,
  HELP_AFTER_FAILS,
} from '../../../src/lib/hints';
import { fretMidi } from '../../../src/lib/fretboard';
import { AttemptGrade } from '../../../src/models';

describe('help after repeated fails', () => {
  test('is offered from the third failed check on a phrase', () => {
    expect(HELP_AFTER_FAILS).toBe(3);
    expect(shouldOfferHelp(0)).toBe(false);
    expect(shouldOfferHelp(2)).toBe(false);
    expect(shouldOfferHelp(3)).toBe(true);
    expect(shouldOfferHelp(6)).toBe(true);
  });
});

describe('fingering', () => {
  test('gives one position per note, each sounding that note', () => {
    const midis = [55, 55, 55, 51, 53, 53, 53, 50];
    const line = fingering(midis);
    expect(line).toHaveLength(midis.length);
    line.forEach((p, i) => expect(fretMidi(p)).toBe(midis[i]));
  });

  test('keeps a repeated note in one place', () => {
    const [a, b, c] = fingering([67, 67, 67]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  test('stays near the nut and moves the hand little', () => {
    // The Fifth's opening as served (G3 G3 G3 Eb3): open G, then D string fret 1.
    expect(fingering([55, 55, 55, 51])).toEqual([
      { string: 3, fret: 0 },
      { string: 3, fret: 0 },
      { string: 3, fret: 0 },
      { string: 2, fret: 1 },
    ]);
  });

  test('skips notes off the board and is empty for none', () => {
    expect(fingering([])).toEqual([]);
    expect(fingering([10, 60])).toHaveLength(1);
  });
});

describe('firstMissDirection', () => {
  const g = (expected: number, detected: number): AttemptGrade => ({
    noteResults: [
      {
        targetIndex: 0,
        status: 'matched',
        expectedMidi: 60,
        detectedMidi: 60,
        octaveMismatch: false,
      },
      {
        targetIndex: 1,
        status: 'wrong',
        expectedMidi: expected,
        detectedMidi: detected,
        octaveMismatch: false,
      },
    ],
    verdict: 'incorrect',
    confidence: 1,
    lowConfidence: false,
    timedOut: false,
  });
  test('higher when the played note was below the target', () =>
    expect(firstMissDirection(g(64, 62))).toBe('higher'));
  test('lower when above', () => expect(firstMissDirection(g(64, 65))).toBe('lower'));
});

describe('oneStringFingering', () => {
  test('puts the Fifth on the D string, on frets, near the nut', () => {
    expect(oneStringFingering([55, 55, 55, 51])).toEqual([
      { string: 2, fret: 5 },
      { string: 2, fret: 5 },
      { string: 2, fret: 5 },
      { string: 2, fret: 1 },
    ]);
  });
  test('null when no string holds every note on a fret', () => {
    expect(oneStringFingering([40, 76])).toBeNull();
  });
});
