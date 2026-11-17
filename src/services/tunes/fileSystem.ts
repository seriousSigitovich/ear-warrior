// The real file service of the audio cache, over expo-file-system: clips live in `<documents>/tunes/`. A download goes
// to `<name>.part` first and is renamed only when it has the size the catalog promised, so a cut-off download is never
// taken for a clip. Not loaded by the pure-logic tests (the native module is required lazily).
import type { CachedFile } from './cachePlan';
import type { FileService } from './audioCache';

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped native module handles */
export function expoFileService(): FileService {
  const fs = (): any => require('expo-file-system');

  const dir = (): any => {
    const { Directory, Paths } = fs();
    const d = new Directory(Paths.document, 'tunes');
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    return d;
  };
  const file = (name: string): any => new (fs().File)(dir(), name);
  const drop = (f: any) => {
    try {
      if (f.exists) f.delete();
    } catch {
      // already gone
    }
  };

  return {
    async list() {
      const { File } = fs();
      return dir()
        .list()
        .filter((e: any) => e instanceof File)
        .map((f: any): CachedFile => ({ name: f.name, bytes: f.size ?? 0 }));
    },

    async download(url, name, bytes) {
      const part = file(`${name}.part`);
      try {
        drop(part);
        await fs().File.downloadFileAsync(url, part);
        if (part.size !== bytes) {
          drop(part);
          return false;
        }
        const dest = file(name);
        drop(dest);
        part.move(dest);
        return true;
      } catch {
        drop(part);
        return false;
      }
    },

    async remove(name) {
      drop(file(name));
    },

    uri(name) {
      return file(name).uri;
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
