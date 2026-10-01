import { DifficultyLevel, Melody } from '../../../src/models';
import { generateMelody } from '../../../src/services/melody/generator';
import { scalePitchClasses } from '../../../src/services/melody/scales';
import { pitchClass } from '../../../src/lib/pitchNote';

const LEVEL: DifficultyLevel = {
  id: 'TST',
  rank: 5,
  noteCount: 6,
  scales: ['major'],
  maxLeap: 4,
  maxSpan: 9,
  motif: 'sequence',
  rangeLowMidi: 52,
  rangeHighMidi: 79,
  tempoBpm: 90,
};

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7 + 1);

function midis(m: Melody): number[] {
  return m.notes.map((n) => n.midi);
}

describe('melody generator (FR-001)', () => {
  test('produces exactly noteCount notes', () => {
    expect(generateMelody(LEVEL, 1).notes).toHaveLength(LEVEL.noteCount);
  });

  test('every note is in the register and in the melody’s own scale', () => {
    for (const seed of SEEDS) {
      const m = generateMelody(LEVEL, seed);
      const pcs = scalePitchClasses(m.scale);
      for (const midi of midis(m)) {
        expect(midi).toBeGreaterThanOrEqual(LEVEL.rangeLowMidi);
        expect(midi).toBeLessThanOrEqual(LEVEL.rangeHighMidi);
        expect(pcs).toContain(pitchClass(midi));
      }
    }
  });

  test('never places two identical pitches consecutively (FR-004)', () => {
    for (const seed of SEEDS) {
      const p = midis(generateMelody(LEVEL, seed));
      for (let i = 1; i < p.length; i++) expect(p[i]).not.toBe(p[i - 1]);
    }
  });

  test('respects maxLeap and maxSpan', () => {
    for (const seed of SEEDS) {
      const p = midis(generateMelody(LEVEL, seed));
      for (let i = 1; i < p.length; i++) {
        expect(Math.abs(p[i] - p[i - 1])).toBeLessThanOrEqual(LEVEL.maxLeap);
      }
      expect(Math.max(...p) - Math.min(...p)).toBeLessThanOrEqual(LEVEL.maxSpan);
    }
  });

  test('ends on the tonic, held longer than a beat', () => {
    for (const seed of SEEDS) {
      const m = generateMelody(LEVEL, seed);
      const last = m.notes[m.notes.length - 1];
      expect(pitchClass(last.midi)).toBe(scalePitchClasses(m.scale)[0]);
      expect(last.durationBeats).toBeGreaterThan(1);
    }
  });

  test('has rhythm — not every note is the same length', () => {
    const varied = SEEDS.filter((seed) => {
      const beats = generateMelody(LEVEL, seed)
        .notes.slice(0, -1)
        .map((n) => n.durationBeats);
      return new Set(beats).size > 1;
    });
    expect(varied.length).toBeGreaterThan(SEEDS.length / 2);
  });

  test('uses at least three distinct pitches from four notes up', () => {
    for (const seed of SEEDS) {
      expect(new Set(midis(generateMelody(LEVEL, seed))).size).toBeGreaterThanOrEqual(3);
    }
  });

  test('varies the key across seeds', () => {
    const keys = new Set(SEEDS.map((seed) => generateMelody(LEVEL, seed).scale));
    expect(keys.size).toBeGreaterThan(1);
  });

  test('is deterministic for a given seed', () => {
    expect(generateMelody(LEVEL, 42)).toEqual(generateMelody(LEVEL, 42));
  });

  test('throws on an invalid noteCount', () => {
    expect(() => generateMelody({ ...LEVEL, noteCount: 1 }, 1)).toThrow();
    expect(() => generateMelody({ ...LEVEL, noteCount: 13 }, 1)).toThrow();
  });

  test('throws when the register excludes the tonic', () => {
    expect(() => generateMelody({ ...LEVEL, rangeLowMidi: 80, rangeHighMidi: 84 }, 1)).toThrow();
  });
});

describe('motif structure', () => {
  const beats = (m: Melody) => m.notes.map((n) => n.durationBeats);

  test('repeat: the consequent restates the motif’s pitches and rhythm', () => {
    const level: DifficultyLevel = { ...LEVEL, motif: 'repeat', noteCount: 6 };
    for (const seed of SEEDS) {
      const m = generateMelody(level, seed);
      const p = midis(m);
      // 6 notes → motif of 3; the consequent repeats its first 2 notes, then cadences.
      expect(p.slice(3, 5)).toEqual(p.slice(0, 2));
      expect(beats(m).slice(3, 5)).toEqual(beats(m).slice(0, 2));
    }
  });

  test('sequence: the consequent moves the motif by one scale degree', () => {
    const level: DifficultyLevel = { ...LEVEL, motif: 'sequence', noteCount: 7 };
    for (const seed of SEEDS) {
      const m = generateMelody(level, seed);
      const pcs = scalePitchClasses(m.scale);
      const degree = (midi: number) =>
        Math.floor((midi - pcs[0]) / 12) * pcs.length + pcs.indexOf(pitchClass(midi));
      const p = midis(m);
      // 7 notes → motif of 3, consequent of 3 + the cadence note.
      const shifts = [0, 1, 2].map((i) => degree(p[i + 3]) - degree(p[i]));
      expect(new Set(shifts).size).toBe(1);
      expect(Math.abs(shifts[0])).toBe(1);
    }
  });

  test('the opening motif does not already close on the tonic', () => {
    const level: DifficultyLevel = { ...LEVEL, motif: 'repeat', noteCount: 8 };
    for (const seed of SEEDS) {
      const m = generateMelody(level, seed);
      expect(pitchClass(m.notes[3].midi)).not.toBe(scalePitchClasses(m.scale)[0]);
    }
  });
});
