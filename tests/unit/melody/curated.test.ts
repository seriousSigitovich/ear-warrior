// What the app does with the library (spec 024): serve a melody of a level, rotate through a level's tunes, remember
// what was played — and hold only the rhythm of a tune, never its pitches. The first melody is the one exception: a
// coached warm-up whose four notes the app holds and grades itself.
import { DifficultyLevel } from '../../../src/models';
import {
  FIRST_MELODY_CLIP,
  firstMelody,
  curatedMelody,
  levelSummary,
  masteredTuneIds,
  historyFromAttempts,
  tuneIdOf,
  unpitchedNote,
} from '../../../src/services/melody/curated';
import { MAX_RANK, MIN_RANK, getLevelByRank } from '../../../src/services/melody/levels';
import { hzFromMidi, noteName } from '../../../src/lib/pitchNote';
import { getLibrary } from '../../../src/services/tunes/library';
import { answerOf, installTestLibrary } from '../../support/testLibrary';

const RANKS = Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => MIN_RANK + i);
const level = (rank: number): DifficultyLevel => getLevelByRank(rank);
const LIBRARY = () => getLibrary();

beforeAll(installTestLibrary);

describe('curatedMelody', () => {
  test('a tune of the first levels is a Melody with its pitches: the app holds that answer and grades it itself', () => {
    const m = curatedMelody(level(1), 7);
    const tune = LIBRARY().find((t) => m.id.startsWith(`${t.id}-`))!;
    expect(m.difficultyId).toBe('L1');
    expect(m.notes.map((n) => n.index)).toEqual(m.notes.map((_, i) => i));
    expect(m.notes.map((n) => n.durationBeats)).toEqual(tune.beats);
    expect(m.notes.map((n) => n.midi)).toEqual(answerOf(tune.id));
    expect(m.phrases).toEqual(tune.phrases);
    expect(m.tempoBpm).toBe(tune.tempoBpm);
    for (const n of m.notes) {
      expect(n.noteName).toBe(noteName(n.midi));
      expect(n.frequencyHz).toBe(hzFromMidi(n.midi));
    }
  });

  test('every tune of level 2 has its pitches too', () => {
    for (let seed = 0; seed < 12; seed++)
      expect(curatedMelody(level(2), seed).notes.every((n) => n.midi > 0)).toBe(true);
  });

  test('a tune above that is its rhythm only — no pitch in it, the server alone grades it', () => {
    for (const rank of [3, 5, 9]) {
      const m = curatedMelody(level(rank), 7);
      const tune = LIBRARY().find((t) => m.id.startsWith(`${t.id}-`))!;
      expect(m.notes.map((n) => n.durationBeats)).toEqual(tune.beats);
      for (const n of m.notes) expect(n).toEqual(unpitchedNote(n.index, n.durationBeats));
      expect(m.notes.every((n) => n.midi === 0 && n.noteName === '')).toBe(true);
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
        expect(LIBRARY().find((t) => m.id.startsWith(`${t.id}-`))?.rank).toBe(rank);
      }
    }
  });

  test('a level with several tunes does not always return the same one', () => {
    const ids = new Set(
      Array.from({ length: 30 }, (_, seed) => curatedMelody(level(1), seed).id.split('-')[0]),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  test('serves every tune of a level before repeating any, never the same one twice running', () => {
    for (const rank of RANKS) {
      const count = LIBRARY().filter((t) => t.rank === rank).length;
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

  test('a level the library has no tune for is an error, not a silent empty melody', () => {
    expect(() => curatedMelody(level(1), 1, 'nosuchtune')).toThrow(/No library tune/);
  });
});

describe('levelSummary', () => {
  test('counts the tunes of a level and ranges their length and tempo from the rhythm the app holds', () => {
    const s = levelSummary(1);
    const ofRank = LIBRARY().filter((t) => t.rank === 1);
    expect(s.tunes).toBe(ofRank.length);
    const lens = ofRank.map((t) => t.beats.length);
    expect(s.notes).toBe(`${Math.min(...lens)}–${Math.max(...lens)}`);
    expect(s.tempo).toMatch(/BPM$/);
  });
});

describe('historyFromAttempts', () => {
  const at = (melodyId: string, verdict: 'correct' | 'incorrect', time: string) => ({
    melodyId,
    verdict,
    createdAt: `2026-10-30T10:${time}:00.000Z`,
  });

  test('lists the attempted tunes oldest first, whatever order the store returns them in', () => {
    const { recent } = historyFromAttempts([
      at('frere-9', 'incorrect', '02'),
      at('hotcrossbuns-4', 'incorrect', '01'),
    ]);
    expect(recent).toEqual(['hotcrossbuns', 'frere']);
  });

  test('mastered holds the tunes played at 100%', () => {
    const { mastered } = historyFromAttempts([
      at('frere-9', 'incorrect', '02'),
      at('hotcrossbuns-4', 'correct', '01'),
    ]);
    expect(mastered).toEqual(['hotcrossbuns']);
  });

  test('once a level has been played through, the tune attempted longest ago comes back first', () => {
    const ids = LIBRARY()
      .filter((t) => t.rank === 1)
      .map((t) => t.id);
    const { recent } = historyFromAttempts(
      ids.map((id, i) => at(`${id}-${i}`, 'incorrect', String(10 + i))).reverse(),
    );
    for (let seed = 0; seed < 20; seed++) {
      expect(tuneIdOf(curatedMelody(level(1), seed, undefined, new Set(), recent).id)).toBe(ids[0]);
    }
  });
});

describe('tunes played at 100%', () => {
  const ofRank = (rank: number) =>
    LIBRARY()
      .filter((t) => t.rank === rank)
      .map((t) => t.id);

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
    const [first, ...others] = ofRank(2);
    expect(others.length).toBeGreaterThan(0);
    for (let seed = 0; seed < 50; seed++) {
      expect(tuneIdOf(curatedMelody(level(2), seed, undefined, new Set([first])).id)).not.toBe(
        first,
      );
    }
  });

  test('when every tune of the level is mastered, they all come back', () => {
    const all = new Set(ofRank(1));
    expect(all.has(tuneIdOf(curatedMelody(level(1), 3, undefined, all).id))).toBe(true);
  });
});

describe('first melody (first run)', () => {
  test('is the four-note opening of the Fifth, one phrase, slowed, on a clip of its own', () => {
    const m = firstMelody();
    const fifth = LIBRARY().find((t) => t.id === 'fifth')!;
    expect(m.notes.map((n) => n.midi)).toEqual(answerOf('fifth').slice(0, 4));
    expect(m.notes.map((n) => n.durationBeats)).toEqual(fifth.beats.slice(0, 4));
    expect(m.tempoBpm).toBeLessThan(fifth.tempoBpm);
    expect(tuneIdOf(m.id)).toBe(FIRST_MELODY_CLIP);
    expect(LIBRARY().some((t) => t.id === FIRST_MELODY_CLIP)).toBe(false);
    expect(m.notes.map((n) => n.noteName)).toEqual(['G3', 'G3', 'G3', 'D#3']);
    expect(m.phrases).toEqual([4]);
    expect(m.notes.map((n) => n.index)).toEqual([0, 1, 2, 3]);
  });

  test('has a stable id, so it can be told apart from a scored tune', () => {
    expect(firstMelody().id).toBe(firstMelody().id);
    expect(firstMelody().id).not.toMatch(/-\d+$/);
  });
});
