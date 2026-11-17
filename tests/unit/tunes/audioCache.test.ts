import { createAudioCache, type FileService } from '../../../src/services/tunes/audioCache';
import type { LibraryTune } from '../../../src/services/tunes/types';

const H = (c: string) => c.repeat(64);
const tune = (id: string, rank: number, hash: string, bytes = 1000): LibraryTune => ({
  id,
  title: id,
  rank,
  tempoBpm: 100,
  phrases: [2],
  beats: [1, 1],
  scale: '',
  moves: { counts: {}, total: 0 },
  audio: { sha256: H(hash), url: `https://blob.example/${id}.m4a`, bytes },
});

function fakeFiles(
  initial: { name: string; bytes: number }[] = [],
  opts: { failFor?: Set<string> } = {},
) {
  const files = new Map(initial.map((f) => [f.name, f.bytes]));
  const downloads: string[] = [];
  const service: FileService = {
    async list() {
      return [...files].map(([name, bytes]) => ({ name, bytes }));
    },
    async download(_url, name, bytes) {
      downloads.push(name);
      if (opts.failFor?.has(name)) return false;
      files.set(name, bytes);
      return true;
    },
    async remove(name) {
      files.delete(name);
    },
    uri: (name) => `file:///cache/${name}`,
  };
  return { service, files, downloads };
}
const none = new Map<string, string>();

describe('ensure', () => {
  it('downloads a clip that is not there, once, and then plays it from the file', async () => {
    const f = fakeFiles();
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    const t = tune('mary', 1, 'a');
    expect(await cache.ensure(t)).toBe(true);
    expect(await cache.ensure(t)).toBe(true);
    expect(f.downloads).toEqual(['mary.aaaaaaaa.m4a']);
    expect(cache.source('mary')).toEqual({ kind: 'file', uri: 'file:///cache/mary.aaaaaaaa.m4a' });
  });

  it('shares one download between simultaneous callers', async () => {
    const f = fakeFiles();
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    const t = tune('mary', 1, 'a');
    await Promise.all([cache.ensure(t), cache.ensure(t), cache.ensure(t)]);
    expect(f.downloads).toHaveLength(1);
  });

  it('answers false when the download fails and nothing else is playable', async () => {
    const f = fakeFiles([], { failFor: new Set(['mary.aaaaaaaa.m4a']) });
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    expect(await cache.ensure(tune('mary', 1, 'a'))).toBe(false);
    expect(cache.source('mary')).toBeNull();
  });

  it('keeps playing an older cached version when the new one cannot be fetched', async () => {
    const f = fakeFiles([{ name: 'mary.bbbbbbbb.m4a', bytes: 900 }], {
      failFor: new Set(['mary.aaaaaaaa.m4a']),
    });
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    expect(await cache.ensure(tune('mary', 1, 'a'))).toBe(true);
    expect(cache.source('mary')).toEqual({ kind: 'file', uri: 'file:///cache/mary.bbbbbbbb.m4a' });
  });

  it('prefers the file of the version the catalog names over an older one', async () => {
    const f = fakeFiles([{ name: 'mary.bbbbbbbb.m4a', bytes: 900 }]);
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    await cache.ensure(tune('mary', 1, 'a'));
    expect(cache.source('mary')).toEqual({ kind: 'file', uri: 'file:///cache/mary.aaaaaaaa.m4a' });
  });

  it('does not download a clip whose current version ships inside the app, and plays the shipped copy', async () => {
    const f = fakeFiles();
    const cache = createAudioCache({
      files: f.service,
      bundledHashes: new Map([['mary', H('a')]]),
    });
    expect(await cache.ensure(tune('mary', 1, 'a'))).toBe(true);
    expect(f.downloads).toEqual([]);
    expect(cache.source('mary')).toEqual({ kind: 'bundled' });
  });

  it('downloads again when the server re-voiced a clip the app ships', async () => {
    const f = fakeFiles();
    const cache = createAudioCache({
      files: f.service,
      bundledHashes: new Map([['mary', H('a')]]),
    });
    await cache.ensure(tune('mary', 1, 'b'));
    expect(f.downloads).toEqual(['mary.bbbbbbbb.m4a']);
    expect(cache.source('mary')).toEqual({ kind: 'file', uri: 'file:///cache/mary.bbbbbbbb.m4a' });
  });

  it('re-downloads a file that was cut short', async () => {
    const f = fakeFiles([{ name: 'mary.aaaaaaaa.m4a', bytes: 100 }]);
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    await cache.ensure(tune('mary', 1, 'a'));
    expect(f.downloads).toEqual(['mary.aaaaaaaa.m4a']);
  });
});

describe('source', () => {
  it('is null for a tune that is neither cached nor shipped', () => {
    expect(
      createAudioCache({ files: fakeFiles().service, bundledHashes: none }).source('mary'),
    ).toBeNull();
  });
});

describe('prefetch', () => {
  it('fetches the level and the next one, one at a time, and nothing else', async () => {
    const f = fakeFiles();
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    await cache.prefetch([tune('a', 1, 'a'), tune('b', 2, 'a'), tune('c', 3, 'a')], 1);
    expect(f.downloads).toEqual(['a.aaaaaaaa.m4a', 'b.aaaaaaaa.m4a']);
  });

  it('stops after the clip in flight when asked', async () => {
    const f = fakeFiles();
    const cache = createAudioCache({
      files: {
        ...f.service,
        async download(url, name, bytes) {
          cache.stop();
          return f.service.download(url, name, bytes);
        },
      },
      bundledHashes: none,
    });
    await cache.prefetch([tune('a', 1, 'a'), tune('b', 1, 'a'), tune('c', 1, 'a')], 1);
    expect(f.downloads).toEqual(['a.aaaaaaaa.m4a']);
  });

  it('skips what is already cached and carries on past a failed clip', async () => {
    const f = fakeFiles([{ name: 'a.aaaaaaaa.m4a', bytes: 1000 }], {
      failFor: new Set(['b.aaaaaaaa.m4a']),
    });
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    await cache.prefetch([tune('a', 1, 'a'), tune('b', 1, 'a'), tune('c', 1, 'a')], 1);
    expect(f.downloads).toEqual(['b.aaaaaaaa.m4a', 'c.aaaaaaaa.m4a']);
  });
});

describe('sweep', () => {
  it('deletes older versions, tunes that left the catalog and strangers, keeps the current files', async () => {
    const f = fakeFiles([
      { name: 'mary.aaaaaaaa.m4a', bytes: 1 },
      { name: 'mary.bbbbbbbb.m4a', bytes: 1000 },
      { name: 'gone.cccccccc.m4a', bytes: 1 },
      { name: 'x.tmp', bytes: 1 },
    ]);
    const cache = createAudioCache({ files: f.service, bundledHashes: none });
    await cache.sweep([tune('mary', 1, 'b')]);
    expect([...f.files.keys()]).toEqual(['mary.bbbbbbbb.m4a']);
  });
});
