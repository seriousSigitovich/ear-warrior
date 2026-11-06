// FR-021: the melodies are a library of 100 whole public-domain tunes. These tests guard the library
// itself — every tune must be answerable on the 12-fret neck, belong to its scale, appear once, carry
// its own tempo, and every difficulty level must hold a fair share of the tunes.
import { DifficultyLevel } from '../../../src/models';
import { LIBRARY, curatedMelody, masteredTuneIds, historyFromAttempts, tuneIdOf } from '../../../src/services/melody/curated';
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

describe('melody library (FR-021)', () => {
  test('tune ids are unique and hyphen-free', () => {
    const ids = LIBRARY.map((t) => t.id);
    for (const id of ids) expect(id).not.toContain('-');
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('the library holds 100 tunes, none of them twice', () => {
    expect(LIBRARY).toHaveLength(100);
    expect(new Set(LIBRARY.map((t) => t.title)).size).toBe(LIBRARY.length);
    // The same melody under two names (Twinkle / ABC Song) shows up as the same opening intervals.
    const openings = LIBRARY.map((t) => {
      const m = curatedMelody(level(t.rank), 0, t.id).notes.map((n) => n.midi);
      return m.slice(1, 9).map((x, i) => x - m[i]).join(',');
    });
    expect(new Set(openings).size).toBe(LIBRARY.length);
  });

  test.each(RANKS)('level %i holds 11 or 12 tunes', (rank) => {
    const n = LIBRARY.filter((t) => t.rank === rank).length;
    expect(n).toBeGreaterThanOrEqual(11);
    expect(n).toBeLessThanOrEqual(12);
  });

  test('every tune is a whole melody with its own tempo and a named source', () => {
    for (const t of LIBRARY) {
      const m = curatedMelody(level(t.rank), 0, t.id);
      expect({ tune: t.id, long: m.notes.length >= 15 }).toEqual({ tune: t.id, long: true });
      expect(m.tempoBpm).toBe(t.tempoBpm);
      expect(t.tempoBpm).toBeGreaterThanOrEqual(40);
      expect(t.tempoBpm).toBeLessThanOrEqual(220);
      expect(t.source.length).toBeGreaterThan(0);
    }
  });

  test('tunes do not share one tempo', () => {
    expect(new Set(LIBRARY.map((t) => t.tempoBpm)).size).toBeGreaterThan(10);
  });

  test('every note lies on the neck (E2–E5) and has a position to tap', () => {
    for (const t of LIBRARY) {
      for (const note of curatedMelody(level(t.rank), 0, t.id).notes) {
        expect(note.midi).toBeGreaterThanOrEqual(NECK_LOW);
        expect(note.midi).toBeLessThanOrEqual(NECK_HIGH);
        expect(positionsForMidi(note.midi).length).toBeGreaterThan(0);
      }
    }
  });

  test('every note belongs to its tune’s scale', () => {
    for (const t of LIBRARY) {
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
  test('builds a well-formed Melody', () => {
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
        const tune = LIBRARY.find((t) => m.id.startsWith(`${t.id}-`));
        expect(tune?.rank).toBe(rank);
      }
    }
  });

  test('a level with several tunes does not always return the same one', () => {
    const rank = RANKS.find((r) => LIBRARY.filter((t) => t.rank === r).length >= 2)!;
    const ids = new Set(
      Array.from({ length: 30 }, (_, seed) => curatedMelody(level(rank), seed).id.split('-')[0]),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  test('serves every tune of a level before repeating any, never the same one twice running', () => {
    for (const rank of RANKS) {
      const count = LIBRARY.filter((t) => t.rank === rank).length;
      const recent: string[] = [];
      for (let i = 0; i < count * 3; i++) {
        const id = tuneIdOf(curatedMelody(level(rank), i * 7919, undefined, new Set(), recent).id);
        if (count > 1) expect(id).not.toBe(recent[recent.length - 1]);
        if (i < count) expect(recent).not.toContain(id);
        recent.push(id);
      }
    }
  });

  test('every melody id is unique per seed so a new play is a new Melody row', () => {
    expect(curatedMelody(level(1), 1).id).not.toBe(curatedMelody(level(1), 2).id);
  });
});

describe('historyFromAttempts', () => {
  const at = (melodyId: string, verdict: 'correct' | 'incorrect', time: string) => ({
    melodyId,
    verdict,
    createdAt: `2026-10-30T10:${time}:00.000Z`,
  });

  test('lists the attempted tunes oldest first, whatever order the store returns them in', () => {
    const { recent } = historyFromAttempts([at('frere-9', 'incorrect', '02'), at('hotcrossbuns-4', 'incorrect', '01')]);
    expect(recent).toEqual(['hotcrossbuns', 'frere']);
  });

  test('mastered holds the tunes played at 100%', () => {
    const { mastered } = historyFromAttempts([at('frere-9', 'incorrect', '02'), at('hotcrossbuns-4', 'correct', '01')]);
    expect(mastered).toEqual(['hotcrossbuns']);
  });

  test('once a level has been played through, the tune attempted longest ago comes back first', () => {
    const ids = LIBRARY.filter((t) => t.rank === 1).map((t) => t.id);
    const { recent } = historyFromAttempts(
      ids.map((id, i) => at(`${id}-${i}`, 'incorrect', String(10 + i))).reverse(),
    );
    for (let seed = 0; seed < 20; seed++) {
      expect(tuneIdOf(curatedMelody(level(1), seed, undefined, new Set(), recent).id)).toBe(ids[0]);
    }
  });
});

describe('tunes played at 100%', () => {
  const ofRank = (rank: number) => LIBRARY.filter((t) => t.rank === rank).map((t) => t.id);

  test('tuneIdOf reads the tune out of a melody id', () => {
    expect(tuneIdOf('hotcrossbuns-123456')).toBe('hotcrossbuns');
  });

  test('only a fully correct attempt counts as mastered', () => {
    const mastered = masteredTuneIds([
      { melodyId: 'joy-1', verdict: 'incorrect' },
      { melodyId: 'joyworld-2', verdict: 'correct' },
      { melodyId: 'joyworld-3', verdict: 'correct' },
    ]);
    expect([...mastered]).toEqual(['joyworld']);
  });

  test('a mastered tune is not offered while the level has others', () => {
    const rank = 2;
    const [first, ...others] = ofRank(rank);
    expect(others.length).toBeGreaterThan(0);
    for (let seed = 0; seed < 50; seed++) {
      const id = tuneIdOf(curatedMelody(level(rank), seed, undefined, new Set([first])).id);
      expect(id).not.toBe(first);
    }
  });

  test('when every tune of the level is mastered, they all come back', () => {
    const all = new Set(ofRank(1));
    const m = curatedMelody(level(1), 3, undefined, all);
    expect(all.has(tuneIdOf(m.id))).toBe(true);
  });
});
