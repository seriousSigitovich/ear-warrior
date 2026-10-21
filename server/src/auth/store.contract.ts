// Behaviour every AuthStore must have. Run against memory (always) and Postgres (when reachable).
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { AuthStore } from './store.js';

const T0 = new Date('2026-10-21T12:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const DEV = 'dev_00000000000000000000000000000001';
const DEV2 = 'dev_00000000000000000000000000000002';

export function runStoreContract(name: string, make: () => Promise<AuthStore>, opts: { skip?: string } = {}): void {
  describe(`AuthStore contract: ${name}`, { skip: opts.skip }, () => {
    let s: AuthStore;
    beforeEach(async () => {
      s = await make();
    });

    const issue = (email = 'a@x.co', hash = 'h1', now = T0, source = 'src1') =>
      s.issueCode({ email, codeHash: hash, sourceHash: source, now, expiresAt: new Date(now.getTime() + 600_000) });
    const signIn = (email: string, deviceId: string, tokenHash: string, now: Date) => s.signIn({ email, deviceId, tokenHash, now });

    test('a newer code supersedes the older one; latestCode is the newest', async () => {
      const first = await issue('a@x.co', 'h1', T0);
      const second = await issue('a@x.co', 'h2', at(2));
      const latest = await s.latestCode('a@x.co');
      assert.equal(latest?.id, second);
      assert.equal(latest?.supersededAt, null);
      assert.equal(await s.takeAttempt(first, 5), null, 'superseded code takes no attempts');
      assert.equal(await s.latestCode('nobody@x.co'), null);
    });

    test('requestTimes reports requests per address and per source inside the window', async () => {
      await issue('a@x.co', 'h1', at(0), 'srcA');
      await issue('a@x.co', 'h2', at(5), 'srcB');
      await issue('b@x.co', 'h3', at(6), 'srcA');
      const r = await s.requestTimes('a@x.co', 'srcA', at(1));
      assert.deepEqual(r.email.map((d) => d.getTime()), [at(5).getTime()]);
      assert.deepEqual(r.source.map((d) => d.getTime()), [at(6).getTime()]);
    });

    test('a discarded code leaves no trace in the request log', async () => {
      const id = await issue();
      await s.discardCode(id);
      assert.equal(await s.latestCode('a@x.co'), null);
      assert.deepEqual((await s.requestTimes('a@x.co', 'src1', at(-10))).email, []);
    });

    test('takeAttempt counts up to the max and then refuses; a used code takes none', async () => {
      const id = await issue();
      for (let n = 1; n <= 5; n++) assert.equal(await s.takeAttempt(id, 5), n);
      assert.equal(await s.takeAttempt(id, 5), null);
      const id2 = await issue('a@x.co', 'h2', at(2));
      assert.equal(await s.consumeCode(id2, at(3)), true);
      assert.equal(await s.takeAttempt(id2, 5), null);
    });

    test('concurrent attempts never exceed the max', async () => {
      const id = await issue();
      const results = await Promise.all(Array.from({ length: 20 }, () => s.takeAttempt(id, 5)));
      assert.equal(results.filter((r) => r !== null).length, 5);
    });

    test('a code is consumed exactly once, even under a race', async () => {
      const id = await issue();
      const results = await Promise.all([s.consumeCode(id, at(1)), s.consumeCode(id, at(1)), s.consumeCode(id, at(1))]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.notEqual((await s.latestCode('a@x.co'))?.usedAt, null);
    });

    test('purgeCodesBefore deletes old codes only', async () => {
      await issue('a@x.co', 'h1', at(-60 * 30));
      await issue('b@x.co', 'h2', at(0));
      await s.purgeCodesBefore(at(-60));
      assert.equal(await s.latestCode('a@x.co'), null);
      assert.notEqual(await s.latestCode('b@x.co'), null);
    });

    test('signIn creates the account once, then signs the same one in again', async () => {
      const first = await signIn('a@x.co', DEV, 'tok1', at(0));
      const again = await signIn('a@x.co', DEV2, 'tok2', at(1));
      assert.equal(first.created, true);
      assert.equal(again.created, false);
      assert.equal(again.userId, first.userId);
      assert.deepEqual(await s.sessionByToken('tok1'), { userId: first.userId, email: 'a@x.co', deviceId: DEV });
      assert.deepEqual(await s.sessionByToken('tok2'), { userId: first.userId, email: 'a@x.co', deviceId: DEV2 });
      assert.equal(await s.sessionByToken('nope'), null);
    });

    test('attribution follows the links: before sign-in, during, after sign-out (FR-011/012)', async () => {
      assert.equal(await s.attributedEmail(DEV, at(0)), null, 'no link at all -> anonymous');
      await signIn('a@x.co', DEV, 'tok1', at(10));
      assert.equal(await s.attributedEmail(DEV, at(5)), 'a@x.co', 'event before the first sign-in');
      assert.equal(await s.attributedEmail(DEV, at(15)), 'a@x.co', 'event while signed in');
      await s.signOut('tok1', at(20));
      assert.equal(await s.attributedEmail(DEV, at(25)), null, 'event after sign-out is anonymous');
      assert.equal(await s.attributedEmail(DEV, at(15)), 'a@x.co', 'earlier events keep the email');
      await signIn('a@x.co', DEV, 'tok3', at(30));
      assert.equal(await s.attributedEmail(DEV, at(35)), 'a@x.co');
      assert.equal(await s.attributedEmail(DEV, at(25)), null, 'the gap stays anonymous');
    });

    test('two people on one phone: each is attributed while signed in', async () => {
      await signIn('a@x.co', DEV, 'tokA', at(10));
      await signIn('b@x.co', DEV, 'tokB', at(20));
      assert.equal(await s.attributedEmail(DEV, at(15)), 'a@x.co');
      assert.equal(await s.attributedEmail(DEV, at(25)), 'b@x.co');
      assert.equal(await s.attributedEmail(DEV, at(5)), 'a@x.co', 'pre-sign-in events belong to the first person');
    });

    test('signing in again as the same person does not open a gap', async () => {
      await signIn('a@x.co', DEV, 'tok1', at(10));
      await signIn('a@x.co', DEV, 'tok2', at(20));
      assert.equal(await s.attributedEmail(DEV, at(19)), 'a@x.co');
      assert.equal(await s.attributedEmail(DEV, at(21)), 'a@x.co');
    });

    test('signOut revokes the session and is idempotent; unknown tokens are a no-op', async () => {
      await signIn('a@x.co', DEV, 'tok1', at(0));
      await s.signOut('tok1', at(1));
      await s.signOut('tok1', at(2));
      await s.signOut('never-issued', at(2));
      assert.equal(await s.sessionByToken('tok1'), null);
    });

    test('signing out an old session does not close the link of the person now signed in on the device', async () => {
      await signIn('a@x.co', DEV, 'tokA', at(10));
      await signIn('b@x.co', DEV, 'tokB', at(20));
      await s.signOut('tokA', at(30));
      assert.equal(await s.attributedEmail(DEV, at(35)), 'b@x.co');
    });

    test('deleteUser removes sessions, links and the address codes; attribution goes anonymous (FR-015)', async () => {
      const { userId } = await signIn('a@x.co', DEV, 'tok1', at(0));
      await issue('a@x.co', 'h1', at(1));
      await s.deleteUser(userId);
      assert.equal(await s.sessionByToken('tok1'), null);
      assert.equal(await s.latestCode('a@x.co'), null);
      assert.equal(await s.attributedEmail(DEV, at(5)), null);
      const fresh = await signIn('a@x.co', DEV, 'tok9', at(10));
      assert.equal(fresh.created, true);
      assert.notEqual(fresh.userId, userId);
    });

    test('deleteUserByEmail finds the account or reports there is none', async () => {
      await signIn('a@x.co', DEV, 'tok1', at(0));
      assert.equal(await s.deleteUserByEmail('nobody@x.co'), false);
      assert.equal(await s.deleteUserByEmail('a@x.co'), true);
      assert.equal(await s.sessionByToken('tok1'), null);
    });
  });
}
