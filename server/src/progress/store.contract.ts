// Behaviour every ProgressStore must have. Run against memory (always) and Postgres (when reachable).
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { RECENT_LIMIT, type GameRowInput, type MelodyPlace, type ProgressAttempt, type ProgressDifficulty, type ProgressStore } from './store.js';

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
const award = (id: string, xp = 10): GameRowInput => ({ kind: 'award', id, data: { id, kind: 'phrase', xp, day: '2026-11-12', at: T0.toISOString() } });
const completion = (id: string): GameRowInput => ({
  kind: 'completion',
  id,
  data: { id, melodyId: 'a-1', level: 'L1', accuracy: 90, hintsUsed: 0, completedAt: T0.toISOString(), day: '2026-11-12' },
});
const mastery = (level: string, sec: number): GameRowInput => ({ kind: 'mastery', id: level, data: { id: level, level, achievedAt: at(sec).toISOString() } });
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

    test('game rows: read back after a cursor, in the order they arrived, with their kind and data', async () => {
      const u = await user();
      await s.putGameRows(u, [award('phrase:a-1:0', 10), completion('att1')]);
      await s.putGameRows(u, [award('phrase:a-1:1', 15)]);
      const first = await s.gameRowsAfter(u, 0, 100);
      assert.deepEqual(first.rows.map((r) => [r.kind, r.id]), [['award', 'phrase:a-1:0'], ['completion', 'att1'], ['award', 'phrase:a-1:1']]);
      assert.equal(first.more, false);
      assert.deepEqual(first.rows[0].data, award('phrase:a-1:0').data);
      assert.ok(first.rows[0].seq < first.rows[1].seq && first.rows[1].seq < first.rows[2].seq);
      assert.equal(first.next, first.rows[2].seq);
      const later = await s.gameRowsAfter(u, first.rows[1].seq, 100);
      assert.deepEqual(later.rows.map((r) => r.id), ['phrase:a-1:1']);
      assert.deepEqual((await s.gameRowsAfter(u, first.next, 100)).rows, []);
    });

    test('a row stored again changes nothing: not its data, not its place in the order', async () => {
      const u = await user();
      await s.putGameRows(u, [award('x', 10)]);
      await s.putGameRows(u, [award('x', 99)]);
      const { rows } = await s.gameRowsAfter(u, 0, 100);
      assert.equal(rows.length, 1);
      assert.equal((rows[0].data as { xp: number }).xp, 10);
    });

    test('mastery keeps the earlier date, whichever device sends it first', async () => {
      const u = await user();
      await s.putGameRows(u, [mastery('L1', 50)]);
      await s.putGameRows(u, [mastery('L1', 90)]);
      assert.equal(((await s.gameRowsAfter(u, 0, 10)).rows[0].data as { achievedAt: string }).achievedAt, at(50).toISOString());
      await s.putGameRows(u, [mastery('L1', 20)]);
      const { rows } = await s.gameRowsAfter(u, 0, 10);
      assert.equal(rows.length, 1);
      assert.equal((rows[0].data as { achievedAt: string }).achievedAt, at(20).toISOString());
    });

    test('game rows come in pages: a limit, whether more follow, and where to continue', async () => {
      const u = await user();
      await s.putGameRows(u, Array.from({ length: 5 }, (_, i) => award(`r${i}`)));
      const p1 = await s.gameRowsAfter(u, 0, 2);
      assert.deepEqual([p1.rows.length, p1.more], [2, true]);
      const p2 = await s.gameRowsAfter(u, p1.next, 2);
      assert.deepEqual([p2.rows.map((r) => r.id), p2.more], [['r2', 'r3'], true]);
      const p3 = await s.gameRowsAfter(u, p2.next, 2);
      assert.deepEqual([p3.rows.map((r) => r.id), p3.more], [['r4'], false]);
    });

    test('game rows belong to one account', async () => {
      const a = await user();
      const b = await user();
      await s.putGameRows(a, [award('shared'), mastery('L1', 5)]);
      await s.putGameRows(b, [award('shared', 99)]);
      assert.equal((await s.gameRowsAfter(a, 0, 10)).rows.length, 2);
      const mine = (await s.gameRowsAfter(b, 0, 10)).rows;
      assert.equal(mine.length, 1);
      assert.equal((mine[0].data as { xp: number }).xp, 99);
    });

    test('attempts come back after a cursor in the order they arrived, with their note results', async () => {
      const u = await user();
      await s.addAttempt(u, attempt('a', 'correct', 30, 'later-one'));
      await s.addAttempt(u, attempt('b', 'incorrect', 10, 'earlier-one'));
      await s.addAttempt(u, attempt('c', 'correct', 20, 'third'));
      const page = await s.attemptsAfter(u, 0, 2);
      assert.deepEqual(page.attempts.map((a) => a.id), ['later-one', 'earlier-one']); // arrival, not created_at
      assert.equal(page.more, true);
      assert.deepEqual(page.attempts[0].noteResults, [{ status: 'matched' }]);
      assert.equal(page.attempts[0].tuneId, 'a');
      const rest = await s.attemptsAfter(u, page.next, 2);
      assert.deepEqual([rest.attempts.map((a) => a.id), rest.more], [['third'], false]);
    });

    test('attempts after a cursor belong to one account, and a repeated attempt is one', async () => {
      const a = await user();
      const b = await user();
      await s.addAttempt(a, attempt('x', 'correct', 10, 'same'));
      await s.addAttempt(a, attempt('x', 'correct', 10, 'same'));
      await s.addAttempt(b, attempt('y', 'incorrect', 10, 'other'));
      assert.deepEqual((await s.attemptsAfter(a, 0, 10)).attempts.map((x) => x.id), ['same']);
      assert.deepEqual((await s.attemptsAfter(b, 0, 10)).attempts.map((x) => x.id), ['other']);
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
