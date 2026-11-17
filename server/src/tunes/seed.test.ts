import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TUNES } from './library.data.js';
import { createMemoryTuneStore } from './memoryStore.js';
import { seedTunes } from './seed.js';
import { validateTuneInput } from './validate.js';

test('all 100 library tunes load, equal to the app library, hidden and without audio', async () => {
  const s = createMemoryTuneStore();
  assert.deepEqual(await seedTunes(s), { tunes: 100 });
  const all = await s.list({ includeHidden: true });
  assert.equal(all.length, 100);
  for (const lib of TUNES) {
    const t = await s.get(lib.id);
    assert.ok(t, lib.id);
    assert.equal(t.title, lib.title);
    assert.equal(t.level, lib.rank);
    assert.equal(t.tempoBpm, lib.tempoBpm);
    assert.deepEqual(t.phrases, [...lib.phrases]);
    assert.equal(t.notes, lib.notes);
    assert.equal(t.source, lib.source);
    assert.equal(t.hidden, true);
    assert.equal(t.audioUrl, null);
  }
});

test('every library tune passes the owner-input validation (phrases add up, notes on the fretboard)', () => {
  for (const t of TUNES) {
    assert.deepEqual(
      validateTuneInput({ id: t.id, title: t.title, level: t.rank, tempoBpm: t.tempoBpm, phrases: [...t.phrases], notes: t.notes }),
      [],
      t.id,
    );
  }
});

test('seeding twice changes nothing and keeps audio and visibility', async () => {
  const s = createMemoryTuneStore();
  await seedTunes(s);
  await s.setAudio('mary', { url: 'https://blob.example/mary.m4a', sha256: 'a'.repeat(64), bytes: 5 }, new Date());
  await s.setHidden('mary', false, new Date());
  await seedTunes(s);
  const mary = await s.get('mary');
  assert.equal(mary?.hidden, false);
  assert.equal(mary?.audioSha256, 'a'.repeat(64));
  assert.equal((await s.list({ includeHidden: true })).length, 100);
});
