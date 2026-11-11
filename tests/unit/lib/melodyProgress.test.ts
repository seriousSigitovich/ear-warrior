import { NoteResult } from '../../../src/models';
import {
  MelodyPlaceRow,
  PhraseSave,
  RemotePlace,
  detectedFromSave,
  gradeFromSave,
  mergeRemote,
  placeOf,
  resumePhrase,
  savesFrom,
  skipTarget,
  usablePlace,
} from '../../../src/lib/melodyProgress';

const save = (...midis: number[]): PhraseSave => ({
  noteResults: midis.map<NoteResult>((m, i) => ({
    targetIndex: i,
    status: 'matched',
    expectedMidi: m,
    detectedMidi: m,
    octaveMismatch: false,
  })),
  answer: midis,
});
const iso = (sec: number) => new Date(Date.UTC(2026, 10, 12, 10, 0, sec)).toISOString();

const row = (
  tuneId: string,
  phrase: number,
  sec: number,
  over: Partial<MelodyPlaceRow> = {},
): MelodyPlaceRow => ({
  tuneId,
  phrase,
  phrases: 5,
  grades: [save(60)],
  updatedAt: iso(sec),
  deleted: false,
  synced: true,
  ...over,
});
const remote = (tuneId: string, phrase: number, sec: number): RemotePlace => ({
  tuneId,
  phrase,
  phrases: 5,
  grades: [save(60)],
  updatedAt: iso(sec),
});

describe('resume point', () => {
  test('continue at the first phrase not yet answered', () => {
    expect(resumePhrase(0, 5)).toBe(0);
    expect(resumePhrase(2, 5)).toBe(2);
    expect(resumePhrase(4, 5)).toBe(4);
  });

  test('with every phrase answered but the melody not finished, the last phrase (Finish is one tap away)', () => {
    expect(resumePhrase(5, 5)).toBe(4);
    expect(resumePhrase(9, 5)).toBe(4);
  });

  test('a place is the phrase to continue at plus the first tries, not yet known to the server', () => {
    const p = placeOf(
      'hotcrossbuns',
      5,
      [save(64), save(62)],
      new Date(Date.UTC(2026, 10, 12, 10, 0, 7)),
    );
    expect(p).toEqual({
      tuneId: 'hotcrossbuns',
      phrase: 2,
      phrases: 5,
      grades: [save(64), save(62)],
      updatedAt: iso(7),
      deleted: false,
      synced: false,
    });
  });

  test('"skip to phrase N" goes to the saved phrase, and only ahead of where the learner is', () => {
    expect(skipTarget(1, 3)).toBe(3);
    expect(skipTarget(0, 3)).toBe(3);
    expect(skipTarget(3, 3)).toBeNull();
    expect(skipTarget(4, 3)).toBeNull();
    expect(skipTarget(0, 0)).toBeNull();
  });
});

describe('merging the server’s places into the device’s', () => {
  test('a place the device does not have is taken, as already synced', () => {
    const { write, remove } = mergeRemote([], [remote('a', 2, 10)]);
    expect(write).toEqual([row('a', 2, 10, { synced: true })]);
    expect(remove).toEqual([]);
  });

  test('a newer server place replaces an older synced one; an older one does not', () => {
    expect(mergeRemote([row('a', 1, 10)], [remote('a', 3, 20)]).write.map((p) => p.phrase)).toEqual(
      [3],
    );
    expect(mergeRemote([row('a', 3, 20)], [remote('a', 1, 10)]).write).toEqual([]);
    expect(mergeRemote([row('a', 3, 20)], [remote('a', 3, 20)]).write).toEqual([]);
  });

  test('a change the device has not sent yet is kept whatever the server holds', () => {
    const pending = row('a', 1, 10, { synced: false });
    expect(mergeRemote([pending], [remote('a', 4, 99)]).write).toEqual([]);
  });

  test('a place the server no longer has, that the device had already synced, was finished elsewhere: removed', () => {
    expect(mergeRemote([row('a', 2, 10, { synced: true })], []).remove).toEqual(['a']);
  });

  test('a place the device has not sent yet is not removed because the server lacks it', () => {
    expect(mergeRemote([row('a', 2, 10, { synced: false })], []).remove).toEqual([]);
  });

  test('a pending delete beats an older server place, a newer server place beats the delete', () => {
    const gone = row('a', 0, 50, { deleted: true, synced: false });
    expect(mergeRemote([gone], [remote('a', 2, 10)]).write).toEqual([]);
    expect(
      mergeRemote([gone], [remote('a', 2, 90)]).write.map((p) => [p.tuneId, p.deleted]),
    ).toEqual([['a', false]]);
  });

  test('other tunes are untouched', () => {
    const { write, remove } = mergeRemote([row('a', 1, 10), row('b', 1, 10)], [remote('a', 2, 20)]);
    expect(write.map((p) => p.tuneId)).toEqual(['a']);
    expect(remove).toEqual(['b']);
  });
});

describe('first tries as saved and restored', () => {
  test('a saved phrase becomes the grade and the answer the loop scores the melody from', () => {
    const s = save(64, 62);
    expect(gradeFromSave(s)).toEqual({
      noteResults: s.noteResults,
      verdict: 'correct',
      confidence: 1,
      lowConfidence: false,
      timedOut: false,
    });
    expect(detectedFromSave(s).map((d) => [d.index, d.midi])).toEqual([
      [0, 64],
      [1, 62],
    ]);
  });

  test('a phrase with a wrong note restores as incorrect', () => {
    const s: PhraseSave = {
      noteResults: [{ ...save(60).noteResults[0], status: 'wrong' }],
      answer: [61],
    };
    expect(gradeFromSave(s).verdict).toBe('incorrect');
  });

  test('grades and answers go back to saves, one per answered phrase, whatever was restored', () => {
    const saves = [save(64, 62), save(60)];
    const grades = saves.map(gradeFromSave);
    const answers = saves.map(detectedFromSave);
    expect(savesFrom(grades, answers)).toEqual(saves);
  });
});

describe('a saved place against the melody it is restored onto', () => {
  const place = (over: Partial<Pick<MelodyPlaceRow, 'phrase' | 'phrases' | 'grades'>> = {}) => ({
    phrase: 2,
    phrases: 5,
    grades: [save(60), save(62)],
    ...over,
  });

  test('a place that fits the melody is usable', () => {
    expect(usablePlace(place(), 5)).toBe(true);
    expect(
      usablePlace(place({ phrase: 4, grades: [save(1), save(2), save(3), save(4), save(5)] }), 5),
    ).toBe(true);
  });

  test('a place saved for a different number of phrases is not (the tune has changed since)', () => {
    expect(usablePlace(place(), 6)).toBe(false);
    expect(usablePlace(place(), 3)).toBe(false);
  });

  test('a place with no first tries, more than the melody has, or a phrase beyond it is not usable', () => {
    expect(usablePlace(place({ grades: [] }), 5)).toBe(false);
    expect(usablePlace(place({ grades: Array.from({ length: 6 }, () => save(60)) }), 5)).toBe(
      false,
    );
    expect(usablePlace(place({ phrase: 5 }), 5)).toBe(false);
    expect(usablePlace(place({ phrase: -1 }), 5)).toBe(false);
  });
});
