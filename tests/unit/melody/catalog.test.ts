import { NoteResult } from '../../../src/models';
import { LIBRARY } from '../../../src/services/melody/curated';
import { catalogTune, libraryCatalog, tuneAsk } from '../../../src/services/melody/catalog';
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

  test('an unknown id is not in the catalog', () => {
    expect(catalogTune('nosuchtune')).toBeNull();
  });
});
