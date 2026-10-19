import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blobHost, type BlobApi } from './hosting.js';
import { PublishError } from './types.js';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms);

function fakeApi(existing: { url: string; uploadedAt: Date }[] = [], opts: { listFails?: boolean } = {}) {
  const log: string[] = [];
  const api: BlobApi = {
    async put(path, _body, o) {
      log.push(`put ${path} access=${o.access} suffix=${o.addRandomSuffix} type=${o.contentType}`);
      return { url: 'https://store.public.blob.vercel-storage.com/publish/x-AbC.mp4' };
    },
    async del(url) {
      log.push(`del ${([] as string[]).concat(url).join(',')}`);
    },
    async list(o) {
      log.push(`list ${o.prefix}`);
      if (opts.listFails) throw new Error('list failed');
      return { blobs: existing, hasMore: false };
    },
  };
  return { api, log };
}

test('without BLOB_READ_WRITE_TOKEN the temporary host explains what to set up and sends nothing', async () => {
  const f = fakeApi();
  await assert.rejects(blobHost({}, f.api)(new Uint8Array(10), 'x.mp4'), (e: Error) => {
    assert.ok(e instanceof PublishError);
    assert.match(e.message, /BLOB_READ_WRITE_TOKEN/);
    return true;
  });
  assert.deepEqual(f.log, []);
});

test('uploads public with a random suffix, returns the address, and remove() deletes exactly that copy', async () => {
  const f = fakeApi();
  const hosted = await blobHost({ BLOB_READ_WRITE_TOKEN: 't' }, f.api, () => NOW)(new Uint8Array(10), 'ear-challenge-31.mp4');
  assert.equal(hosted.url, 'https://store.public.blob.vercel-storage.com/publish/x-AbC.mp4');
  assert.ok(f.log.includes('put publish/ear-challenge-31.mp4 access=public suffix=true type=video/mp4'));
  await hosted.remove();
  assert.equal(f.log.at(-1), 'del https://store.public.blob.vercel-storage.com/publish/x-AbC.mp4');
});

test('before uploading it sweeps leftovers older than an hour and keeps recent ones', async () => {
  const f = fakeApi([
    { url: 'https://s/publish/old1.mp4', uploadedAt: ago(2 * 3600_000) },
    { url: 'https://s/publish/recent.mp4', uploadedAt: ago(10 * 60_000) },
    { url: 'https://s/publish/old2.mp4', uploadedAt: ago(5 * 3600_000) },
  ]);
  await blobHost({ BLOB_READ_WRITE_TOKEN: 't' }, f.api, () => NOW)(new Uint8Array(1), 'x.mp4');
  assert.deepEqual(f.log.filter((l) => l.startsWith('del')), ['del https://s/publish/old1.mp4,https://s/publish/old2.mp4']);
  assert.ok(f.log.findIndex((l) => l.startsWith('del')) < f.log.findIndex((l) => l.startsWith('put')), 'sweep happens before the new upload');
});

test('a failing sweep never blocks the upload', async () => {
  const f = fakeApi([], { listFails: true });
  const hosted = await blobHost({ BLOB_READ_WRITE_TOKEN: 't' }, f.api, () => NOW)(new Uint8Array(1), 'x.mp4');
  assert.ok(hosted.url);
});

test('a cover goes up with its own content type', async () => {
  const f = fakeApi();
  await blobHost({ BLOB_READ_WRITE_TOKEN: 't' }, f.api, () => NOW)(new Uint8Array(10), 'cover.jpg', 'image/jpeg');
  assert.ok(f.log.includes('put publish/cover.jpg access=public suffix=true type=image/jpeg'));
});
