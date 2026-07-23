import { DifficultyLevel } from '../../../src/models';
import { generateMelody } from '../../../src/services/melody/generator';
import { scalePitchClasses } from '../../../src/services/melody/scales';

const LEVEL: DifficultyLevel = {
  id: 'TST',
  rank: 2,
  noteCount: 5,
  scale: 'C_major_pentatonic',
  rangeLowMidi: 60, // C4
  rangeHighMidi: 84, // C6
  tempoBpm: 90,
};

describe('melody generator (FR-001)', () => {
  test('produces exactly noteCount notes', () => {
    const m = generateMelody(LEVEL, 1);
    expect(m.notes).toHaveLength(LEVEL.noteCount);
  });

  test('every note is within the level range and scale', () => {
    const pcs = scalePitchClasses(LEVEL.scale);
    const m = generateMelody(LEVEL, 7);
    for (const n of m.notes) {
      expect(n.midi).toBeGreaterThanOrEqual(LEVEL.rangeLowMidi);
      expect(n.midi).toBeLessThanOrEqual(LEVEL.rangeHighMidi);
      expect(pcs).toContain(((n.midi % 12) + 12) % 12);
    }
  });

  test('never places two identical pitches consecutively (FR-001)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const m = generateMelody(LEVEL, seed);
      for (let i = 1; i < m.notes.length; i++) {
        expect(m.notes[i].midi).not.toBe(m.notes[i - 1].midi);
      }
    }
  });

  test('is deterministic for a given seed', () => {
    expect(generateMelody(LEVEL, 42)).toEqual(generateMelody(LEVEL, 42));
  });

  test('throws on an invalid level (noteCount < 2)', () => {
    expect(() => generateMelody({ ...LEVEL, noteCount: 1 }, 1)).toThrow();
  });

  test('throws when the range/scale yields fewer than two distinct pitches', () => {
    // A one-semitone range around a non-scale note leaves no usable pitches.
    expect(() => generateMelody({ ...LEVEL, rangeLowMidi: 61, rangeHighMidi: 61 }, 1)).toThrow();
  });
});
