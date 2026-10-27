// The difficulty ladder (FR-010): nine ranks, each with a note count and a constant tempo.
import {
  MAX_RANK,
  MIN_RANK,
  TEMPO_BPM,
  allLevels,
  getLevel,
  getLevelByRank,
} from '../../../src/services/melody/levels';

describe('ladder shape (FR-010)', () => {
  test('there are exactly 9 levels, ranks contiguous 1–9', () => {
    expect(allLevels().map((l) => l.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(MIN_RANK).toBe(1);
    expect(MAX_RANK).toBe(9);
  });

  test('ids are derived from rank', () => {
    expect(allLevels().map((l) => l.id)).toEqual([
      'L1',
      'L2',
      'L3',
      'L4',
      'L5',
      'L6',
      'L7',
      'L8',
      'L9',
    ]);
  });

  test('tempo is constant: rhythm is not a difficulty knob', () => {
    for (const level of allLevels()) expect(level.tempoBpm).toBe(TEMPO_BPM);
  });

  test('the top rank has the most notes', () => {
    const top = getLevelByRank(MAX_RANK);
    for (const level of allLevels()) expect(top.noteCount).toBeGreaterThanOrEqual(level.noteCount);
  });
});

describe('lookup', () => {
  test('getLevelByRank returns the level with that rank', () => {
    expect(getLevelByRank(4).rank).toBe(4);
  });

  test('getLevel resolves by id', () => {
    expect(getLevel('L9').rank).toBe(9);
  });

  test.each([0, 10, -1, 1.5])('getLevelByRank throws for out-of-range rank %p', (rank) => {
    expect(() => getLevelByRank(rank)).toThrow();
  });

  test('getLevel throws for an unknown id', () => {
    expect(() => getLevel('L99')).toThrow();
  });
});
