import { FRET_COUNT, MAX_FRET, STRING_COUNT, fretMidi } from '../../../src/lib/fretboard';
import { fretCentre, fretEdges, neckPositions, standingWave } from '../../../src/lib/neckNotes';

describe('where the notes of a phrase sit on the neck', () => {
  test('each note lands on a position that sounds exactly that note', () => {
    const midis = [64, 62, 60, 64, 62, 60, 60, 60, 62, 62, 64, 62, 60];
    const found = neckPositions(midis);
    expect(found).toHaveLength(midis.length);
    found.forEach((p, i) => {
      expect(fretMidi(p)).toBe(midis[i]);
      expect(p.string).toBeLessThan(STRING_COUNT);
      expect(p.fret).toBeLessThanOrEqual(MAX_FRET);
    });
  });

  test('a run of notes stays on neighbouring strings instead of jumping about', () => {
    const found = neckPositions([60, 62, 64, 65, 67]);
    for (let i = 1; i < found.length; i++) {
      expect(Math.abs(found[i].string - found[i - 1].string)).toBeLessThanOrEqual(1);
    }
  });

  test('a note off the board is left out and nothing else moves', () => {
    expect(neckPositions([30, 60])).toHaveLength(1);
    expect(neckPositions([])).toEqual([]);
  });
});

describe('the neck drawn to scale', () => {
  test('frets get closer together up the neck and the last one sits inside the neck', () => {
    const edges = fretEdges(300);
    expect(edges).toHaveLength(FRET_COUNT);
    expect(edges[0]).toBe(0);
    for (let i = 2; i < edges.length; i++) {
      expect(edges[i] - edges[i - 1]).toBeLessThan(edges[i - 1] - edges[i - 2]);
    }
    expect(edges[edges.length - 1]).toBeLessThan(300);
    expect(edges[edges.length - 1]).toBeGreaterThan(250);
  });

  test('a note sits between its fret and the one before; an open string on the nut itself', () => {
    const edges = fretEdges(300);
    expect(fretCentre(0, edges)).toBe(0);
    expect(fretCentre(1, edges)).toBeCloseTo(edges[1] / 2);
    expect(fretCentre(5, edges)).toBeCloseTo((edges[4] + edges[5]) / 2);
  });
});

describe('a string pinned at both ends', () => {
  test('stands still at the ends and swings most in the middle', () => {
    expect(standingWave(0, 100).lift).toBeCloseTo(0);
    expect(standingWave(100, 100).lift).toBeCloseTo(0);
    expect(standingWave(50, 100).lift).toBeCloseTo(1);
  });

  test('its slope is steepest at the ends and flat in the middle, and rises away from the nut', () => {
    expect(standingWave(50, 100).slope).toBeCloseTo(0);
    expect(standingWave(10, 100).slope).toBeGreaterThan(0);
    expect(standingWave(90, 100).slope).toBeLessThan(0);
  });
});
