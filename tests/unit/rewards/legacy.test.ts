import type { Attempt, NoteResult } from '../../../src/models';
import {
  LEGACY_DONE_KEY,
  importLegacyOnce,
  legacyPhrases,
  phraseAccuracies,
} from '../../../src/services/rewards/legacy';
import { memoryKv } from './fixtures';

const r = (i: number | null, status: NoteResult['status']): NoteResult => ({
  targetIndex: i,
  status,
  expectedMidi: 60,
  detectedMidi: 60,
  octaveMismatch: false,
});
const all = (n: number, status: NoteResult['status'] = 'matched') =>
  Array.from({ length: n }, (_, i) => r(i, status));
const attempt = (
  melodyId: string,
  noteResults: NoteResult[],
  at: string,
  over: Partial<Attempt> = {},
) =>
  ({
    melodyId,
    noteResults,
    createdAt: at,
    inputMode: 'fretboard',
    timedOut: false,
    ...over,
  }) as Attempt;
const phrasesOf = (id: string) => (id === 'mary' ? [3, 2] : null);

describe('phraseAccuracies', () => {
  it('splits note results by phrase, ignoring extras and order', () => {
    expect(
      phraseAccuracies(
        [
          r(1, 'wrong'),
          r(0, 'matched'),
          r(null, 'extra'),
          r(2, 'matched'),
          r(3, 'matched'),
          r(4, 'missed'),
        ],
        [3, 2],
      ),
    ).toEqual([67, 50]);
  });
  it('is null when the results do not match the phrases', () => {
    expect(phraseAccuracies(all(4), [3, 2])).toBeNull();
  });
});

describe('legacyPhrases', () => {
  it('takes the first attempt that passed each phrase, oldest first', () => {
    const items = legacyPhrases(
      [
        attempt('mary-2', all(5), '2026-11-02T10:00:00Z'),
        attempt(
          'mary-1',
          [...all(3, 'wrong'), ...all(2).map((n, i) => ({ ...n, targetIndex: i + 3 }))],
          '2026-11-01T10:00:00Z',
        ),
      ],
      phrasesOf,
    );
    expect(items).toEqual([
      { tuneId: 'mary', phrase: 1, accuracy: 100, at: '2026-11-01T10:00:00Z' },
      { tuneId: 'mary', phrase: 0, accuracy: 100, at: '2026-11-02T10:00:00Z' },
    ]);
  });
  it('leaves out mic attempts, timed-out ones, phrases below the pass mark and tunes the library lost', () => {
    expect(
      legacyPhrases(
        [
          attempt('mary-1', all(5), 'a', { inputMode: 'mic' }),
          attempt('mary-1', all(5), 'b', { timedOut: true }),
          attempt('mary-1', all(5, 'wrong'), 'c'),
          attempt('gone-1', all(5), 'd'),
        ],
        phrasesOf,
      ),
    ).toEqual([]);
  });
});

describe('importLegacyOnce', () => {
  const attempts = async () => [attempt('mary-1', all(5), '2026-11-01T10:00:00Z')];

  it('sends the passed phrases once, then never again', async () => {
    const kv = memoryKv();
    const sent: unknown[] = [];
    const service = { importLegacy: jest.fn(async (p) => (sent.push(p), true)) };
    expect(await importLegacyOnce({ service, kv, loadAttempts: attempts, phrasesOf })).toBe(true);
    expect(sent[0]).toHaveLength(2);
    expect(kv.data.get(LEGACY_DONE_KEY)).toBe('done');
    expect(await importLegacyOnce({ service, kv, loadAttempts: attempts, phrasesOf })).toBe(false);
    expect(service.importLegacy).toHaveBeenCalledTimes(1);
  });

  it('tries again at the next launch when the server could not be reached', async () => {
    const kv = memoryKv();
    expect(
      await importLegacyOnce({
        service: { importLegacy: async () => false },
        kv,
        loadAttempts: attempts,
        phrasesOf,
      }),
    ).toBe(false);
    expect(kv.data.has(LEGACY_DONE_KEY)).toBe(false);
  });

  it('has nothing to send for a new learner and does not ask the server', async () => {
    const kv = memoryKv();
    const service = { importLegacy: jest.fn(async () => true) };
    await importLegacyOnce({ service, kv, loadAttempts: async () => [], phrasesOf });
    expect(service.importLegacy).not.toHaveBeenCalled();
    expect(kv.data.get(LEGACY_DONE_KEY)).toBe('done');
  });

  it('never throws', async () => {
    const boom = async () => {
      throw new Error('x');
    };
    expect(
      await importLegacyOnce({
        service: { importLegacy: boom },
        kv: memoryKv(),
        loadAttempts: boom,
        phrasesOf,
      }),
    ).toBe(false);
  });
});
