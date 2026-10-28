import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishCarousel, publishReel } from './instagram.js';
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

test('a cover image is passed to Instagram as cover_url; without one the field is absent', async () => {
  const withCover = happy(['FINISHED']);
  await publishReel({ fetchFn: withCover.fetchFn, env, sleep: noSleep }, { videoUrl, coverUrl: 'https://blob.example/publish/cover-Xy.jpg', caption: 'c', publish: false });
  const form = new URLSearchParams(String(withCover.calls.find((c) => /\/me\/media$/.test(c.url))!.body));
  assert.equal(form.get('cover_url'), 'https://blob.example/publish/cover-Xy.jpg');

  const without = happy(['FINISHED']);
  await publishReel({ fetchFn: without.fetchFn, env, sleep: noSleep }, { videoUrl, caption: 'c', publish: false });
  assert.equal(new URLSearchParams(String(without.calls.find((c) => /\/me\/media$/.test(c.url))!.body)).get('cover_url'), null);
});

// --- carousel ---

const imageUrls = ['https://blob.example/publish/01-a.jpg', 'https://blob.example/publish/02-b.jpg', 'https://blob.example/publish/03-c.jpg'];

function carouselHarness(over: { childStatus?: string } = {}) {
  let n = 0;
  return harness([
    [/POST .*\/me\/media$/, (c) => {
      const f = new URLSearchParams(String(c.body));
      return json({ id: f.get('media_type') === 'CAROUSEL' ? 'car1' : `child${++n}` });
    }],
    [/GET .*\/child\d\?/, () => json({ status_code: over.childStatus ?? 'FINISHED' })],
    [/GET .*\/car1\?/, () => json({ status_code: 'FINISHED' })],
    [/POST .*\/me\/media_publish$/, () => json({ id: 'media7' })],
    [/GET .*\/media7\?/, () => json({ permalink: 'https://www.instagram.com/p/AbC/' })],
  ]);
}

test('carousel: one container per slide, then a CAROUSEL container listing them in order, then publish', async () => {
  const h = carouselHarness();
  const r = await publishCarousel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { imageUrls, caption: 'Play by ear', publish: true });
  assert.deepEqual(r, { containerId: 'car1', mediaId: 'media7', permalink: 'https://www.instagram.com/p/AbC/' });

  const creates = h.calls.filter((c) => c.method === 'POST' && /\/me\/media$/.test(c.url)).map((c) => new URLSearchParams(String(c.body)));
  assert.equal(creates.length, 4);
  creates.slice(0, 3).forEach((f, i) => {
    assert.equal(f.get('image_url'), imageUrls[i]);
    assert.equal(f.get('is_carousel_item'), 'true');
    assert.equal(f.get('caption'), null, 'the caption belongs to the carousel, not to a slide');
  });
  assert.equal(creates[3]!.get('media_type'), 'CAROUSEL');
  assert.equal(creates[3]!.get('children'), 'child1,child2,child3');
  assert.equal(creates[3]!.get('caption'), 'Play by ear');
  assert.equal(new URLSearchParams(String(h.calls.find((c) => /media_publish$/.test(c.url))!.body)).get('creation_id'), 'car1');
  assert.ok(h.calls.filter((c) => c.method === 'POST').every((c) => !c.url.includes('IGTOKEN')), 'the token goes in the POST body, not the URL');
});

test('carousel: stage only builds and processes the container, never publishes', async () => {
  const h = carouselHarness();
  const r = await publishCarousel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { imageUrls, caption: 'c', publish: false });
  assert.deepEqual(r, { containerId: 'car1' });
  assert.ok(!h.calls.some((c) => /media_publish/.test(c.url)));
});

test('carousel: a slide that fails processing stops everything before the carousel container exists', async () => {
  const h = carouselHarness({ childStatus: 'ERROR' });
  await assert.rejects(publishCarousel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { imageUrls, caption: 'c', publish: true }), /could not process the image.*ERROR/i);
  assert.equal(h.calls.filter((c) => c.method === 'POST').length, 1, 'no further slides, no carousel container, no publish');
});

test('carousel: 2–10 slides only, and the publish token is required, before any request', async () => {
  const h = harness([]);
  await assert.rejects(publishCarousel({ fetchFn: h.fetchFn, env, sleep: noSleep }, { imageUrls: ['https://x/1.jpg'], caption: 'c', publish: true }), /2–10 images; got 1/);
  await assert.rejects(publishCarousel({ fetchFn: h.fetchFn, env: {}, sleep: noSleep }, { imageUrls, caption: 'c', publish: true }), /IG_PUBLISH_TOKEN/);
  assert.equal(h.calls.length, 0);
});
