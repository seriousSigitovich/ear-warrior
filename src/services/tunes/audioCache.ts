// The voiced clips on the device (spec 024): downloaded on demand and kept, fetched ahead for the level in use and the
// next, replaced only when their hash changed, deleted when the tune is gone. The file system is injected, so every
// decision here is testable; cachePlan.ts holds the pure rules.
import {
  cacheName,
  needsDownload,
  parseCacheName,
  prefetchOrder,
  staleFiles,
  type CachedFile,
} from './cachePlan';
import type { LibraryTune } from './types';

export interface FileService {
  list(): Promise<CachedFile[]>;
  /** Download `url` into the cache as `name`; true once a file of exactly `bytes` is there under that name. */
  download(url: string, name: string, bytes: number): Promise<boolean>;
  remove(name: string): Promise<void>;
  /** A uri the audio player can open for a cached file. */
  uri(name: string): string;
}

/** Where a clip comes from when it plays: a file in the cache, or the copy shipped inside the app. */
export type ClipSource = { kind: 'file'; uri: string } | { kind: 'bundled' };

export interface AudioCache {
  /** Make the clip of `tune` playable now (downloading it if needed): false when it cannot be had. */
  ensure(tune: LibraryTune): Promise<boolean>;
  /** Where the clip plays from; null when it is neither cached nor shipped. Synchronous: the native player asks per play. */
  source(tuneId: string): ClipSource | null;
  /** Fetch the clips of `level` and the next one in the background, one at a time; resolves when done or stopped. */
  prefetch(catalog: readonly LibraryTune[], level: number): Promise<void>;
  /** Delete files of tunes that left the catalog and of older versions. */
  sweep(catalog: readonly LibraryTune[]): Promise<void>;
  /** Stop the background fetching after the clip in flight. */
  stop(): void;
}

interface Deps {
  files: FileService;
  /** Tunes whose clip ships inside the app, with the hash of that copy. */
  bundledHashes: ReadonlyMap<string, string>;
}

export function createAudioCache({ files, bundledHashes }: Deps): AudioCache {
  let cached: CachedFile[] = [];
  let indexed = false;
  const inFlight = new Map<string, Promise<boolean>>();
  let stopped = false;
  /** The file name of the version of each tune the catalog names now. */
  const wanted = new Map<string, string>();

  async function refreshIndex(): Promise<void> {
    cached = await files.list().catch(() => cached);
    indexed = true;
  }

  /** The newest cached file of a tune: the one of its current version, else any older one (better than silence). */
  function fileOf(tune: Pick<LibraryTune, 'id' | 'audio'>): CachedFile | undefined {
    const current = cached.find(
      (f) => f.name === cacheName(tune.id, tune.audio.sha256) && f.bytes === tune.audio.bytes,
    );
    return current ?? cached.find((f) => parseCacheName(f.name)?.id === tune.id);
  }

  const playable = (tune: LibraryTune): boolean =>
    !needsDownload(tune, cached, bundledHashes) ||
    fileOf(tune) !== undefined ||
    bundledHashes.has(tune.id);

  async function ensure(tune: LibraryTune): Promise<boolean> {
    wanted.set(tune.id, cacheName(tune.id, tune.audio.sha256));
    if (!indexed) await refreshIndex();
    if (!needsDownload(tune, cached, bundledHashes)) return true;
    const running = inFlight.get(tune.id);
    if (running) return running;
    const task = (async () => {
      const name = cacheName(tune.id, tune.audio.sha256);
      const ok =
        tune.audio.url !== null &&
        (await files.download(tune.audio.url, name, tune.audio.bytes).catch(() => false));
      if (ok) await refreshIndex();
      return ok || playable(tune);
    })().finally(() => inFlight.delete(tune.id));
    inFlight.set(tune.id, task);
    return task;
  }

  return {
    ensure,

    source(tuneId) {
      const ofTune = cached.filter((f) => parseCacheName(f.name)?.id === tuneId);
      // The file of the version the catalog names wins; an older one still beats silence; then the shipped copy.
      const file = ofTune.find((f) => f.name === wanted.get(tuneId)) ?? ofTune[0];
      if (file) return { kind: 'file', uri: files.uri(file.name) };
      return bundledHashes.has(tuneId) ? { kind: 'bundled' } : null;
    },

    async prefetch(catalog, level) {
      stopped = false;
      for (const t of catalog) wanted.set(t.id, cacheName(t.id, t.audio.sha256));
      if (!indexed) await refreshIndex();
      for (const tune of prefetchOrder(catalog, level, cached, bundledHashes)) {
        if (stopped) return;
        await ensure(tune);
      }
    },

    async sweep(catalog) {
      for (const t of catalog) wanted.set(t.id, cacheName(t.id, t.audio.sha256));
      if (!indexed) await refreshIndex();
      for (const name of staleFiles(catalog, cached))
        await files.remove(name).catch(() => undefined);
      await refreshIndex();
    },

    stop() {
      stopped = true;
    },
  };
}
