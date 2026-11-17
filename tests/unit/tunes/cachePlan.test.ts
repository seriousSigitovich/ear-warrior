import {
  cacheName,
  needsDownload,
  parseCacheName,
  prefetchOrder,
  staleFiles,
} from '../../../src/services/tunes/cachePlan';
import type { LibraryTune } from '../../../src/services/tunes/types';

const H = (c: string) => c.repeat(64);
const tune = (
  id: string,
  rank: number,
  hash: string,
  over: Partial<LibraryTune['audio']> = {},
): LibraryTune => ({
  id,
  title: id,
  rank,
  tempoBpm: 100,
  phrases: [2],
  beats: [1, 1],
  scale: 'C_major',
  moves: { counts: {}, total: 0 },
  audio: { sha256: H(hash), url: `https://blob.example/${id}.m4a`, bytes: 1000, ...over },
});
const none = new Map<string, string>();

describe('cache names', () => {
  it('name a clip by tune and the first 8 hex digits of its hash', () => {
    expect(cacheName('mary', H('a'))).toBe('mary.aaaaaaaa.m4a');
    expect(parseCacheName('mary.aaaaaaaa.m4a')).toEqual({ id: 'mary', hash: 'aaaaaaaa' });
  });
  it('do not read names that are not ours', () => {
    expect(parseCacheName('mary.m4a')).toBeNull();
    expect(parseCacheName('mary.aaaaaaaa.m4a.part')).toBeNull();
    expect(parseCacheName('Mary.aaaaaaaa.m4a')).toBeNull();
  });
});

describe('needsDownload', () => {
  it('is true for a clip that is not on the device', () => {
    expect(needsDownload(tune('mary', 1, 'a'), [], none)).toBe(true);
  });
  it('is false once the file of the current version is there with the right size', () => {
    expect(
      needsDownload(tune('mary', 1, 'a'), [{ name: 'mary.aaaaaaaa.m4a', bytes: 1000 }], none),
    ).toBe(false);
  });
  it('is true when the file is the right version but cut short, or of an older version', () => {
    expect(
      needsDownload(tune('mary', 1, 'a'), [{ name: 'mary.aaaaaaaa.m4a', bytes: 400 }], none),
    ).toBe(true);
    expect(
      needsDownload(tune('mary', 1, 'b'), [{ name: 'mary.aaaaaaaa.m4a', bytes: 1000 }], none),
    ).toBe(true);
  });
  it('is false for a clip with nowhere to come from, or one the app ships in its current version', () => {
    expect(needsDownload(tune('mary', 1, 'a', { url: null }), [], none)).toBe(false);
    expect(needsDownload(tune('mary', 1, 'a'), [], new Map([['mary', H('a')]]))).toBe(false);
  });
  it('is true when the app ships an older voicing than the server now has', () => {
    expect(needsDownload(tune('mary', 1, 'b'), [], new Map([['mary', H('a')]]))).toBe(true);
  });
});

describe('staleFiles', () => {
  const catalog = [tune('mary', 1, 'b'), tune('london', 1, 'c')];
  it('lists older versions, tunes that left the catalog, and strangers — never the current files', () => {
    const cached = [
      { name: 'mary.aaaaaaaa.m4a', bytes: 1 },
      { name: 'mary.bbbbbbbb.m4a', bytes: 1 },
      { name: 'london.cccccccc.m4a', bytes: 1 },
      { name: 'gone.dddddddd.m4a', bytes: 1 },
      { name: 'notes.txt', bytes: 1 },
    ];
    expect(staleFiles(catalog, cached).sort()).toEqual([
      'gone.dddddddd.m4a',
      'mary.aaaaaaaa.m4a',
      'notes.txt',
    ]);
  });
  it('is empty for an empty cache', () => {
    expect(staleFiles(catalog, [])).toEqual([]);
  });
});

describe('prefetchOrder', () => {
  const catalog = [
    tune('c', 3, 'a'),
    tune('b2', 2, 'a'),
    tune('b1', 2, 'a'),
    tune('a', 1, 'a'),
    tune('d', 4, 'a'),
  ];
  it('is the level in use, then the next one, by level then id, and nothing further', () => {
    expect(prefetchOrder(catalog, 2, [], none).map((t) => t.id)).toEqual(['b1', 'b2', 'c']);
    expect(prefetchOrder(catalog, 1, [], none).map((t) => t.id)).toEqual(['a', 'b1', 'b2']);
  });
  it('skips what is already on the device or ships with the app', () => {
    const cached = [{ name: 'b1.aaaaaaaa.m4a', bytes: 1000 }];
    expect(prefetchOrder(catalog, 2, cached, new Map([['c', H('a')]])).map((t) => t.id)).toEqual([
      'b2',
    ]);
  });
});
