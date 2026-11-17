// GET /api/melodies (spec 024): the catalog without answers, through Fastify's inject.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { createMemoryTuneStore } from '../tunes/memoryStore.js';
import { seedTunes } from '../tunes/seed.js';

const T0 = new Date('2026-11-16T10:00:00Z');
async function make() {
  const tunes = createMemoryTuneStore();
  await seedTunes(tunes, T0);
  for (const id of ['hotcrossbuns', 'mary', 'twinkle']) {
    await tunes.setAudio(id, { url: `https://blob.example/${id}.m4a`, sha256: id.charAt(0).repeat(64), bytes: 1000 }, T0);
    await tunes.setHidden(id, false, T0);
  }
  return { tunes, app: buildApp({ logger: false, tunes }) };
}

test('lists the visible tunes without notes, no login needed', async () => {
  const { app } = await make();
  const res = await app.inject({ method: 'GET', url: '/api/melodies' });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.tunes.map((t: { id: string }) => t.id).sort(), ['hotcrossbuns', 'mary', 'twinkle']);
  assert.ok(!res.body.includes('"notes"'), 'no notes field');
  assert.ok(!/[A-G][#b]?\d:\d/.test(res.body), 'no note tokens anywhere in the response');
  assert.match(res.headers.etag as string, /^"[0-9a-f]{16}"$/);
  assert.equal(body.etag, JSON.parse(res.headers.etag as string));
});

test('hidden tunes and tunes without audio are not offered', async () => {
  const { app, tunes } = await make();
  await tunes.setHidden('mary', true, T0);
  const ids = (await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes.map((t: { id: string }) => t.id);
  assert.ok(!ids.includes('mary'));
  assert.ok(!ids.includes('london'), 'seeded without audio, never shown');
});

test('If-None-Match with the current etag answers 304 and a changed catalog answers 200', async () => {
  const { app, tunes } = await make();
  const first = await app.inject({ method: 'GET', url: '/api/melodies' });
  const etag = first.headers.etag as string;
  const same = await app.inject({ method: 'GET', url: '/api/melodies', headers: { 'if-none-match': etag } });
  assert.equal(same.statusCode, 304);
  await tunes.setAudio('mary', { url: 'https://blob.example/m2.m4a', sha256: 'e'.repeat(64), bytes: 5 }, T0);
  const changed = await app.inject({ method: 'GET', url: '/api/melodies', headers: { 'if-none-match': etag } });
  assert.equal(changed.statusCode, 200);
  assert.notEqual(changed.headers.etag, etag);
});

test('a store failure answers 502 and leaks nothing', async () => {
  const tunes = createMemoryTuneStore();
  tunes.list = async () => {
    throw new Error('db down');
  };
  const res = await buildApp({ logger: false, tunes }).inject({ method: 'GET', url: '/api/melodies' });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { ok: false, error: 'store_failed' });
});

test('only levels 1–2 carry their answer: the app grades those itself, every other tune is graded by the server alone', async () => {
  const { app, tunes } = await make();
  await tunes.setAudio('nocturne', { url: 'https://blob.example/nocturne.m4a', sha256: 'n'.repeat(64), bytes: 1000 }, T0);
  await tunes.setHidden('nocturne', false, T0);
  const list = (await app.inject({ method: 'GET', url: '/api/melodies' })).json().tunes as { id: string; answer?: number[]; phrases: number[] }[];
  for (const t of list.filter((x) => x.id !== 'nocturne')) assert.equal(t.answer?.length, t.phrases.reduce((a, b) => a + b, 0), t.id);
  assert.equal('answer' in list.find((t) => t.id === 'nocturne')!, false);
});
