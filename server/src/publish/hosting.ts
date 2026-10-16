// A temporary public address for a video, because Instagram's API only takes `video_url`.
// Vercel Blob (already in the owner's account): upload -> hand the URL to Meta -> delete right after
// Meta has processed it. The address carries a random suffix and exists only for those minutes.
import { del, list, put } from '@vercel/blob';
import { PublishError } from './types.js';

export interface TempHosted {
  url: string;
  remove: () => Promise<void>;
}

/** Uploads `bytes` and returns where Meta can fetch them, plus a way to take the copy down. */
export type TempHost = (bytes: Uint8Array, name: string) => Promise<TempHosted>;

/** The slice of @vercel/blob this module uses (injectable so tests need no network). */
export interface BlobApi {
  put(path: string, body: Buffer, o: { access: 'public'; addRandomSuffix: boolean; contentType: string; token: string }): Promise<{ url: string }>;
  del(url: string | string[], o: { token: string }): Promise<void>;
  list(o: { prefix: string; token: string; cursor?: string }): Promise<{ blobs: { url: string; uploadedAt: Date }[]; hasMore: boolean; cursor?: string }>;
}

const realApi = { put, del, list } as unknown as BlobApi;
const PREFIX = 'publish/';
const MAX_AGE_MS = 60 * 60_000;

/** Deletes copies a crashed run left behind (anything under publish/ older than an hour). Never throws. */
async function sweep(api: BlobApi, token: string, now: number): Promise<void> {
  try {
    const stale: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await api.list({ prefix: PREFIX, token, cursor });
      for (const b of page.blobs) if (now - b.uploadedAt.getTime() > MAX_AGE_MS) stale.push(b.url);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    if (stale.length) await api.del(stale, { token });
  } catch {
    /* housekeeping only — the upload must not depend on it */
  }
}

export function blobHost(env: Record<string, string | undefined>, api: BlobApi = realApi, now: () => number = Date.now): TempHost {
  return async (bytes, name) => {
    const token = env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new PublishError(
        'Instagram needs a temporary public address for the video: BLOB_READ_WRITE_TOKEN is missing in server/.env ' +
          '(create a Vercel Blob store and put its read-write token there; it is used only to hand the file to Instagram and is deleted afterwards).',
      );
    }
    await sweep(api, token, now());
    const blob = await api.put(`${PREFIX}${name}`, Buffer.from(bytes), { access: 'public', addRandomSuffix: true, contentType: 'video/mp4', token });
    return { url: blob.url, remove: () => api.del(blob.url, { token }) };
  };
}
