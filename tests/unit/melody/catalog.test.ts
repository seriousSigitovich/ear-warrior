import { NoteResult } from '../../../src/models';
import { LIBRARY } from '../../../src/services/melody/curated';
import {
  catalogTune,
  libraryCatalog,
  tuneAsk,
  tuneIntervals,
  tunesForInterval,
} from '../../../src/services/melody/catalog';
import { MAX_RANK, MIN_RANK } from '../../../src/services/melody/levels';

const note = (i: number, ok: boolean): NoteResult => ({
  targetIndex: i,
  status: ok ? 'matched' : 'wrong',
  expectedMidi: 60,
  detectedMidi: ok ? 60 : 62,
  octaveMismatch: false,
});

describe('library catalog', () => {
  test('lists every tune once, level by level, easiest first', () => {
    const levels = libraryCatalog([]);
    expect(levels.map((l) => l.rank)).toEqual(
      Array.from({ length: MAX_RANK - MIN_RANK + 1 }, (_, i) => MIN_RANK + i),
    );
    const ids = levels.flatMap((l) => l.tunes.map((t) => t.id));
    expect([...ids].sort()).toEqual(LIBRARY.map((t) => t.id).sort());
    for (const l of levels) expect(l.tunes.every((t) => t.rank === l.rank)).toBe(true);
  });

  test('says what a tune asks: notes, phrases and tempo', () => {
    const first = LIBRARY[0];
    const tune = catalogTune(first.id)!;
    expect(tune.notes).toBe(first.notes.trim().split(/\s+/).length);
    expect(tune.phrases).toBe(first.phrases.length);
    expect(tune.tempoBpm).toBe(first.tempoBpm);
    expect(tuneAsk({ notes: 17, phrases: 2, tempoBpm: 100 })).toBe(
      '17 notes · 2 phrases · 100 BPM',
    );
    expect(tuneAsk({ notes: 4, phrases: 1, tempoBpm: 60 })).toBe('4 notes · 1 phrase · 60 BPM');
  });

  test('every tune goes by its name, played or not', () => {
    const tune = catalogTune(LIBRARY[1].id)!;
    expect(tune).toMatchObject({ played: false, bestPct: null, name: LIBRARY[1].title });
    const names = libraryCatalog([]).flatMap((l) => l.tunes.map((t) => t.name));
    expect(names.every((n) => n.trim().length > 0)).toBe(true);
  });

  test('a played tune is named and carries its best score', () => {
    const t = LIBRARY[0];
    const attempts = [
      { melodyId: `${t.id}-1`, noteResults: [note(0, true), note(1, false)] },
      { melodyId: `${t.id}-2`, noteResults: [note(0, true), note(1, true)] },
      { melodyId: `${t.id}-3`, noteResults: [note(0, false), note(1, false)] },
    ];
    expect(catalogTune(t.id, attempts)).toMatchObject({
      played: true,
      name: t.title,
      bestPct: 100,
    });
    const level = libraryCatalog(attempts).find((l) => l.rank === t.rank)!;
    expect(level.played).toBe(1);
  });

  test('a level counts its tunes played at 100%', () => {
    const t = LIBRARY[0];
    const other = LIBRARY.find((x) => x.rank === t.rank && x.id !== t.id)!;
    const attempts = [
      { melodyId: `${t.id}-1`, noteResults: [note(0, true)] },
      { melodyId: `${other.id}-1`, noteResults: [note(0, false)] },
    ];
    const level = libraryCatalog(attempts).find((l) => l.rank === t.rank)!;
    expect(level).toMatchObject({ played: 2, perfect: 1 });
  });

  test('a tune’s moves are counted inside its phrases only', () => {
    // Hot Cross Buns: E D C | E D C | C C C C D D D D | E D C, in two phrases of 6 and 11 notes.
    const moves = tuneIntervals('hotcrossbuns')!;
    expect(moves.total).toBe(15); // 17 notes less the first of each phrase
    expect(moves.counts['step:down']).toBe(6);
    expect(moves.counts['repeat']).toBe(6);
    expect(moves.counts['step:up']).toBe(2);
    expect(moves.counts['third:up']).toBe(1); // C up to E inside phrase 1; the next E opens phrase 2
    expect(tuneIntervals('nosuchtune')).toBeNull();
  });

  test('practice for a kind of move: the tunes fullest of it, near the levels played', () => {
    const picks = tunesForInterval('step:down', []);
    expect(picks).toHaveLength(3);
    // Nothing played yet: levels 1–2 only.
    expect(picks.every((p) => p.tune.rank <= 2)).toBe(true);
    for (const p of picks) {
      const moves = tuneIntervals(p.tune.id)!;
      expect(p.count).toBe(moves.counts['step:down']);
      expect(p.count).toBeGreaterThanOrEqual(3);
    }
    const shares = picks.map((p) => p.count / tuneIntervals(p.tune.id)!.total);
    expect([...shares].sort((a, b) => b - a)).toEqual(shares);
  });

  test('a tune already played at 100% comes after the others', () => {
    const first = tunesForInterval('step:down', [])[0].tune;
    const perfect = [{ melodyId: `${first.id}-1`, noteResults: [note(0, true)] }];
    const picks = tunesForInterval('step:down', perfect, 100);
    expect(picks[picks.length - 1].tune.id).toBe(first.id);
  });

  test('an unknown id is not in the catalog', () => {
    expect(catalogTune('nosuchtune')).toBeNull();
  });
});
