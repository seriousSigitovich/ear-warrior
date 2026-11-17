// Behaviour every TuneStore must have. Run against memory (always) and Postgres (when reachable).
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { TuneInput, TuneStore } from './store.js';

const T0 = new Date('2026-11-16T10:00:00Z');
const T1 = new Date('2026-11-16T11:00:00Z');
const tune = (id: string, level = 1, over: Partial<TuneInput> = {}): TuneInput => ({
  id,
  title: `Tune ${id}`,
  level,
  tempoBpm: 100,
  phrases: [2, 1],
  notes: 'E4:1 D4:1 C4:2',
  ...over,
});
const audio = { url: 'https://blob.example/x.m4a', sha256: 'a'.repeat(64), bytes: 1234 };

export function runTuneContract(name: string, make: () => Promise<TuneStore>, opts: { skip?: string } = {}): void {
  describe(`TuneStore contract: ${name}`, { skip: opts.skip }, () => {
    let s: TuneStore;
    beforeEach(async () => {
      s = await make();
    });

    test('a new tune starts hidden, without audio', async () => {
      const t = await s.upsert(tune('a'), T0);
      assert.equal(t.hidden, true);
      assert.equal(t.audioUrl, null);
      assert.deepEqual((await s.get('a'))?.phrases, [2, 1]);
      assert.equal(await s.get('missing'), null);
    });

    test('upsert changes the fields and keeps audio and visibility', async () => {
      await s.upsert(tune('a'), T0);
      await s.setAudio('a', audio, T0);
      await s.setHidden('a', false, T0);
      const t = await s.upsert(tune('a', 3, { title: 'Renamed', scale: 'C_major', source: 'tradition' }), T1);
      assert.equal(t.title, 'Renamed');
      assert.equal(t.level, 3);
      assert.equal(t.scale, 'C_major');
      assert.equal(t.audioSha256, audio.sha256);
      assert.equal(t.hidden, false);
      assert.equal(t.updatedAt.getTime(), T1.getTime());
    });

    test('upsert without scale or source leaves the stored ones', async () => {
      await s.upsert(tune('a', 1, { scale: 'C_major', source: 'x' }), T0);
      const t = await s.upsert(tune('a'), T1);
      assert.equal(t.scale, 'C_major');
      assert.equal(t.source, 'x');
    });

    test('a tune cannot be shown before it has audio, and can after', async () => {
      await s.upsert(tune('a'), T0);
      assert.equal(await s.setHidden('a', false, T0), null);
      assert.equal((await s.get('a'))?.hidden, true);
      await s.setAudio('a', audio, T0);
      assert.equal((await s.setHidden('a', false, T1))?.hidden, false);
      assert.equal((await s.setHidden('a', true, T1))?.hidden, true);
    });

    test('setAudio and setHidden on an unknown tune answer null', async () => {
      assert.equal(await s.setAudio('nope', audio, T0), null);
      assert.equal(await s.setHidden('nope', true, T0), null);
    });

    test('list: hidden tunes only when asked, easiest level first then by id', async () => {
      for (const [id, level] of [['c', 2], ['b', 1], ['a', 2], ['d', 1]] as const) {
        await s.upsert(tune(id, level), T0);
        await s.setAudio(id, audio, T0);
      }
      await s.setHidden('c', false, T0);
      await s.setHidden('b', false, T0);
      await s.setHidden('a', false, T0);
      assert.deepEqual((await s.list()).map((t) => t.id), ['b', 'a', 'c']);
      assert.deepEqual((await s.list({ includeHidden: true })).map((t) => t.id), ['b', 'd', 'a', 'c']);
    });

    test('replacing the audio changes the fingerprint', async () => {
      await s.upsert(tune('a'), T0);
      await s.setAudio('a', audio, T0);
      const t = await s.setAudio('a', { ...audio, sha256: 'b'.repeat(64), bytes: 99 }, T1);
      assert.equal(t?.audioSha256, 'b'.repeat(64));
      assert.equal(t?.audioBytes, 99);
    });

    test('remove deletes the tune', async () => {
      await s.upsert(tune('a'), T0);
      await s.remove('a');
      assert.equal(await s.get('a'), null);
      await s.remove('a'); // removing again is harmless
    });
  });
}
