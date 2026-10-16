import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDashboard, sortPosts, windowGain, type PostRow, type SnapshotRow } from './summary.js';
import { emptyMetrics } from './types.js';

const pt = (day: string, value: number) => ({ day, value });

test('windowGain: difference of the snapshot at the end and at the start of the window', () => {
  const s = [pt('2026-10-01', 100), pt('2026-10-08', 160), pt('2026-10-15', 400)];
  assert.equal(windowGain(s, '2026-09-20', '2026-10-08', '2026-10-15'), 240);
});

test('windowGain: unknown when there is no snapshot at the start and the post is older', () => {
  const s = [pt('2026-10-14', 500), pt('2026-10-15', 520)];
  assert.equal(windowGain(s, '2026-09-01', '2026-10-08', '2026-10-15'), null);
});

test('windowGain: a post born inside the window counts from zero', () => {
  const s = [pt('2026-10-12', 300), pt('2026-10-15', 340)];
  assert.equal(windowGain(s, '2026-10-11', '2026-10-08', '2026-10-15'), 340);
});

test('windowGain: a post that did not exist yet in an earlier window gained nothing there', () => {
  const s = [pt('2026-10-12', 300)];
  assert.equal(windowGain(s, '2026-10-11', '2026-09-24', '2026-10-01'), 0);
});

test('windowGain: a counter that went down is clamped to 0', () => {
  assert.equal(windowGain([pt('2026-10-01', 100), pt('2026-10-15', 90)], '2026-09-01', '2026-10-01', '2026-10-15'), 0);
});

const post = (id: string, published: string, platform = 'youtube'): PostRow => ({
  platform,
  externalId: id,
  title: id,
  url: `https://x/${id}`,
  kind: 'short',
  durationS: 14,
  publishedAt: new Date(`${published}T12:00:00Z`),
  videoNo: null,
});
const snap = (id: string, day: string, views: number, platform = 'youtube'): SnapshotRow => ({
  ...emptyMetrics(),
  platform,
  externalId: id,
  day,
  views,
});

test('buildDashboard: platform growth is the sum of post growth, and null if any post is unknown', () => {
  const posts = [post('a', '2026-09-01'), post('b', '2026-10-12')];
  const full = buildDashboard(
    {
      posts,
      snapshots: [snap('a', '2026-10-08', 100), snap('a', '2026-10-15', 150), snap('b', '2026-10-15', 40)],
      accounts: [],
    },
    '2026-10-15',
    7,
  );
  assert.equal(full.platforms[0]!.gain, 90); // a: +50, b: born in window -> 40
  assert.equal(full.platforms[0]!.totalViews, 190);
  assert.equal(full.platforms[0]!.best?.post.externalId, 'a');

  const partial = buildDashboard(
    { posts, snapshots: [snap('a', '2026-10-14', 140), snap('a', '2026-10-15', 150), snap('b', '2026-10-15', 40)], accounts: [] },
    '2026-10-15',
    7,
  );
  assert.equal(partial.platforms[0]!.gain, null); // a has no baseline yet -> do not pretend
  assert.equal(partial.platforms[0]!.totalViews, 190); // lifetime is still known
});

test('buildDashboard: followers delta needs a baseline snapshot', () => {
  const acc = (day: string, followers: number) => ({ platform: 'instagram', day, followers, extra: {} });
  const d = buildDashboard(
    { posts: [], snapshots: [], accounts: [acc('2026-10-08', 70), acc('2026-10-15', 75)] },
    '2026-10-15',
    7,
  );
  assert.equal(d.platforms[0]!.followers, 75);
  assert.equal(d.platforms[0]!.followersDelta, 5);
  const noBase = buildDashboard({ posts: [], snapshots: [], accounts: [acc('2026-10-15', 75)] }, '2026-10-15', 7);
  assert.equal(noBase.platforms[0]!.followersDelta, null);
});

test('sortPosts: known growth first, unknown last by lifetime views', () => {
  const posts = [post('old', '2026-09-01'), post('hot', '2026-10-12'), post('big', '2026-09-02')];
  const d = buildDashboard(
    {
      posts,
      snapshots: [snap('old', '2026-10-15', 10), snap('big', '2026-10-15', 5000), snap('hot', '2026-10-15', 300)],
      accounts: [],
    },
    '2026-10-15',
    7,
  );
  assert.deepEqual(
    sortPosts(d.posts, 'gain').map((v) => v.post.externalId),
    ['hot', 'big', 'old'],
  );
});
