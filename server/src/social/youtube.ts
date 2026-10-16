// YouTube collector. Two APIs, because each knows what the other does not:
//   - Data API v3  : the list of uploads + fresh counters (views, likes, comments, duration).
//   - Analytics API: per-video watch behaviour (average view duration / percentage), shares and
//                    subscribers gained. Lags ~2 days, so it only enriches, never replaces.
// "Viewed vs swiped away" (the Shorts feed metric from docs/experiments.md) is Studio-only and is
// not requested here; the dashboard leaves that column empty rather than inventing it.
import { getJson } from './http.js';
import {
  emptyMetrics,
  parseVideoNo,
  type CollectedPost,
  type Collector,
  type CollectorContext,
  type CollectResult,
} from './types.js';

const DATA = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS = 'https://youtubeanalytics.googleapis.com/v2/reports';
const MAX_PAGES = 20;

interface Channel {
  items?: {
    statistics?: { subscriberCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}
interface PlaylistPage {
  items?: { contentDetails?: { videoId?: string } }[];
  nextPageToken?: string;
}
interface VideosPage {
  items?: {
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
}
interface AnalyticsReport {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
}

/** ISO 8601 duration ("PT1M3S", "PT45S", "PT1H2M") -> seconds. */
export function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return null;
  return Math.round(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
}

const num = (v: string | number | undefined): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function accessToken(ctx: CollectorContext): Promise<string> {
  const body = new URLSearchParams({
    client_id: ctx.env.YT_CLIENT_ID ?? '',
    client_secret: ctx.env.YT_CLIENT_SECRET ?? '',
    refresh_token: ctx.env.YT_REFRESH_TOKEN ?? '',
    grant_type: 'refresh_token',
  });
  const res = await getJson<{ access_token: string }>(ctx.fetchFn, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res.access_token;
}

async function allUploadIds(ctx: CollectorContext, auth: RequestInit, uploads: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ part: 'contentDetails', playlistId: uploads, maxResults: '50' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await getJson<PlaylistPage>(ctx.fetchFn, `${DATA}/playlistItems?${q}`, auth);
    for (const it of res.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

/** Lifetime per-video analytics, keyed by video id. Empty map if the API has nothing yet. */
async function analyticsByVideo(
  ctx: CollectorContext,
  auth: RequestInit,
): Promise<Map<string, Record<string, number>>> {
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: '2005-04-23', // YouTube's founding day: "lifetime"
    endDate: ctx.now().toISOString().slice(0, 10),
    metrics: 'views,shares,subscribersGained,averageViewDuration,averageViewPercentage',
    dimensions: 'video',
    sort: '-views',
    maxResults: '200',
  });
  const report = await getJson<AnalyticsReport>(ctx.fetchFn, `${ANALYTICS}?${q}`, auth);
  const names = (report.columnHeaders ?? []).map((h) => h.name);
  const out = new Map<string, Record<string, number>>();
  for (const row of report.rows ?? []) {
    const rec: Record<string, number> = {};
    names.forEach((n, i) => {
      if (n !== 'video') rec[n] = Number(row[i]);
    });
    out.set(String(row[names.indexOf('video')]), rec);
  }
  return out;
}

export const youtube: Collector = {
  platform: 'youtube',

  isConfigured: (env) => Boolean(env.YT_CLIENT_ID && env.YT_CLIENT_SECRET && env.YT_REFRESH_TOKEN),

  async collect(ctx): Promise<CollectResult> {
    const token = await accessToken(ctx);
    const auth: RequestInit = { headers: { authorization: `Bearer ${token}` } };

    const ch = await getJson<Channel>(ctx.fetchFn, `${DATA}/channels?part=contentDetails,statistics&mine=true`, auth);
    const channel = ch.items?.[0];
    const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) throw new Error('YouTube: channel has no uploads playlist (wrong Google account?)');

    const ids = await allUploadIds(ctx, auth, uploads);

    // Analytics is an enrichment: if it fails (quota, lag, scope), still store the public counters.
    let analytics = new Map<string, Record<string, number>>();
    try {
      analytics = await analyticsByVideo(ctx, auth);
    } catch (err) {
      console.warn('youtube: analytics enrichment skipped:', (err as Error).message);
    }

    const posts: CollectedPost[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const q = new URLSearchParams({ part: 'snippet,contentDetails,statistics', id: ids.slice(i, i + 50).join(',') });
      const page = await getJson<VideosPage>(ctx.fetchFn, `${DATA}/videos?${q}`, auth);
      for (const v of page.items ?? []) {
        const durationS = parseIsoDuration(v.contentDetails?.duration);
        const title = v.snippet?.title ?? '';
        const a = analytics.get(v.id);
        const m = emptyMetrics();
        m.views = num(v.statistics?.viewCount);
        m.likes = num(v.statistics?.likeCount);
        m.comments = num(v.statistics?.commentCount);
        if (a) {
          m.shares = num(a.shares);
          m.follows = num(a.subscribersGained);
          m.avgWatchS = num(a.averageViewDuration);
          m.avgWatchPct = num(a.averageViewPercentage);
        }
        posts.push({
          info: {
            externalId: v.id,
            title,
            url: `https://www.youtube.com/shorts/${v.id}`,
            kind: durationS !== null && durationS <= 180 ? 'short' : 'video',
            durationS,
            publishedAt: new Date(v.snippet?.publishedAt ?? ctx.now().toISOString()),
            videoNo: parseVideoNo(title),
          },
          metrics: m,
        });
      }
    }

    return {
      posts,
      account: { followers: num(channel?.statistics?.subscriberCount), extra: {} },
    };
  },
};
