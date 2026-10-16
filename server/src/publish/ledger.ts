// The record of what was published where (docs/published.json, tracked, never holds a secret).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';
import { PublishError, type PlatformName } from './types.js';

export interface Entry {
  file: string; // repo-relative, forward slashes
  videoNo: number | null;
  platform: PlatformName;
  postId: string;
  url: string;
  visibility: 'private' | 'public';
  title: string;
  publishedAt: string; // ISO
}

export function relativeFile(abs: string, repoRoot: string): string {
  return relative(repoRoot, abs).split('\\').join('/');
}

export function loadLedger(path: string): Entry[] {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  try {
    const data = JSON.parse(text) as unknown;
    if (!Array.isArray(data)) throw new Error('not an array');
    return data as Entry[];
  } catch {
    throw new PublishError(`${basename(path)} is not valid JSON — fix or remove it before publishing (it was not overwritten)`);
  }
}

export function findEntry(entries: Entry[], file: string, platform: PlatformName): Entry | undefined {
  return entries.find((e) => e.file === file && e.platform === platform);
}

/** Appends one entry; only the declared fields are written. */
export function addEntry(path: string, e: Entry): void {
  const clean: Entry = {
    file: e.file,
    videoNo: e.videoNo,
    platform: e.platform,
    postId: e.postId,
    url: e.url,
    visibility: e.visibility,
    title: e.title,
    publishedAt: e.publishedAt,
  };
  const all = [...loadLedger(path), clean];
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(all, null, 2)}\n`);
  renameSync(tmp, path);
}
