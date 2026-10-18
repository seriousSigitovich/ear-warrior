import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ago, renderPage } from './page.js';
import { applyLabels } from './post-labels.js';
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

const model = (extra: Partial<Parameters<typeof renderPage>[0]> = {}, labels: Record<string, { videoNo?: number; hypothesis?: string; label?: string }> = {}) => {
  const posts = applyLabels(
    [{ platform: 'youtube', externalId: 'v1', title: 'No number here', url: 'https://x/1', kind: 'short', durationS: 9, publishedAt: new Date('2026-09-01T00:00:00Z'), videoNo: null }],
    labels,
  );
  const dashboard = buildDashboard(
    { posts, snapshots: [
        { ...emptyMetrics(), platform: 'youtube', externalId: 'v1', day: '2026-09-25', views: 100 },
        { ...emptyMetrics(), platform: 'youtube', externalId: 'v1', day: '2026-10-15', views: 400 },
      ], accounts: [] },
    '2026-10-15',
    7,
    extra.leads ? extra.leads.counts : null,
  );
  return renderPage({ dashboard, runs: [], configured: { youtube: true, instagram: false }, platformFilter: null, sort: 'gain', now: new Date('2026-10-15T12:00:00Z'), ...extra });
};

test('renderPage shows the mapped number and hypothesis next to a post (T028)', () => {
  const html = model({}, { 'youtube/v1': { videoNo: 24, hypothesis: 'H11' } });
  assert.match(html, /#24 · No number here/);
  assert.match(html, /<span class="tag">H11<\/span>/);
});

test('renderPage labels a gain whose baseline is older than the window with its real span (T035)', () => {
  const html = model();
  assert.match(html, /просмотров за 20 дн \(снимка ровно 7 дн назад нет/);
  assert.match(html, /<small>за 20 дн\*<\/small>/);
});

test('renderPage shows leads by source and per post (T029), and a hint when no store answers', () => {
  const withLeads = model({ leads: { via: 'upstash', counts: [{ source: 'youtube:ear24:desc', count: 3 }, { source: 'landing', count: 1 }] } }, { 'youtube/v1': { videoNo: 24 } });
  assert.match(withLeads, /Лиды · waitlist/);
  assert.match(withLeads, /youtube:ear24:desc/);
  assert.match(withLeads, /3 лида/);
  assert.match(model({ leads: null }), /Источник не подключён/);
});
