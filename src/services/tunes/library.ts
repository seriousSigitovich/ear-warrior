// The library the app serves from (spec 024): the tunes it has been told about, whatever their source — the catalog
// downloaded from the server, or the few tunes that ship inside the app until the first download. A small registry
// instead of a constant: screens read it synchronously, the catalog service replaces it when a newer one arrives.
import type { LibraryTune } from './types';

let tunes: readonly LibraryTune[] = [];
let version = 0;
const listeners = new Set<() => void>();

/** Every tune the app can serve, easiest level first. */
export function getLibrary(): readonly LibraryTune[] {
  return tunes;
}

/** Replace the library; listeners (screens showing it) are told. */
export function setLibrary(next: readonly LibraryTune[]): void {
  tunes = [...next].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  version += 1;
  for (const l of [...listeners]) l();
}

/** Bumps whenever the library is replaced: a cheap key for memoised views. */
export function libraryVersion(): number {
  return version;
}

export function onLibraryChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function libraryTune(id: string): LibraryTune | undefined {
  return tunes.find((t) => t.id === id);
}
