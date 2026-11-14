import { Melody } from '../../../src/models';
import {
  END_MS,
  NAME_STEP_MIN,
  TRACK_PAD,
  noteAtOffset,
  noteTimeline,
  handleX,
  markCenters,
  markStep,
  showsNames,
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

describe('track geometry', () => {
  test('marks are evenly spaced from the pad to the far pad', () => {
    const c = markCenters(5, 200);
    expect(c[0]).toBe(TRACK_PAD);
    expect(c[4]).toBe(200 - TRACK_PAD);
    expect(c[1] - c[0]).toBeCloseTo(c[2] - c[1]);
  });

  test('a single mark sits in the middle and none gives nothing', () => {
    expect(markCenters(1, 100)).toEqual([50]);
    expect(markCenters(0, 100)).toEqual([]);
  });

  test('names need 14 dp between marks: 12 notes on the usual 213 dp track have them, 17 do not', () => {
    expect(markStep(12, 213)).toBeGreaterThanOrEqual(NAME_STEP_MIN);
    expect(showsNames(12, 213)).toBe(true);
    expect(showsNames(17, 213)).toBe(false);
    expect(showsNames(1, 213)).toBe(false);
  });

  test('marks never crowd: for every library phrase length on tracks from 170 to 400 dp they are at least 9 dp apart', () => {
    for (let count = 4; count <= 17; count++) {
      for (let width = 170; width <= 400; width += 5) {
        expect(markStep(count, width)).toBeGreaterThanOrEqual(9);
      }
    }
  });
});

describe('noteAtOffset', () => {
  test('a touch picks the nearest mark', () => {
    const c = markCenters(5, 200);
    c.forEach((x, i) => expect(noteAtOffset(x, 200, 5)).toBe(i));
    expect(noteAtOffset(c[2] + 3, 200, 5)).toBe(2);
  });
  test('beyond either end it clamps', () => {
    expect(noteAtOffset(-50, 200, 5)).toBe(0);
    expect(noteAtOffset(900, 200, 5)).toBe(4);
  });
  test('one note, or no width, is always note 0', () => {
    expect(noteAtOffset(40, 100, 1)).toBe(0);
    expect(noteAtOffset(40, 0, 5)).toBe(0);
  });
});

describe('handleX', () => {
  const starts = [0, 500, 1500];
  const c = markCenters(3, 200);
  test('nothing playing gives no handle', () => {
    expect(handleX(null, starts, 2000, 200)).toBeNull();
  });
  test('it sits on a mark at the start of its note and runs on to the next', () => {
    expect(handleX(0, starts, 2000, 200)).toBeCloseTo(c[0]);
    expect(handleX(500, starts, 2000, 200)).toBeCloseTo(c[1]);
    expect(handleX(250, starts, 2000, 200)).toBeCloseTo((c[0] + c[1]) / 2);
  });
  test('it is on the last mark from its start to the end', () => {
    expect(handleX(1500, starts, 2000, 200)).toBeCloseTo(c[2]);
    expect(handleX(2000, starts, 2000, 200)).toBeCloseTo(c[2]);
  });
});
