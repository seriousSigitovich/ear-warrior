import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublishError } from './types.js';
import { uploadToYoutube } from './youtube.js';

interface Call { method: string; url: string; headers: Record<string, string>; body?: unknown }

function harness(routes: [RegExp, (c: Call) => Response][]) {
  const calls: Call[] = [];
  const fetchFn = (async (input: string | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const call: Call = { method: init?.method ?? 'GET', url: String(input), headers, body: init?.body };
    calls.push(call);
    for (const [re, h] of routes) if (re.test(call.url)) return h(call);
    return new Response(JSON.stringify({ error: { message: `no route ${call.url}` } }), { status: 404 });
  }) as typeof fetch;
  return { calls, fetchFn };
}

const env = { YT_CLIENT_ID: 'cid', YT_CLIENT_SECRET: 'csec', YT_UPLOAD_REFRESH_TOKEN: 'rt' };
const bytes = new Uint8Array(1234);
const meta = { bytes, title: 'Can you play this by ear?', description: 'desc #Shorts', tags: ['guitar'] };
const json = (b: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(b), { status: 200, ...init });

test('uploads as private, not made for kids, with metadata; returns watch and Studio links', async () => {
  const h = harness([
    [/oauth2\.googleapis\.com\/token/, () => json({ access_token: 'AT' })],
    [/upload\/youtube\/v3\/videos/, () => new Response('', { status: 200, headers: { location: 'https://upload.example/session/1' } })],
    [/upload\.example\/session\/1/, () => json({ id: 'vid42' })],
  ]);
  const r = await uploadToYoutube({ fetchFn: h.fetchFn, env }, meta);
  assert.equal(r.id, 'vid42');
  assert.equal(r.url, 'https://www.youtube.com/shorts/vid42');
  assert.equal(r.studioUrl, 'https://studio.youtube.com/video/vid42/edit');

  const init = h.calls.find((c) => /uploadType=resumable/.test(c.url))!;
  assert.match(init.url, /part=snippet(%2C|,)status/);
  assert.equal(init.headers['authorization'], 'Bearer AT');
  assert.equal(init.headers['x-upload-content-type'], 'video/mp4');
  assert.equal(init.headers['x-upload-content-length'], '1234');
  const sent = JSON.parse(String(init.body));
  assert.equal(sent.status.privacyStatus, 'private'); // forced: unaudited projects cannot publish publicly
  assert.equal(sent.status.selfDeclaredMadeForKids, false);
  assert.equal(sent.snippet.title, meta.title);
  assert.equal(sent.snippet.description, meta.description);
  assert.deepEqual(sent.snippet.tags, ['guitar']);

  const put = h.calls.find((c) => c.method === 'PUT')!;
  assert.equal(put.headers['content-type'], 'video/mp4');
  assert.equal((put.body as Uint8Array).length, 1234);
});

test('uses the upload credential, not the analytics one, and says how to get it when missing', async () => {
  const h = harness([]);
  await assert.rejects(uploadToYoutube({ fetchFn: h.fetchFn, env: { YT_CLIENT_ID: 'a', YT_CLIENT_SECRET: 'b', YT_REFRESH_TOKEN: 'analytics-token' } }, meta), (e: Error) => {
    assert.ok(e instanceof PublishError);
    assert.match(e.message, /YT_UPLOAD_REFRESH_TOKEN/);
    assert.match(e.message, /yt:auth -- --upload/);
    return true;
  });
  assert.equal(h.calls.length, 0);
});

test('a quota or permission error is shown with the platform message and no token', async () => {
  const h = harness([
    [/oauth2\.googleapis\.com\/token/, () => json({ access_token: 'SECRET-AT' })],
    [/upload\/youtube\/v3\/videos/, () => json({ error: { message: 'The request cannot be completed because you have exceeded your quota.' } }, { status: 403 })],
  ]);
  await assert.rejects(uploadToYoutube({ fetchFn: h.fetchFn, env }, meta), (e: Error) => {
    assert.match(e.message, /exceeded your quota/);
    assert.doesNotMatch(e.message, /SECRET-AT/);
    return true;
  });
  assert.ok(!h.calls.some((c) => c.method === 'PUT'));
});

test('a rejected refresh token is explained', async () => {
  const h = harness([[/oauth2\.googleapis\.com\/token/, () => json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, { status: 400 })]]);
  await assert.rejects(uploadToYoutube({ fetchFn: h.fetchFn, env }, meta), /expired or revoked/);
});
