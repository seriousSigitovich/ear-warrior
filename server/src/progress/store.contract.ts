// Behaviour every ProgressStore must have. Run against memory (always) and Postgres (when reachable).
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { RECENT_LIMIT, type MelodyPlace, type ProgressAttempt, type ProgressDifficulty, type ProgressStore } from './store.js';

const T0 = new Date('2026-10-30T10:00:00Z');
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
let n = 0;
const attempt = (tuneId: string, verdict: 'correct' | 'incorrect', sec: number, id = `a${++n}`): ProgressAttempt => ({
  id,
  sessionId: 's_1',
  melodyId: `${tuneId}-1`,
  tuneId,
  verdict,
  confidence: 0.9,
  lowConfidence: false,
  timedOut: false,
  inputMode: 'fretboard',
  noteResults: [{ status: 'matched' }],
  createdAt: at(sec),
});
const place = (tuneId: string, phrase: number, sec: number, over: Partial<MelodyPlace> = {}): MelodyPlace => ({
  tuneId,
  phrase,
  phrases: 5,
  grades: [{ note_results: [{ status: 'matched' }], answer: [64, 62] }],
  updatedAt: at(sec),
  ...over,
});
const difficulty: ProgressDifficulty = { mode: 'adaptive', adaptiveRank: 3, fixedRank: 1, streakKind: 'correct', streakCount: 2 };

/** `make` returns a fresh store and a way to create accounts (Postgres rows reference `users`). */
export function runProgressContract(
  name: string,
  make: () => Promise<{ store: ProgressStore; newUser: () => Promise<string> }>,
  opts: { skip?: string } = {},
): void {
  describe(`ProgressStore contract: ${name}`, { skip: opts.skip }, () => {
    let s: ProgressStore;
    let user: () => Promise<string>;
    beforeEach(async () => {
      ({ store: s, newUser: user } = await make());
    });

    test('history: mastered tunes once each, recent tunes oldest first, whatever order they arrive in', async () => {
      const u = await user();
      await s.addAttempt(u, attempt('b', 'incorrect', 20));
      await s.addAttempt(u, attempt('a', 'correct', 10));
      await s.addAttempt(u, attempt('a', 'correct', 30));
      assert.deepEqual(await s.history(u), { mastered: ['a'], recent: ['a', 'b', 'a'] });
    });

    test('an attempt id the account already has is stored once', async () => {
      const u = await user();
      await s.addAttempt(u, attempt('a', 'correct', 10, 'same'));
      await s.addAttempt(u, attempt('a', 'correct', 10, 'same'));
      assert.deepEqual((await s.history(u)).recent, ['a']);
    });

    test('recent keeps only the latest attempts', async () => {
      const u = await user();
      for (let i = 0; i < RECENT_LIMIT + 3; i++) await s.addAttempt(u, attempt(i < 3 ? 'old' : 'new', 'incorrect', i));
      const { recent } = await s.history(u);
      assert.equal(recent.length, RECENT_LIMIT);
      assert.ok(!recent.includes('old'));
    });

    test('accounts are separate, and may reuse the same attempt id', async () => {
      const a = await user();
      const b = await user();
      await s.addAttempt(a, attempt('a', 'correct', 10, 'shared'));
      await s.addAttempt(b, attempt('b', 'incorrect', 10, 'shared'));
      assert.deepEqual(await s.history(a), { mastered: ['a'], recent: ['a'] });
      assert.deepEqual(await s.history(b), { mastered: [], recent: ['b'] });
    });

    test('melody places: none until put, then the latest write wins', async () => {
      const u = await user();
      assert.deepEqual(await s.listMelodies(u), []);
      assert.equal(await s.putMelody(u, place('hotcrossbuns', 1, 10)), true);
      assert.equal(await s.putMelody(u, place('hotcrossbuns', 3, 20)), true);
      assert.deepEqual(await s.listMelodies(u), [place('hotcrossbuns', 3, 20)]);
    });

    test('a stale write (older than what is stored) is ignored, an equal one is accepted', async () => {
      const u = await user();
      await s.putMelody(u, place('a', 3, 30));
      assert.equal(await s.putMelody(u, place('a', 1, 10)), false);
      assert.equal((await s.listMelodies(u))[0].phrase, 3);
      assert.equal(await s.putMelody(u, place('a', 4, 30)), true);
      assert.equal((await s.listMelodies(u))[0].phrase, 4);
    });

    test('deleting a place removes it; the delete is remembered so an older write cannot bring it back', async () => {
      const u = await user();
      await s.putMelody(u, place('a', 2, 10));
      await s.putMelody(u, place('b', 2, 10));
      await s.deleteMelody(u, 'a', at(20));
      assert.deepEqual((await s.listMelodies(u)).map((p) => p.tuneId), ['b']);
      assert.equal(await s.putMelody(u, place('a', 1, 15)), false);
      assert.deepEqual((await s.listMelodies(u)).map((p) => p.tuneId), ['b']);
      // a newer start of the melody is a new place
      assert.equal(await s.putMelody(u, place('a', 1, 40)), true);
      assert.deepEqual((await s.listMelodies(u)).map((p) => p.tuneId).sort(), ['a', 'b']);
    });

    test('a delete older than the stored place is ignored', async () => {
      const u = await user();
      await s.putMelody(u, place('a', 2, 30));
      await s.deleteMelody(u, 'a', at(10));
      assert.equal((await s.listMelodies(u)).length, 1);
    });

    test('melody places belong to one account', async () => {
      const a = await user();
      const b = await user();
      await s.putMelody(a, place('x', 2, 10));
      assert.deepEqual(await s.listMelodies(b), []);
      await s.deleteMelody(b, 'x', at(50));
      assert.equal((await s.listMelodies(a)).length, 1);
    });

    test('difficulty: none until put, then replaced by each put', async () => {
      const u = await user();
      assert.equal(await s.getDifficulty(u), null);
      await s.putDifficulty(u, difficulty, T0);
      assert.deepEqual(await s.getDifficulty(u), difficulty);
      await s.putDifficulty(u, { ...difficulty, adaptiveRank: 5, streakKind: 'none', streakCount: 0 }, at(60));
      assert.deepEqual(await s.getDifficulty(u), { ...difficulty, adaptiveRank: 5, streakKind: 'none', streakCount: 0 });
    });
  });
}
