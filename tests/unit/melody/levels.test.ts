// The difficulty ladder (FR-010, research R11): a sawtooth route through vocabulary, interval size,
// length, motif predictability, and span.
import {
  MAX_RANK,
  MIN_RANK,
  allLevels,
  describeLeap,
  describeScales,
  getLevel,
  getLevelByRank,
} from '../../../src/services/melody/levels';
import { generateMelody } from '../../../src/services/melody/generator';
import { scalePitchClasses } from '../../../src/services/melody/scales';
import { pitchClass } from '../../../src/lib/pitchNote';
import { MotifMode } from '../../../src/models';

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

  test('vocabulary advances pentatonic → major → minor → mixed', () => {
    expect(allLevels().map(describeScales)).toEqual([
      'major pentatonic',
      'major pentatonic',
      'major pentatonic',
      'major',
      'major',
      'major',
      'natural minor',
      'natural minor',
      'major / natural minor',
    ]);
  });

  test('a new vocabulary is introduced with a shorter phrase than the rank before (sawtooth)', () => {
    const levels = allLevels();
    for (let i = 1; i < levels.length; i++) {
      const changed = describeScales(levels[i]) !== describeScales(levels[i - 1]);
      const isFinalMix = levels[i].rank === MAX_RANK;
      if (changed && !isFinalMix) {
        expect(levels[i].noteCount).toBeLessThan(levels[i - 1].noteCount);
      }
    }
  });

  test('within one vocabulary, nothing gets easier from rank to rank', () => {
    const order: MotifMode[] = ['repeat', 'sequence', 'variation', 'none'];
    const levels = allLevels();
    for (let i = 1; i < levels.length; i++) {
      const [prev, cur] = [levels[i - 1], levels[i]];
      if (describeScales(prev) !== describeScales(cur)) continue;
      expect(cur.noteCount).toBeGreaterThanOrEqual(prev.noteCount);
      expect(cur.maxLeap).toBeGreaterThanOrEqual(prev.maxLeap);
      expect(cur.maxSpan).toBeGreaterThanOrEqual(prev.maxSpan);
      // Short phrases have no motif ('none' there means "too short to structure", not "free"),
      // so predictability is only compared between two motif levels.
      if (prev.motif !== 'none' && cur.motif !== 'none') {
        expect(order.indexOf(cur.motif)).toBeGreaterThanOrEqual(order.indexOf(prev.motif));
      }
    }
  });

  test('the top rank is the hardest on every dimension', () => {
    const top = getLevelByRank(MAX_RANK);
    for (const level of allLevels()) {
      expect(top.noteCount).toBeGreaterThanOrEqual(level.noteCount);
      expect(top.maxLeap).toBeGreaterThanOrEqual(level.maxLeap);
      expect(top.maxSpan).toBeGreaterThanOrEqual(level.maxSpan);
    }
    expect(top.motif).toBe('none');
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

  test('describeLeap names intervals', () => {
    expect(describeLeap(2)).toBe('whole step');
    expect(describeLeap(7)).toBe('fifth');
    expect(describeLeap(12)).toBe('octave');
  });
});

describe('the generator honours every level', () => {
  test.each(allLevels().map((l) => [l.id, l] as const))(
    '%s: all hard constraints hold',
    (_, level) => {
      for (let seed = 0; seed < 150; seed++) {
        const m = generateMelody(level, seed * 31 + level.rank);
        const p = m.notes.map((n) => n.midi);
        const pcs = scalePitchClasses(m.scale);
        expect(p).toHaveLength(level.noteCount);
        expect(level.scales.some((s) => m.scale.endsWith(`_${s}`))).toBe(true);
        for (let i = 0; i < p.length; i++) {
          expect(pcs).toContain(pitchClass(p[i]));
          expect(p[i]).toBeGreaterThanOrEqual(level.rangeLowMidi);
          expect(p[i]).toBeLessThanOrEqual(level.rangeHighMidi);
          if (i > 0) {
            expect(p[i]).not.toBe(p[i - 1]);
            expect(Math.abs(p[i] - p[i - 1])).toBeLessThanOrEqual(level.maxLeap);
          }
        }
        expect(Math.max(...p) - Math.min(...p)).toBeLessThanOrEqual(level.maxSpan);
        expect(pitchClass(p[p.length - 1])).toBe(pcs[0]);
        if (p.length >= 4) expect(new Set(p).size).toBeGreaterThanOrEqual(3);
      }
    },
  );
});
