import {
  CATALOG_KEY,
  createCatalogService,
  parseCatalog,
  parseTune,
} from '../../../src/services/tunes/catalog';
import type { LibraryTune } from '../../../src/services/tunes/types';

const H = (c: string) => c.repeat(64);
const entry = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Tune ${id}`,
  level: 1,
  tempo_bpm: 100,
  phrases: [2, 1],
  beats: [1, 1, 2],
  scale: 'C_major_pentatonic',
  moves: { counts: { 'step:down': 1 }, total: 2 },
  audio_url: `https://blob.example/${id}.m4a`,
  audio_sha256: H('a'),
  audio_bytes: 1234,
  ...over,
});
const answer = (tunes: unknown[], etag = 'e1') => ({ ok: true, etag, tunes });

function memoryKv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => void data.set(k, v),
  };
}
const shipped: LibraryTune[] = [
  {
    id: 'mary',
    title: 'Mary',
    rank: 1,
    tempoBpm: 110,
    phrases: [3],
    beats: [1, 1, 2],
    scale: '',
    moves: { counts: {}, total: 0 },
    audio: { sha256: H('f'), url: null, bytes: 500 },
  },
];

function fakeFetch(res: { status: number; body?: unknown } | Error) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: (init.headers ?? {}) as Record<string, string> });
    if (res instanceof Error) throw res;
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      json: async () => res.body,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('parseTune', () => {
  it("reads a server entry into the app's shape", () => {
    expect(parseTune(entry('mary'))).toEqual({
      id: 'mary',
      title: 'Tune mary',
      rank: 1,
      tempoBpm: 100,
      phrases: [2, 1],
      beats: [1, 1, 2],
      scale: 'C_major_pentatonic',
      moves: { counts: { 'step:down': 1 }, total: 2 },
      audio: { sha256: H('a'), url: 'https://blob.example/mary.m4a', bytes: 1234 },
    });
  });
  it.each([
    ['a bad id', { id: 'Bad-Id' }],
    ['a level out of range', { level: 10 }],
    ['a tempo of 0', { tempo_bpm: 0 }],
    ['beats that do not add up to the phrases', { beats: [1, 1] }],
    ['an http audio url', { audio_url: 'http://x/y.m4a' }],
    ['a bad hash', { audio_sha256: 'zz' }],
    ['no size', { audio_bytes: 0 }],
    ['empty phrases', { phrases: [], beats: [] }],
  ])('leaves out an entry with %s', (_name, over) => {
    expect(parseTune(entry('mary', over))).toBeNull();
  });
  it('does not take pitches: nothing but the rhythm is read', () => {
    expect(JSON.stringify(parseTune(entry('mary', { notes: 'E4:1 D4:1 C4:2' })))).not.toContain(
      'E4',
    );
  });
});

describe('the answer of the first levels', () => {
  it('is read when it fits the tune, so the app can grade it itself', () => {
    expect(parseTune(entry('mary', { answer: [64, 62, 60] }))?.answer).toEqual([64, 62, 60]);
  });
  it.each([
    ['of the wrong length', [64, 62]],
    ['with a pitch off the neck', [64, 62, 10]],
    ['not numbers', ['a', 'b', 'c']],
  ])('is dropped when it is %s — the tune stays, graded by the server alone', (_name, answer) => {
    const t = parseTune(entry('mary', { answer }));
    expect(t).not.toBeNull();
    expect(t && 'answer' in t).toBe(false);
  });
  it('is absent for a tune that has none', () => {
    expect(parseTune(entry('mary'))?.answer).toBeUndefined();
  });
  it('survives being stored on the device and read back', async () => {
    const kv = memoryKv();
    const svc = createCatalogService({
      apiUrl: 'https://api',
      kv,
      fetchImpl: fakeFetch({
        status: 200,
        body: answer([entry('a', { answer: [64, 62, 60] }), entry('b')]),
      }).impl,
      shipped,
    });
    await svc.refresh();
    const tunes = await createCatalogService({ apiUrl: 'https://api', kv, shipped }).load();
    expect(tunes.find((t) => t.id === 'a')?.answer).toEqual([64, 62, 60]);
    expect(tunes.find((t) => t.id === 'b')?.answer).toBeUndefined();
  });
});

describe('parseCatalog', () => {
  it('keeps the good entries and drops the bad ones', () => {
    expect(
      parseCatalog(answer([entry('a'), entry('b', { level: 99 }), entry('c')]))?.map((t) => t.id),
    ).toEqual(['a', 'c']);
  });
  it('is null for something that is not a catalog', () => {
    expect(parseCatalog({ ok: false })).toBeNull();
    expect(parseCatalog(null)).toBeNull();
    expect(parseCatalog({ ok: true, tunes: 'x' })).toBeNull();
  });
});

describe('the catalog service', () => {
  it('starts from the shipped tunes when nothing is stored', async () => {
    const svc = createCatalogService({ apiUrl: 'https://api', kv: memoryKv(), shipped });
    expect(await svc.load()).toEqual(shipped);
  });

  it('stores a downloaded catalog and starts from it next time', async () => {
    const kv = memoryKv();
    const f = fakeFetch({ status: 200, body: answer([entry('a'), entry('b')]) });
    const svc = createCatalogService({ apiUrl: 'https://api/', kv, fetchImpl: f.impl, shipped });
    expect(await svc.refresh()).toBe(true);
    expect(f.calls[0].url).toBe('https://api/api/melodies');
    expect((await svc.load()).map((t) => t.id)).toEqual(['a', 'b']);
    expect(kv.data.has(CATALOG_KEY)).toBe(true);
    const again = createCatalogService({ apiUrl: 'https://api', kv, shipped });
    expect((await again.load()).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('asks with the stored etag, and an unchanged answer (304) changes nothing', async () => {
    const kv = memoryKv();
    await createCatalogService({
      apiUrl: 'https://api',
      kv,
      fetchImpl: fakeFetch({ status: 200, body: answer([entry('a')], 'abc') }).impl,
      shipped,
    }).refresh();
    const f = fakeFetch({ status: 304 });
    const svc = createCatalogService({ apiUrl: 'https://api', kv, fetchImpl: f.impl, shipped });
    expect(await svc.refresh()).toBe(false);
    expect(f.calls[0].headers['If-None-Match']).toBe('"abc"');
    expect((await svc.load()).map((t) => t.id)).toEqual(['a']);
  });

  it('keeps what it has when the server is down, answers an error, or sends rubbish', async () => {
    const kv = memoryKv();
    await createCatalogService({
      apiUrl: 'https://api',
      kv,
      fetchImpl: fakeFetch({ status: 200, body: answer([entry('a')]) }).impl,
      shipped,
    }).refresh();
    for (const res of [
      new Error('offline'),
      { status: 500 },
      { status: 200, body: { ok: true, etag: 'x', tunes: [] } },
      { status: 200, body: 'nope' },
    ] as const) {
      const svc = createCatalogService({
        apiUrl: 'https://api',
        kv,
        fetchImpl: fakeFetch(res).impl,
        shipped,
      });
      expect(await svc.refresh()).toBe(false);
      expect((await svc.load()).map((t) => t.id)).toEqual(['a']);
    }
  });

  it('never calls the network without a backend, and survives a damaged snapshot', async () => {
    const f = fakeFetch({ status: 200, body: answer([entry('a')]) });
    expect(
      await createCatalogService({
        apiUrl: undefined,
        kv: memoryKv(),
        fetchImpl: f.impl,
        shipped,
      }).refresh(),
    ).toBe(false);
    expect(f.calls).toHaveLength(0);
    const bad = createCatalogService({
      apiUrl: 'https://api',
      kv: memoryKv({ [CATALOG_KEY]: '{not json' }),
      shipped,
    });
    expect(await bad.load()).toEqual(shipped);
  });

  it('a catalog the server removed a tune from is taken as it is', async () => {
    const kv = memoryKv();
    await createCatalogService({
      apiUrl: 'https://api',
      kv,
      fetchImpl: fakeFetch({ status: 200, body: answer([entry('a'), entry('b')], 'e1') }).impl,
      shipped,
    }).refresh();
    const svc = createCatalogService({
      apiUrl: 'https://api',
      kv,
      fetchImpl: fakeFetch({ status: 200, body: answer([entry('a')], 'e2') }).impl,
      shipped,
    });
    expect(await svc.refresh()).toBe(true);
    expect((await svc.load()).map((t) => t.id)).toEqual(['a']);
  });
});
