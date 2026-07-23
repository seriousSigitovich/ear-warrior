// T037 — the difficulty ladder (FR-010, SC-005, research R11).
// Levels differ in melody length ONLY; the pitch pool and tempo are constants shared by every rank.
import {
  FIXED_RANGE_HIGH_MIDI,
  FIXED_RANGE_LOW_MIDI,
  FIXED_SCALE,
  FIXED_TEMPO_BPM,
  MAX_RANK,
  MIN_RANK,
  allLevels,
  getLevel,
  getLevelByRank,
} from '../../../src/services/melody/levels';
import { scalePitchClasses } from '../../../src/services/melody/scales';
import { generateMelody } from '../../../src/services/melody/generator';
import { pitchClass } from '../../../src/lib/pitchNote';

describe('ladder shape (FR-010, SC-005)', () => {
  test('there are exactly 7 levels', () => {
    expect(allLevels()).toHaveLength(7);
  });

  test('ranks are contiguous 1–7 in order', () => {
    expect(allLevels().map((l) => l.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('noteCount is rank + 1, running 2 → 8', () => {
    for (const level of allLevels()) {
      expect(level.noteCount).toBe(level.rank + 1);
    }
    expect(allLevels().map((l) => l.noteCount)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  test('MIN_RANK and MAX_RANK match the ladder bounds', () => {
    expect(MIN_RANK).toBe(1);
    expect(MAX_RANK).toBe(7);
  });

  test('ids are derived from rank', () => {
    expect(allLevels().map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  });
});

describe('melody length is the only varying dimension (FR-010)', () => {
  test('scale, range, and tempo are identical at every rank', () => {
    for (const level of allLevels()) {
      expect(level.scale).toBe(FIXED_SCALE);
      expect(level.rangeLowMidi).toBe(FIXED_RANGE_LOW_MIDI);
      expect(level.rangeHighMidi).toBe(FIXED_RANGE_HIGH_MIDI);
      expect(level.tempoBpm).toBe(FIXED_TEMPO_BPM);
    }
  });

  test('the fixed pool is C major, C4–C5, at 60 BPM', () => {
    expect(FIXED_SCALE).toBe('C_major');
    expect(FIXED_RANGE_LOW_MIDI).toBe(60);
    expect(FIXED_RANGE_HIGH_MIDI).toBe(72);
    expect(FIXED_TEMPO_BPM).toBe(60);
  });
});

describe('the fixed pool supports the whole ladder', () => {
  /** Candidate pitches available to the generator at every rank. */
  function candidates(): number[] {
    const pcs = new Set(scalePitchClasses(FIXED_SCALE));
    const out: number[] = [];
    for (let midi = FIXED_RANGE_LOW_MIDI; midi <= FIXED_RANGE_HIGH_MIDI; midi++) {
      if (pcs.has(pitchClass(midi))) out.push(midi);
    }
    return out;
  }

  test('yields 8 distinct pitches (C D E F G A B C)', () => {
    expect(candidates()).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  test('stays ≥ 2 pitches, so the no-consecutive-repeats rule is satisfiable (FR-001)', () => {
    expect(candidates().length).toBeGreaterThanOrEqual(2);
  });

  test('spans exactly one octave, so no note name appears twice', () => {
    const names = candidates().map(pitchClass);
    // C appears at both ends (60 and 72) — every other pitch class is unique.
    expect(new Set(names).size).toBe(candidates().length - 1);
  });
});

describe('lookup', () => {
  test('getLevelByRank returns the level with that rank', () => {
    expect(getLevelByRank(4).noteCount).toBe(5);
  });

  test('getLevel resolves by id', () => {
    expect(getLevel('L7').rank).toBe(7);
  });

  test.each([0, 8, -1])('getLevelByRank throws for out-of-range rank %p', (rank) => {
    expect(() => getLevelByRank(rank)).toThrow();
  });

  test('getLevel throws for an unknown id', () => {
    expect(() => getLevel('L99')).toThrow();
  });
});

describe('the generator honours every level (US2 #1)', () => {
  test('each rank produces exactly rank + 1 notes, all from the fixed pool', () => {
    for (const level of allLevels()) {
      const melody = generateMelody(level, 12345 + level.rank);
      expect(melody.notes).toHaveLength(level.rank + 1);
      for (const note of melody.notes) {
        expect(note.midi).toBeGreaterThanOrEqual(FIXED_RANGE_LOW_MIDI);
        expect(note.midi).toBeLessThanOrEqual(FIXED_RANGE_HIGH_MIDI);
        expect(scalePitchClasses(FIXED_SCALE)).toContain(pitchClass(note.midi));
      }
    }
  });

  test('no rank produces two identical pitches back-to-back (FR-001)', () => {
    for (const level of allLevels()) {
      for (let seed = 0; seed < 25; seed++) {
        const midis = generateMelody(level, seed).notes.map((n) => n.midi);
        for (let i = 1; i < midis.length; i++) {
          expect(midis[i]).not.toBe(midis[i - 1]);
        }
      }
    }
  });
});
