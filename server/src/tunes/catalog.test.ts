import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCatalog } from './catalog.js';
import { createMemoryTuneStore } from './memoryStore.js';

const T0 = new Date('2026-11-16T10:00:00Z');
const audio = (n: string) => ({ url: `https://blob.example/${n}.m4a`, sha256: n.repeat(64).slice(0, 64), bytes: 10 });

async function store() {
  const s = createMemoryTuneStore();
  for (const [id, level] of [['b', 2], ['a', 1], ['c', 1], ['hid', 1], ['z', 3]] as const) {
    await s.upsert({ id, title: id, level, tempoBpm: 100, phrases: [2, 1], notes: 'E4:1 D4:1 C4:2' }, T0);
    await s.setAudio(id, audio(id === 'hid' ? 'd' : id === 'z' ? 'e' : id.slice(0, 1) === 'a' ? 'a' : id.slice(0, 1) === 'b' ? 'b' : 'c'), T0);
  }
  for (const id of ['a', 'b', 'c', 'z']) await s.setHidden(id, false, T0);
  return s;
}

test('lists visible tunes by level then id and never carries the answer notes', async () => {
  const c = buildCatalog(await (await store()).list({ includeHidden: true }));
  assert.deepEqual(c.tunes.map((t) => t.id), ['a', 'c', 'b', 'z']);
  assert.ok(!JSON.stringify(c).includes('E4:1'), 'the answer notes must not be in the catalog');
  assert.ok(c.tunes.every((t) => !('notes' in t)));
  const hard = c.tunes.find((t) => t.id === 'z')!;
  assert.deepEqual(Object.keys(hard).sort(), ['audio_bytes', 'audio_sha256', 'audio_url', 'beats', 'id', 'level', 'moves', 'phrases', 'scale', 'tempo_bpm', 'title']);
});

test('the rhythm is there, one length per note, and only the rhythm', async () => {
  const c = buildCatalog(await (await store()).list({ includeHidden: true }));
  assert.deepEqual(c.tunes[0].beats, [1, 1, 2]);
  assert.equal(c.tunes[0].beats.length, c.tunes[0].phrases.reduce((a, b) => a + b, 0));
});

test('the etag changes when the audio fingerprint or the level changes, not otherwise', async () => {
  const s = await store();
  const before = buildCatalog(await s.list()).etag;
  assert.equal(buildCatalog(await s.list()).etag, before);
  await s.setAudio('a', { url: 'https://blob.example/a2.m4a', sha256: 'e'.repeat(64), bytes: 11 }, T0);
  const afterAudio = buildCatalog(await s.list()).etag;
  assert.notEqual(afterAudio, before);
  await s.upsert({ id: 'a', title: 'a', level: 3, tempoBpm: 100, phrases: [2, 1], notes: 'E4:1 D4:1 C4:2' }, T0);
  assert.notEqual(buildCatalog(await s.list()).etag, afterAudio);
});

test('the answer is in the catalog for levels 1–2 only, so the app can grade those itself and a new learner plays at once', async () => {
  const c = buildCatalog(await (await store()).list({ includeHidden: true }));
  for (const id of ['a', 'b', 'c']) assert.deepEqual(c.tunes.find((t) => t.id === id)!.answer, [64, 62, 60], id);
  assert.equal('answer' in c.tunes.find((t) => t.id === 'z')!, false, 'level 3 and up: the server grades alone');
});
