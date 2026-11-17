// The running app's tunes (spec 024): the catalog on the device, the audio cache, and the background refresh. `startTunes`
// is called once at launch: it fills the library from what the device already has (fast, offline) and then, without
// blocking anything, asks the server for a newer catalog, drops clips that are no longer wanted and fetches the next ones.
import { keyValueOverRowStore } from '../../lib/deviceId';
import { KEY_VALUE_TABLE, defaultRowStore } from '../storage/db';
import { createAudioCache, type AudioCache } from './audioCache';
import { createCatalogService, type CatalogService } from './catalog';
import { expoFileService } from './fileSystem';
import { setLibrary, getLibrary } from './library';
import { SHIPPED_HASHES, SHIPPED_TUNES } from './shippedTunes';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let cache: AudioCache | undefined;
let catalog: CatalogService | undefined;

export function getAudioCache(): AudioCache {
  return (cache ??= createAudioCache({ files: expoFileService(), bundledHashes: SHIPPED_HASHES }));
}

function getCatalog(): CatalogService {
  return (catalog ??= createCatalogService({
    apiUrl: API_URL,
    kv: keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE),
    shipped: SHIPPED_TUNES,
  }));
}

let started: Promise<void> | undefined;

/** Fill the library from the device (so screens can render at once), then refresh in the background. Once per launch. */
export function startTunes(level: () => Promise<number>): Promise<void> {
  return (started ??= (async () => {
    const svc = getCatalog();
    setLibrary(await svc.load());
    void (async () => {
      if (await svc.refresh()) setLibrary(await svc.load());
      const tunes = getLibrary();
      await getAudioCache().sweep(tunes);
      await getAudioCache().prefetch(tunes, await level());
    })().catch(() => undefined);
  })());
}

/** Fetch the clips of `level` and the next one (the level in use changed). */
export function prefetchLevel(level: number): void {
  void getAudioCache()
    .prefetch(getLibrary(), level)
    .catch(() => undefined);
}
