import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ago, renderPage } from './page.js';
import { buildDashboard } from './summary.js';
import { emptyMetrics } from './types.js';

test('renderPage escapes titles coming from the platforms', () => {
  const dashboard = buildDashboard(
    {
      posts: [{ platform: 'instagram', externalId: '1', title: '<script>alert(1)</script>', url: 'https://x/"onmouseover="y', kind: 'reel', durationS: null, publishedAt: new Date('2026-10-10T00:00:00Z'), videoNo: null }],
      snapshots: [{ ...emptyMetrics(), platform: 'instagram', externalId: '1', day: '2026-10-15', views: 10 }],
      accounts: [],
    },
    '2026-10-15',
    7,
  );
  const html = renderPage({
    dashboard,
    runs: [{ platform: 'instagram', finishedAt: new Date(), ok: false, posts: null, error: '<img src=x onerror=1>' }],
    configured: { youtube: false, instagram: true },
    platformFilter: null,
    sort: 'gain',
    now: new Date('2026-10-15T12:00:00Z'),
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /href="https:\/\/x\/"onmouseover/);
  assert.match(html, /&lt;script&gt;/);
});

test('renderPage with no data shows the setup hint instead of crashing', () => {
  const html = renderPage({
    dashboard: buildDashboard({ posts: [], snapshots: [], accounts: [] }, '2026-10-15', 7),
    runs: [],
    configured: { youtube: false, instagram: false },
    platformFilter: null,
    sort: 'gain',
    now: new Date(),
  });
  assert.match(html, /Данных пока нет/);
});

test('ago', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  assert.equal(ago(new Date('2026-10-15T11:20:00Z'), now), '40 мин назад');
  assert.equal(ago(new Date('2026-10-15T07:00:00Z'), now), '5 ч назад');
});
