import { Melody } from '../../../src/models';
import {
  END_MS,
  CIRCLE_MAX,
  CIRCLE_MIN,
  NAME_MIN,
  noteAtOffset,
  noteTimeline,
  circleCenters,
  circleSize,
  rowState,
  resumable,
} from '../../../src/lib/noteRow';

function melody(beats: number[], tempoBpm = 120): Melody {
  return {
    id: 'm',
    difficultyId: 'L1',
    scale: 'C_major',
    tempoBpm,
    createdAt: '',
    notes: beats.map((durationBeats, index) => ({
      index,
      midi: 60 + index,
      noteName: 'C4',
      frequencyHz: 261,
      centsOffset: 0,
      durationBeats,
    })),
  };
}

describe('noteTimeline', () => {
  test('starts every note after the ones before it, at the tune tempo', () => {
    // 120 bpm → 500 ms a beat
    const t = noteTimeline(melody([1, 2, 1]));
    expect(t.starts).toEqual([0, 500, 1500]);
    expect(t.totalMs).toBe(2000);
  });
});

describe('resumable', () => {
  test('needs more than END_MS left', () => {
    expect(resumable(1000, 2000)).toBe(true);
    expect(resumable(2000 - END_MS, 2000)).toBe(false);
    expect(resumable(2000 - END_MS - 1, 2000)).toBe(true);
    expect(resumable(0, 2000)).toBe(true);
  });
  test('refuses a position that is not a time', () => {
    expect(resumable(NaN, 2000)).toBe(false);
    expect(resumable(-1, 2000)).toBe(false);
  });
});

describe('rowState', () => {
  const starts = [0, 500, 1500];
  test('nothing playing leaves every circle empty', () => {
    expect(rowState(null, starts, 2000)).toEqual({ played: 0, current: -1 });
  });
  test('the sounding note is the last one started; the ones before it have played', () => {
    expect(rowState(0, starts, 2000)).toEqual({ played: 0, current: 0 });
    expect(rowState(499, starts, 2000)).toEqual({ played: 0, current: 0 });
    expect(rowState(500, starts, 2000)).toEqual({ played: 1, current: 1 });
    expect(rowState(1999, starts, 2000)).toEqual({ played: 2, current: 2 });
  });
  test('past the end every circle has played and none sounds', () => {
    expect(rowState(2000, starts, 2000)).toEqual({ played: 3, current: -1 });
  });
});

describe('circle geometry', () => {
  test('circles are as big as fits, within their limits', () => {
    expect(circleSize(8, 330)).toBe(CIRCLE_MAX);
    expect(circleSize(12, 250)).toBe(16); // 250 / 12 = 20 dp a circle, less 4 for the gap
    expect(circleSize(17, 250)).toBe(CIRCLE_MIN);
    expect(circleSize(0, 250)).toBe(CIRCLE_MAX);
  });
  test('circles never overlap, for any library phrase length on a phone from 188 to 400 dp of row', () => {
    for (let count = 4; count <= 17; count++) {
      for (let width = 188; width <= 400; width += 4) {
        const c = circleCenters(count, width);
        const size = circleSize(count, width);
        expect(c[1] - c[0]).toBeGreaterThanOrEqual(size);
      }
    }
  });

  test('the longest phrase on the usual 228 dp row gets 10 dp circles, too small for a name; 12 notes still get one', () => {
    expect(circleSize(17, 228)).toBe(CIRCLE_MIN);
    expect(circleSize(17, 228)).toBeLessThan(NAME_MIN);
    expect(circleSize(12, 228)).toBeGreaterThanOrEqual(NAME_MIN);
  });

  test('centres are evenly spaced, the first and last a radius in from the ends', () => {
    const c = circleCenters(3, 100);
    const r = circleSize(3, 100) / 2;
    expect(c[0]).toBe(r);
    expect(c[2]).toBe(100 - r);
    expect(c[1] - c[0]).toBeCloseTo(c[2] - c[1]);
  });
  test('a single circle sits in the middle', () => {
    expect(circleCenters(1, 100)).toEqual([50]);
  });
});

describe('noteAtOffset', () => {
  test('a touch picks the nearest circle', () => {
    const c = circleCenters(5, 200);
    c.forEach((y, i) => expect(noteAtOffset(y, 200, 5)).toBe(i));
    expect(noteAtOffset(c[2] + 3, 200, 5)).toBe(2);
  });
  test('beyond either end it clamps', () => {
    expect(noteAtOffset(-50, 200, 5)).toBe(0);
    expect(noteAtOffset(900, 200, 5)).toBe(4);
  });
  test('one note, or no height, is always note 0', () => {
    expect(noteAtOffset(40, 100, 1)).toBe(0);
    expect(noteAtOffset(40, 0, 5)).toBe(0);
  });
});
