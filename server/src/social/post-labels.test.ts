import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyLabels } from './post-labels.js';

const row = (platform: string, externalId: string, videoNo: number | null = null) => ({
  platform, externalId, title: 'Caption:', url: '', kind: 'reel', durationS: null, publishedAt: new Date('2026-10-10T00:00:00Z'), videoNo,
});

test('applyLabels: the manual map wins over a parsed number, other posts are untouched', () => {
  const out = applyLabels([row('instagram', '1', 3), row('instagram', '2')], { 'instagram/1': { videoNo: 44, hypothesis: 'H16' } });
  assert.equal(out[0]!.videoNo, 44);
  assert.equal(out[0]!.hypothesis, 'H16');
  assert.equal(out[1]!.videoNo, null);
  assert.equal(out[1]!.hypothesis, undefined);
});
