import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishReel } from './instagram.js';
import { PublishError } from './types.js';

interface Call { method: string; url: string; headers: Record<string, string>; body?: unknown }

function harness(routes: [RegExp, (c: Call, n: number) => Response][]) {
  const calls: Call[] = [];
  const hits = new Map<RegExp, number>();
  const fetchFn = (async (input: string | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const call: Call = { method: init?.method ?? 'GET', url: String(input), headers, body: init?.body };
    calls.push(call);
    for (const [re, h] of routes) {
      if (re.test(call.method + ' ' + call.url)) {
        const n = (hits.get(re) ?? 0) + 1;
        hits.set(re, n);
        return h(call, n);
      }
    }
    return new Response(JSON.stringify({ error: { message: `no route ${call.method} ${call.url}` } }), { status: 404 });
  }) as typeof fetch;
  return { calls, fetchFn };
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const videoUrl = 'https://blob.example/publish/ear-challenge-31-AbC.mp4';
const env = { IG_PUBLISH_TOKEN: 'IGTOKEN' };
const noSleep = async () => {};

const happy = (statuses: string[]) =>
  harness([
    [/POST .*\/me\/media$/, () => json({ id: 'cont1' })],
    [/GET .*\/cont1\?/, (_c, n) => json({ id: 'cont1', status_code: statuses[Math.min(n, statuses.length) - 1] })],
    [/POST .*\/me\/media_publish$/, () => json({ id: 'media9' })],
    [/GET .*\/media9\?/, () => json({ id: 'media9', permalink: 'https://www.instagram.com/reel/AbC/' })],
  ]);

test('creates a Reel container from the public video_url, waits for processing, publishes, returns the permalink', async () => {
  const h = happy(['IN_PROGRESS', 'FINISHED']);
  let slept = 0;
  const r = await publishReel({ fetchFn: h.fetchFn, env, sleep: async () => void slept++ }, { videoUrl, caption: 'No tabs. No chords.', publish: true });
  assert.deepEqual(r, { containerId: 'cont1', mediaId: 'media9', permalink: 'https://www.instagram.com/reel/AbC/' });
  assert.equal(slept, 1);

  const create = h.calls.find((c) => /\/me\/media$/.test(c.url))!;
  const form = new URLSearchParams(String(create.body));
  assert.equal(form.get('media_type'), 'REELS');
  assert.equal(form.get('video_url'), videoUrl);
  assert.equal(form.get('upload_type'), null); // resumable upload is not supported by this API (verified live)
  assert.equal(form.get('share_to_feed'), 'true');
  assert.equal(form.get('caption'), 'No tabs. No chords.');
  assert.ok(!create.url.includes('IGTOKEN'), 'the token must not be in the URL');

  assert.ok(!h.calls.some((c) => /rupload/.test(c.url)), 'no byte upload to Meta — it downloads the video itself');

  const pub = h.calls.find((c) => /media_publish$/.test(c.url))!;
  assert.equal(new URLSearchParams(String(pub.body)).get('creation_id'), 'cont1');
});

test('stage only: uploaded and processed, never published', async () => {
  const h = happy(['FINISHED']);
  const r = await publishReel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { videoUrl, caption: 'c', publish: false });
  assert.deepEqual(r, { containerId: 'cont1' });
  assert.ok(!h.calls.some((c) => /media_publish/.test(c.url)));
});

test('a processing error stops before publishing and carries the platform status', async () => {
  const h = happy(['ERROR']);
  await assert.rejects(publishReel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { videoUrl, caption: 'c', publish: true }), /could not process.*ERROR/i);
  assert.ok(!h.calls.some((c) => /media_publish/.test(c.url)));
});

test('processing that never finishes times out with the container id', async () => {
  const h = happy(['IN_PROGRESS']);
  let t = 0;
  await assert.rejects(
    publishReel({ fetchFn: h.fetchFn, env, sleep: async () => void (t += 10_000), maxWaitMs: 30_000 }, { videoUrl, caption: 'c', publish: true }),
    (e: Error) => /cont1/.test(e.message) && /still processing/i.test(e.message),
  );
  assert.ok(!h.calls.some((c) => /media_publish/.test(c.url)));
});

test('a missing publish token is explained; the analytics token is not reused', async () => {
  const h = harness([]);
  await assert.rejects(publishReel({ fetchFn: h.fetchFn, env: { IG_ACCESS_TOKEN: 'analytics' }, sleep: noSleep }, { videoUrl, caption: 'c', publish: true }), (e: Error) => {
    assert.ok(e instanceof PublishError);
    assert.match(e.message, /IG_PUBLISH_TOKEN/);
    return true;
  });
  assert.equal(h.calls.length, 0);
});

test('API errors surface the platform message without the token', async () => {
  const h = harness([[/POST .*\/me\/media$/, () => json({ error: { message: 'Invalid OAuth access token' } }, 400)]]);
  await assert.rejects(publishReel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { videoUrl, caption: 'c', publish: true }), (e: Error) => {
    assert.match(e.message, /Invalid OAuth access token/);
    assert.doesNotMatch(e.message, /IGTOKEN/);
    return true;
  });
});
