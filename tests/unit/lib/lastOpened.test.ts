import { KeyValueStore } from '../../../src/lib/deviceId';
import {
  clearOpened,
  continueTarget,
  parseOpened,
  readOpened,
  saveOpened,
} from '../../../src/lib/lastOpened';
import { MelodyPlaceRow } from '../../../src/lib/melodyProgress';

const iso = (sec: number) => new Date(Date.UTC(2026, 10, 15, 10, 0, sec)).toISOString();
const place = (tuneId: string, sec: number): MelodyPlaceRow => ({
  tuneId,
  phrase: 2,
  phrases: 5,
  grades: [
    { noteResults: [], answer: [60] },
    {
      noteResults: [
        {
          targetIndex: 0,
          status: 'matched',
          expectedMidi: 62,
          detectedMidi: 62,
          octaveMismatch: false,
        },
      ],
      answer: [62],
    },
  ],
  updatedAt: iso(sec),
  deleted: false,
  synced: true,
});
const fits = (id: string) => (id === 'gone' ? null : 5);

function memory(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
  };
}

describe('the last opened melody as stored', () => {
  test('is read back as saved', async () => {
    const kv = memory();
    expect(await readOpened(kv)).toBeNull();
    await saveOpened(kv, 'a', new Date(iso(5)));
    expect(await readOpened(kv)).toEqual({ tuneId: 'a', at: iso(5) });
  });

  test('is forgotten once that melody is finished, but not when another one is', async () => {
    const kv = memory();
    await saveOpened(kv, 'a', new Date(iso(5)));
    await clearOpened(kv, 'b');
    expect(await readOpened(kv)).not.toBeNull();
    await clearOpened(kv, 'a');
    expect(await readOpened(kv)).toBeNull();
  });

  test('anything unreadable is nothing', () => {
    expect(parseOpened(null)).toBeNull();
    expect(parseOpened('')).toBeNull();
    expect(parseOpened('{')).toBeNull();
    expect(parseOpened('{"tuneId":1,"at":"x"}')).toBeNull();
    expect(parseOpened('{"tuneId":"a","at":"not a date"}')).toBeNull();
  });
});

describe('what Continue opens', () => {
  const result = [
    {
      targetIndex: 0,
      status: 'matched' as const,
      expectedMidi: 62,
      detectedMidi: 62,
      octaveMismatch: false,
    },
  ];
  const played = (tuneId: string, sec: number) => ({ tuneId, at: iso(sec), results: result });

  test('a melody only opened, with nothing played or saved: phrase 1, nothing answered', () => {
    expect(continueTarget([], { tuneId: 'a', at: iso(5) }, fits)).toEqual({
      tuneId: 'a',
      phrases: 5,
      phrase: 0,
      answered: 0,
      saved: false,
      played: false,
      last: null,
    });
  });

  test('the saved place, with how its last phrase went', () => {
    const t = continueTarget([place('a', 1)], { tuneId: 'a', at: iso(9) }, fits);
    expect(t).toMatchObject({ tuneId: 'a', phrase: 2, answered: 2, saved: true, played: false });
    expect(t?.last?.results).toHaveLength(1);
    expect(t?.last?.at).toBe(iso(1));
  });

  test('a melody only opened never replaces one that was played', () => {
    expect(continueTarget([place('a', 1)], { tuneId: 'b', at: iso(9) }, fits)?.tuneId).toBe('a');
    expect(continueTarget([], { tuneId: 'b', at: iso(9) }, fits, [played('c', 1)])?.tuneId).toBe(
      'c',
    );
  });

  test('the later of a saved place and a finished melody wins', () => {
    const newerFinish = continueTarget([place('a', 1)], null, fits, [played('b', 9)]);
    expect(newerFinish).toMatchObject({
      tuneId: 'b',
      saved: false,
      played: true,
      answered: 0,
      phrase: 0,
    });
    expect(newerFinish?.last).toEqual({ results: result, at: iso(9) });
    expect(continueTarget([place('a', 9)], null, fits, [played('b', 1)])?.tuneId).toBe('a');
  });

  test('of several finished melodies, the latest', () => {
    expect(
      continueTarget([], null, fits, [played('b', 1), played('c', 7), played('d', 3)])?.tuneId,
    ).toBe('c');
  });

  test('nothing when nothing was left, and a melody that left the library is not offered', () => {
    expect(continueTarget([], null, fits)).toBeNull();
    expect(continueTarget([], { tuneId: 'gone', at: iso(1) }, fits)).toBeNull();
    expect(continueTarget([], null, fits, [played('gone', 5)])).toBeNull();
    expect(continueTarget([place('a', 1)], { tuneId: 'gone', at: iso(9) }, fits)?.tuneId).toBe('a');
  });
});
