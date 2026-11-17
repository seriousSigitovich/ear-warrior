// Owner pages and calls for the melody library (spec 024), through Fastify's inject.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { buildApp } from '../app.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import type { TuneStore } from '../tunes/store.js';

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const AUTH = { authorization: basic('admin', 'pw') };
const JSONH = { ...AUTH, 'content-type': 'application/json' };
const T0 = new Date('2026-11-16T10:00:00Z');

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = 'pw';
});
afterEach(() => {
  if (saved === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = saved;
});

const M4A = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypM4A '), Buffer.alloc(40, 7)]);
function make(tunes: TuneStore = createMemoryTuneStore()) {
  const uploads: { id: string; bytes: number; sha256: string }[] = [];
  const app = buildApp({
    logger: false,
    tunes,
    tuneAudio: async (id, bytes, sha256) => {
      uploads.push({ id, bytes: bytes.length, sha256 });
      return `https://blob.example/tunes/${id}-${sha256.slice(0, 8)}.m4a`;
    },
    now: () => T0,
  });
  return { app, tunes, uploads };
}
const good = { title: 'Mary', level: 1, tempo_bpm: 110, phrases: [2, 1], notes: 'E4:1 D4:1 C4:2' };

test('no ADMIN_PASSWORD → 404; wrong or missing credentials → 401', async () => {
  const { app } = make();
  assert.equal((await app.inject({ method: 'GET', url: '/admin/tunes' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/admin/tunes', headers: { authorization: basic('admin', 'no') } })).statusCode, 401);
  delete process.env.ADMIN_PASSWORD;
  assert.equal((await app.inject({ method: 'GET', url: '/admin/tunes', headers: AUTH })).statusCode, 404);
});

test('create → hidden, no audio; the list shows it; the answer notes are in the admin json only', async () => {
  const { app } = make();
  const res = await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: good });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().tune.hidden, true);
  const list = (await app.inject({ method: 'GET', url: '/admin/tunes.json', headers: AUTH })).json();
  assert.equal(list.tunes[0].notes, good.notes);
  const page = await app.inject({ method: 'GET', url: '/admin/tunes', headers: AUTH });
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /Mary/);
  assert.equal((await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes.length, 0);
});

test('invalid input → 422 with the failing rules and nothing stored', async () => {
  const { app, tunes } = make();
  const res = await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: { ...good, level: 12, phrases: [5] } });
  assert.equal(res.statusCode, 422);
  assert.ok(res.json().errors.length >= 2);
  assert.equal(await tunes.get('mary'), null);
  const bad = await app.inject({ method: 'POST', url: '/admin/tunes/Bad-Id', headers: JSONH, payload: good });
  assert.equal(bad.statusCode, 422);
});

test('an audio upload records url, size and sha256 and keeps the tune hidden until shown', async () => {
  const { app, uploads } = make();
  await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: good });
  const up = await app.inject({ method: 'PUT', url: '/admin/tunes/mary/audio', headers: { ...AUTH, 'content-type': 'audio/mp4' }, payload: M4A });
  assert.equal(up.statusCode, 200, up.body);
  const t = up.json().tune;
  assert.equal(t.audio_bytes, M4A.length);
  assert.match(t.audio_sha256, /^[0-9a-f]{64}$/);
  assert.equal(uploads[0].sha256, t.audio_sha256);
  assert.match(t.audio_url, /^https:\/\/blob\.example\/tunes\/mary-/);
  assert.equal(t.hidden, true);
  assert.equal((await app.inject({ method: 'POST', url: '/admin/tunes/mary/show', headers: AUTH })).statusCode, 200);
  const catalog = (await app.inject({ method: 'GET', url: '/api/melodies' })).json();
  assert.deepEqual(catalog.tunes.map((x: { id: string }) => x.id), ['mary']);
  assert.equal(catalog.tunes[0].audio_sha256, t.audio_sha256);
});

test('?show=1 on the upload shows the tune at once', async () => {
  const { app } = make();
  await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: good });
  await app.inject({ method: 'PUT', url: '/admin/tunes/mary/audio?show=1', headers: { ...AUTH, 'content-type': 'audio/mp4' }, payload: M4A });
  assert.equal((await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes.length, 1);
});

test('audio that is not an m4a, empty, or for an unknown tune is refused', async () => {
  const { app, uploads } = make();
  await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: good });
  const h = { ...AUTH, 'content-type': 'audio/mp4' };
  assert.equal((await app.inject({ method: 'PUT', url: '/admin/tunes/mary/audio', headers: h, payload: Buffer.from('not audio at all, plain text') })).statusCode, 422);
  assert.equal((await app.inject({ method: 'PUT', url: '/admin/tunes/mary/audio', headers: h, payload: Buffer.alloc(0) })).statusCode, 422);
  assert.equal((await app.inject({ method: 'PUT', url: '/admin/tunes/nope/audio', headers: h, payload: M4A })).statusCode, 404);
  assert.equal(uploads.length, 0, 'nothing was uploaded');
});

test('showing a tune without audio is refused; hide takes it out of the catalog', async () => {
  const { app } = make();
  await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: good });
  assert.equal((await app.inject({ method: 'POST', url: '/admin/tunes/mary/show', headers: AUTH })).statusCode, 409);
  await app.inject({ method: 'PUT', url: '/admin/tunes/mary/audio?show=1', headers: { ...AUTH, 'content-type': 'audio/mp4' }, payload: M4A });
  assert.equal((await app.inject({ method: 'POST', url: '/admin/tunes/mary/hide', headers: AUTH })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes.length, 0);
  assert.equal((await app.inject({ method: 'POST', url: '/admin/tunes/nope/hide', headers: AUTH })).statusCode, 404);
});

test('re-levelling a tune changes the catalog; delete removes it', async () => {
  const { app } = make();
  await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: good });
  await app.inject({ method: 'PUT', url: '/admin/tunes/mary/audio?show=1', headers: { ...AUTH, 'content-type': 'audio/mp4' }, payload: M4A });
  await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: JSONH, payload: { ...good, level: 4 } });
  assert.equal((await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes[0].level, 4);
  assert.equal((await app.inject({ method: 'DELETE', url: '/admin/tunes/mary', headers: AUTH })).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes.length, 0);
});

test('a cross-site browser post is refused', async () => {
  const { app } = make();
  const res = await app.inject({ method: 'POST', url: '/admin/tunes/mary', headers: { ...JSONH, origin: 'https://evil.example', host: 'api.example' }, payload: good });
  assert.equal(res.statusCode, 403);
});
