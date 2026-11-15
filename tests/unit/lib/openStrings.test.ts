import { OPEN_STRING_MIDI } from '../../../src/lib/fretboard';
import {
  STRING_ROWS,
  openStringMidi,
  stringAtY,
  waveKeyframes,
} from '../../../src/lib/openStrings';

describe('which open string a touch is on', () => {
  test('the top row is the thin high e and the bottom row the low E', () => {
    expect(openStringMidi(0)).toBe(OPEN_STRING_MIDI[5]);
    expect(openStringMidi(5)).toBe(OPEN_STRING_MIDI[0]);
    expect(Array.from({ length: STRING_ROWS }, (_, i) => openStringMidi(i))).toEqual(
      [...OPEN_STRING_MIDI].reverse(),
    );
  });

  test('a touch height falls into one of six equal rows, and outside the area it clamps', () => {
    expect(stringAtY(0, 240)).toBe(0);
    expect(stringAtY(39, 240)).toBe(0);
    expect(stringAtY(41, 240)).toBe(1);
    expect(stringAtY(239, 240)).toBe(5);
    expect(stringAtY(-30, 240)).toBe(0);
    expect(stringAtY(900, 240)).toBe(5);
  });

  test('an area with no height has no string to hit', () => {
    expect(stringAtY(10, 0)).toBe(0);
  });
});

describe('the wave a string is drawn with', () => {
  test('is one whole sine cycle that ends where it started, so the loop has no seam', () => {
    const k = waveKeyframes(0, 12);
    expect(k).toHaveLength(13);
    expect(k[0]).toBeCloseTo(0);
    expect(k[3]).toBeCloseTo(1);
    expect(k[9]).toBeCloseTo(-1);
    expect(k[12]).toBeCloseTo(k[0]);
  });

  test('a segment further along the string is the same wave a little ahead', () => {
    const a = waveKeyframes(0, 12);
    const b = waveKeyframes(0.25, 12);
    expect(b[0]).toBeCloseTo(a[3]);
    expect(b[1]).toBeCloseTo(a[4]);
  });
});
