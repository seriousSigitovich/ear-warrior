// Collectors against a scripted fake `fetch`: no network, no credentials. The fixtures follow the
// documented response shapes of the YouTube Data/Analytics APIs and the Instagram Graph API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrubUrl } from './http.js';
import { instagram } from './instagram.js';
import { parseVideoNo, type CollectorContext, type TokenStore } from './types.js';
import { parseIsoDuration, youtube } from './youtube.js';

type Handler = (url: URL, init?: RequestInit) => unknown;

function fakeFetch(routes: [RegExp, Handler][]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    for (const [re, h] of routes) {
      if (re.test(url.origin + url.pathname)) {
        const out = h(url, init);
        if (out instanceof Response) return out;
        return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
    return new Response(JSON.stringify({ error: { message: `no route for ${url.pathname}` } }), { status: 404 });
  }) as typeof fetch;
}

const memTokens = (): TokenStore & { saved: Map<string, { value: string; expiresAt: Date | null }> } => {
  const saved = new Map<string, { value: string; expiresAt: Date | null }>();
  return {
    saved,
    get: async (p) => saved.get(p) ?? null,
    set: async (p, value, expiresAt) => void saved.set(p, { value, expiresAt }),
  };
};

const NOW = new Date('2026-10-16T10:00:00Z');
const ctx = (fetchFn: typeof fetch, env: Record<string, string>, tokens = memTokens()): CollectorContext => ({
  fetchFn,
  env,
  tokens,
  now: () => NOW,
});

test('parseIsoDuration', () => {
  assert.equal(parseIsoDuration('PT14S'), 14);
  assert.equal(parseIsoDuration('PT1M3S'), 63);
  assert.equal(parseIsoDuration('PT1H2M'), 3720);
  assert.equal(parseIsoDuration(undefined), null);
});

test('parseVideoNo: only real challenge numbers, not hashtags', () => {
  assert.equal(parseVideoNo('EAR CHALLENGE #12 — Twinkle'), 12);
  assert.equal(parseVideoNo('ear-challenge-26'), 26);
  assert.equal(parseVideoNo('#7 hook test'), 7);
  assert.equal(parseVideoNo('Can you play this by ear? #shorts #guitar'), null);
});

test('scrubUrl hides tokens', () => {
  assert.equal(scrubUrl('https://x/y?fields=id&access_token=SECRET&a=1'), 'https://x/y?fields=id&access_token=***&a=1');
});

test('youtube: merges Data API counters with Analytics watch behaviour', async () => {
  const f = fakeFetch([
    [/oauth2\.googleapis\.com\/token$/, () => ({ access_token: 'at' })],
    [/youtube\/v3\/channels$/, () => ({ items: [{ statistics: { subscriberCount: '3' }, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] })],
    [/youtube\/v3\/playlistItems$/, () => ({ items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] })],
    [
      /youtube\/v3\/videos$/,
      () => ({
        items: [
          { id: 'v1', snippet: { title: 'EAR CHALLENGE #12', publishedAt: '2026-10-05T10:00:00Z' }, contentDetails: { duration: 'PT14S' }, statistics: { viewCount: '1143', likeCount: '9', commentCount: '5' } },
          { id: 'v2', snippet: { title: 'Fresh one', publishedAt: '2026-10-15T10:00:00Z' }, contentDetails: { duration: 'PT10S' }, statistics: { viewCount: '12' } },
        ],
      }),
    ],
    [
      /youtubeanalytics\.googleapis\.com\/v2\/reports$/,
      () => ({
        columnHeaders: [{ name: 'video' }, { name: 'views' }, { name: 'shares' }, { name: 'subscribersGained' }, { name: 'averageViewDuration' }, { name: 'averageViewPercentage' }],
        rows: [['v1', 1100, 4, 1, 9.5, 68.1]],
      }),
    ],
  ]);
  const r = await youtube.collect(ctx(f, { YT_CLIENT_ID: 'a', YT_CLIENT_SECRET: 'b', YT_REFRESH_TOKEN: 'c' }));
  assert.equal(r.account.followers, 3);
  assert.equal(r.posts.length, 2);
  const v1 = r.posts.find((p) => p.info.externalId === 'v1')!;
  assert.equal(v1.info.videoNo, 12);
  assert.equal(v1.info.kind, 'short');
  assert.equal(v1.metrics.views, 1143); // Data API wins for views (fresher)
  assert.equal(v1.metrics.likes, 9);
  assert.equal(v1.metrics.shares, 4);
  assert.equal(v1.metrics.avgWatchS, 9.5);
  assert.equal(v1.metrics.avgWatchPct, 68.1);
  const v2 = r.posts.find((p) => p.info.externalId === 'v2')!;
  assert.equal(v2.metrics.avgWatchS, null); // not in analytics yet -> unknown, not 0
  assert.equal(v2.metrics.likes, null);
});

test('youtube: analytics failure still stores the public counters', async () => {
  const f = fakeFetch([
    [/oauth2\.googleapis\.com\/token$/, () => ({ access_token: 'at' })],
    [/youtube\/v3\/channels$/, () => ({ items: [{ statistics: {}, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] })],
    [/youtube\/v3\/playlistItems$/, () => ({ items: [{ contentDetails: { videoId: 'v1' } }] })],
    [/youtube\/v3\/videos$/, () => ({ items: [{ id: 'v1', snippet: { title: 't', publishedAt: '2026-10-05T10:00:00Z' }, contentDetails: { duration: 'PT14S' }, statistics: { viewCount: '7' } }] })],
    [/youtubeanalytics/, () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 403 })],
  ]);
  const r = await youtube.collect(ctx(f, { YT_CLIENT_ID: 'a', YT_CLIENT_SECRET: 'b', YT_REFRESH_TOKEN: 'c' }));
  assert.equal(r.posts[0]!.metrics.views, 7);
});

test('youtube: a rejected refresh token gives a readable error without secrets', async () => {
  const f = fakeFetch([[/oauth2\.googleapis\.com\/token$/, () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }), { status: 400 })]]);
  await assert.rejects(
    youtube.collect(ctx(f, { YT_CLIENT_ID: 'a', YT_CLIENT_SECRET: 'b', YT_REFRESH_TOKEN: 'c' })),
    /Token has been expired or revoked/,
  );
});

test('instagram: reels get views/reach/saves/watch time, token is refreshed and persisted', async () => {
  const tokens = memTokens();
  const f = fakeFetch([
    [/graph\.instagram\.com\/refresh_access_token$/, () => ({ access_token: 'NEW', expires_in: 5_184_000 })],
    [/\/me$/, () => ({ username: 'earwarrior', followers_count: 75, media_count: 2 })],
    [
      /\/me\/media$/,
      () => ({
        data: [
          { id: '1', caption: 'EAR CHALLENGE #20\nmore text', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/a/', timestamp: '2026-10-10T10:00:00+0000', like_count: 12, comments_count: 3 },
        ],
      }),
    ],
    [
      /\/1\/insights$/,
      () => ({
        data: [
          { name: 'views', values: [{ value: 1518 }] },
          { name: 'reach', values: [{ value: 1200 }] },
          { name: 'saved', values: [{ value: 10 }] },
          { name: 'shares', values: [{ value: 2 }] },
          { name: 'ig_reels_avg_watch_time', values: [{ value: 4920 }] },
          { name: 'follows', values: [{ value: 2 }] },
          { name: 'profile_visits', values: [{ value: 8 }] },
        ],
      }),
    ],
    [
      /\/me\/insights$/,
      () => ({ data: [{ name: 'profile_views', total_value: { value: 44 } }, { name: 'website_clicks', total_value: { value: 5 } }] }),
    ],
  ]);
  const r = await instagram.collect(ctx(f, { IG_ACCESS_TOKEN: 'OLD' }, tokens));
  assert.equal(tokens.saved.get('instagram')?.value, 'NEW');
  assert.equal(r.account.followers, 75);
  assert.deepEqual(r.account.extra, { profile_views_28d: 44, website_clicks_28d: 5 });
  const p = r.posts[0]!;
  assert.equal(p.info.videoNo, 20);
  assert.equal(p.info.title, 'EAR CHALLENGE #20');
  assert.equal(p.info.kind, 'reel');
  assert.equal(p.metrics.views, 1518);
  assert.equal(p.metrics.saves, 10);
  assert.equal(p.metrics.avgWatchS, 4.92); // API gives milliseconds
  assert.equal(p.metrics.likes, 12);
  assert.equal(p.metrics.profileVisits, 8);
});

test('instagram: a metric Meta rejects for one media is left null, the rest survive', async () => {
  const f = fakeFetch([
    [/refresh_access_token$/, () => ({ access_token: 'T', expires_in: 5_184_000 })],
    [/\/me$/, () => ({ followers_count: 1 })],
    [/\/me\/media$/, () => ({ data: [{ id: '9', media_product_type: 'REELS', timestamp: '2026-10-10T10:00:00+0000' }] })],
    [
      /\/9\/insights$/,
      (url) => {
        const metric = url.searchParams.get('metric') ?? '';
        if (metric.includes(',') || metric === 'follows') {
          return new Response(JSON.stringify({ error: { message: 'metric not supported' } }), { status: 400 });
        }
        return { data: [{ name: metric, values: [{ value: 5 }] }] };
      },
    ],
    [/\/me\/insights$/, () => new Response('{}', { status: 400 })],
  ]);
  const r = await instagram.collect(ctx(f, { IG_ACCESS_TOKEN: 'T' }));
  assert.equal(r.posts[0]!.metrics.views, 5);
  assert.equal(r.posts[0]!.metrics.follows, null);
  assert.deepEqual(r.account.extra, {});
});

test('instagram: errors never contain the access token', async () => {
  const f = fakeFetch([
    [/refresh_access_token$/, () => ({ access_token: 'SECRET123', expires_in: 5_184_000 })],
    [/\/me$/, () => new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 401 })],
  ]);
  await assert.rejects(instagram.collect(ctx(f, { IG_ACCESS_TOKEN: 'SECRET123' })), (err: Error) => {
    assert.match(err.message, /Invalid OAuth access token/);
    assert.doesNotMatch(err.message, /SECRET123/);
    return true;
  });
});

import { buildAuthUrl, setEnvVar } from './oauth.js';

test('oauth: auth URL asks for offline access, both read-only scopes and echoes state', () => {
  const u = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'http://localhost:8765/callback', state: 'st' }));
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('state'), 'st');
  assert.match(u.searchParams.get('scope') ?? '', /youtube\.readonly yt-analytics\.readonly|yt-analytics\.readonly/);
  assert.ok(!(u.searchParams.get('scope') ?? '').includes('youtube.force-ssl'));
});

test('setEnvVar replaces one line, appends when missing, keeps the rest', () => {
  assert.equal(setEnvVar('A=1\nYT_REFRESH_TOKEN=\nB=2\n', 'YT_REFRESH_TOKEN', 'x$&y'), 'A=1\nYT_REFRESH_TOKEN=x$&y\nB=2\n');
  assert.equal(setEnvVar('A=1', 'K', 'v'), 'A=1\nK=v\n');
});
