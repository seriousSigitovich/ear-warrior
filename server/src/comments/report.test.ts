import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRows, renderInbox, type KeyEntry } from './report.js';
import type { Comment } from './sources.js';

const KEY: KeyEntry[] = [{ videoNo: 65, tune: 'koro', notes: [64, 59, 60, 62, 60, 59, 57, 57], posts: { youtube: 'yt65', instagram: 'ig65' } }];
const c = (over: Partial<Comment>): Comment => ({
  platform: 'youtube', postId: 'yt65', postTitle: 'Tetris', postUrl: 'https://youtu.be/yt65', commentId: 'c', author: 'ann',
  text: '', at: '2026-11-04T10:00:00Z', answered: false, ...over,
});

test('rows: graded by the post id on either platform, no key, not an answer', () => {
  const rows = buildRows(
    [
      c({ text: 'E B C D C B A A' }),
      c({ platform: 'instagram', postId: 'ig65', text: 'E B C D D' }),
      c({ postId: 'old', text: 'C D E F G' }),
      c({ text: 'love it' }),
    ],
    KEY,
  );
  assert.deepEqual(rows.map((r) => r.status), ['correct', 'partial', 'no key', 'no answer']);
  assert.equal(rows[0].videoNo, 65);
  assert.ok(rows[0].reply);
  assert.equal(rows[3].reply, null);
});

test('inbox hides answered threads unless --all', () => {
  const rows = buildRows([c({ text: 'E B C D', author: 'new' }), c({ text: 'E B C D', author: 'done', answered: true })], KEY);
  const md = renderInbox(rows, { all: false, key: KEY, now: new Date('2026-11-05T12:00:00Z'), problems: ['x'] });
  assert.match(md, /new/);
  assert.doesNotMatch(md, /### .*done/);
  assert.match(md, /⚠ x/);
  assert.match(renderInbox(rows, { all: true, key: KEY, now: new Date(), problems: [] }), /done — YT #65 \(koro\) · уже ответили/);
});
