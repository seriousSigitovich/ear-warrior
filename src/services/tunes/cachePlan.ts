// What to keep on the device and what to fetch (spec 024, FR-004), as pure decisions over the catalog and the files
// already there. A cached clip is named `<id>.<hash8>.m4a`: the name alone says which version it is.
import type { LibraryTune } from './types';

const SUFFIX = '.m4a';
const HASH_LEN = 8;

export const cacheName = (id: string, sha256: string): string =>
  `${id}.${sha256.slice(0, HASH_LEN)}${SUFFIX}`;

/** The tune id and hash prefix a cache file name stands for, or null when it is not one of ours. */
export function parseCacheName(name: string): { id: string; hash: string } | null {
  const m = /^([a-z0-9]{1,60})\.([0-9a-f]{8})\.m4a$/.exec(name);
  return m ? { id: m[1], hash: m[2] } : null;
}

export interface CachedFile {
  name: string;
  bytes: number;
}

/**
 * Whether the clip of `tune` has to be downloaded: it has somewhere to come from, no file of its current version is
 * there (or the file's size is wrong — a download that was cut off), and the copy inside the app is not that version.
 */
export function needsDownload(
  tune: LibraryTune,
  cached: readonly CachedFile[],
  bundledHashes: ReadonlyMap<string, string>,
): boolean {
  if (tune.audio.url === null) return false;
  if (bundledHashes.get(tune.id) === tune.audio.sha256) return false;
  const file = cached.find((f) => f.name === cacheName(tune.id, tune.audio.sha256));
  return !file || file.bytes !== tune.audio.bytes;
}

/** Files to delete: those of tunes no longer in the catalog, of an older version of a tune, or not ours at all. */
export function staleFiles(
  catalog: readonly LibraryTune[],
  cached: readonly CachedFile[],
): string[] {
  const keep = new Set(catalog.map((t) => cacheName(t.id, t.audio.sha256)));
  return cached.filter((f) => !keep.has(f.name)).map((f) => f.name);
}

/** The order to fetch clips in the background: the level in use, then the next one, nothing further. */
export function prefetchOrder(
  catalog: readonly LibraryTune[],
  level: number,
  cached: readonly CachedFile[],
  bundledHashes: ReadonlyMap<string, string>,
): LibraryTune[] {
  return catalog
    .filter((t) => t.rank === level || t.rank === level + 1)
    .filter((t) => needsDownload(t, cached, bundledHashes))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
}
