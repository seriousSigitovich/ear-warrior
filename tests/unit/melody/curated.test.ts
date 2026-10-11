// FR-021: the MVP's melodies are a curated set, not generated. These tests guard the set itself —
// every tune must be answerable on the 12-fret neck, belong to its scale (a typo shows up as a note
// outside it) and every difficulty level must have something to play.
import { DifficultyLevel } from '../../../src/models';
import { CURATED, curatedMelody } from '../../../src/services/melody/curated';
import { MAX_RANK, MIN_RANK, getLevelByRank } from '../../../src/services/melody/levels';
import { scalePitchClasses } from '../../../src/services/melody/scales';
import { MAX_FRET, OPEN_STRING_MIDI, positionsForMidi } from '../../../src/lib/fretboard';
import { hzFromMidi, noteName, pitchClass } from '../../../src/lib/pitchNote';

const NECK_LOW = OPEN_STRING_MIDI[0];
const NECK_HIGH = OPEN_STRING_MIDI[OPEN_STRING_MIDI.length - 1] + MAX_FRET;
const RANKS = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => MIN_RANK + i);

function level(rank: number): DifficultyLevel {
  return getLevelByRank(rank);
}

describe('curated melody set (FR-021)', () => {
  test('tune ids are unique', () => {
    const ids = CURATED.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(RANKS)('level %i has at least one tune', (rank) => {
    expect(CURATED.some((t) => t.rank === rank)).toBe(true);
  });

  test('every tune has 2–12 notes', () => {
    for (const t of CURATED) {
      const n = curatedMelody(level(t.rank), 0, t.id).notes.length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(12);
    }
  });

  test('every note lies on the neck (E2–E5) and has a position to tap', () => {
    for (const t of CURATED) {
      for (const note of curatedMelody(level(t.rank), 0, t.id).notes) {
        expect(note.midi).toBeGreaterThanOrEqual(NECK_LOW);
        expect(note.midi).toBeLessThanOrEqual(NECK_HIGH);
        expect(positionsForMidi(note.midi).length).toBeGreaterThan(0);
      }
    }
  });

  test('every note belongs to its tune’s scale', () => {
    for (const t of CURATED) {
      const pcs = scalePitchClasses(t.scale);
      for (const note of curatedMelody(level(t.rank), 0, t.id).notes) {
        expect({
          tune: t.id,
          midi: note.midi,
          inScale: pcs.includes(pitchClass(note.midi)),
        }).toEqual({
          tune: t.id,
          midi: note.midi,
          inScale: true,
        });
      }
    }
  });
});

describe('curatedMelody', () => {
  test('builds a Melody in the generator’s shape', () => {
    const m = curatedMelody(level(1), 7);
    expect(m.difficultyId).toBe('L1');
    expect(m.notes.map((n) => n.index)).toEqual(m.notes.map((_, i) => i));
    for (const n of m.notes) {
      expect(n.noteName).toBe(noteName(n.midi));
      expect(n.frequencyHz).toBe(hzFromMidi(n.midi));
      expect(n.centsOffset).toBe(0);
      expect(n.durationBeats).toBeGreaterThan(0);
    }
  });

  test('is deterministic for a seed', () => {
    for (const rank of RANKS) {
      expect(curatedMelody(level(rank), 42)).toEqual(curatedMelody(level(rank), 42));
    }
  });

  test('only offers tunes of the requested level', () => {
    for (const rank of RANKS) {
      for (let seed = 0; seed < 20; seed++) {
        const m = curatedMelody(level(rank), seed);
        expect(m.difficultyId).toBe(`L${rank}`);
        const tune = CURATED.find((t) => m.id.startsWith(`${t.id}-`));
        expect(tune?.rank).toBe(rank);
      }
    }
  });

  test('a level with several tunes does not always return the same one', () => {
    const rank = RANKS.find((r) => CURATED.filter((t) => t.rank === r).length >= 2)!;
    const ids = new Set(
      Array.from({ length: 30 }, (_, seed) => curatedMelody(level(rank), seed).id.split('-')[0]),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  test('every melody id is unique per seed so a new play is a new Melody row', () => {
    expect(curatedMelody(level(1), 1).id).not.toBe(curatedMelody(level(1), 2).id);
  });
});
