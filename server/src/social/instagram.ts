// Instagram collector — "Instagram API with Instagram Login" (graph.instagram.com), which works for
// a Business/Creator account without a Facebook Page.
//
// Token lifecycle: the dashboard-generated token is long-lived (60 days) and must be refreshed
// before it expires. A value that changes over time cannot live in an env var, so the current
// token is kept in Postgres (`social_tokens`); IG_ACCESS_TOKEN only seeds it the first time.
import { getJson } from './http.js';
import {
  emptyMetrics,
  parseVideoNo,
  type CollectedPost,
  type Collector,
  type CollectorContext,
  type CollectResult,
  type PostMetrics,
} from './types.js';

const BASE = 'https://graph.instagram.com/v23.0';
const MAX_PAGES = 20;
const REFRESH_WHEN_DAYS_LEFT = 20;

interface Me {
  username?: string;
  followers_count?: number;
  media_count?: number;
}
interface MediaPage {
  data?: {
    id: string;
    caption?: string;
    media_product_type?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }[];
  paging?: { next?: string };
}
interface InsightsResponse {
  data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[];
}

// Metric sets per media kind. `ig_reels_avg_watch_time` is reported in milliseconds.
const REEL_METRICS = ['views', 'reach', 'saved', 'shares', 'ig_reels_avg_watch_time', 'follows', 'profile_visits'];
const POST_METRICS = ['views', 'reach', 'saved', 'shares', 'follows', 'profile_visits'];

async function currentToken(ctx: CollectorContext): Promise<string> {
  const stored = await ctx.tokens.get('instagram');
  const token = stored?.value ?? ctx.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('Instagram: no access token (set IG_ACCESS_TOKEN)');

  const daysLeft = stored?.expiresAt
    ? (stored.expiresAt.getTime() - ctx.now().getTime()) / 86_400_000
    : null;
  // Unknown expiry (first run) or close to it: try to roll the token forward.
  if (daysLeft === null || daysLeft < REFRESH_WHEN_DAYS_LEFT) {
    try {
      const r = await getJson<{ access_token: string; expires_in: number }>(
        ctx.fetchFn,
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
      );
      const expiresAt = new Date(ctx.now().getTime() + r.expires_in * 1000);
      await ctx.tokens.set('instagram', r.access_token, expiresAt);
      return r.access_token;
    } catch (err) {
      // Not fatal while the old token still works; it surfaces as a failed run once it stops.
      console.warn('instagram: token refresh failed:', (err as Error).message);
      if (!stored) await ctx.tokens.set('instagram', token, null);
    }
  }
  return token;
}

const withToken = (path: string, token: string, params: Record<string, string> = {}): string =>
  `${BASE}${path}?${new URLSearchParams({ ...params, access_token: token })}`;

function readInsights(res: InsightsResponse): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of res.data ?? []) {
    const v = d.total_value?.value ?? d.values?.[0]?.value;
    if (typeof v === 'number') out[d.name] = v;
  }
  return out;
}

/**
 * One request for the whole metric set; Meta rejects the entire call if a single metric is not
 * valid for that media, so on failure fall back to asking for the metrics one by one.
 */
async function mediaInsights(ctx: CollectorContext, token: string, id: string, metrics: string[]): Promise<Record<string, number>> {
  try {
    return readInsights(await getJson<InsightsResponse>(ctx.fetchFn, withToken(`/${id}/insights`, token, { metric: metrics.join(',') })));
  } catch {
    const out: Record<string, number> = {};
    for (const metric of metrics) {
      try {
        Object.assign(out, readInsights(await getJson<InsightsResponse>(ctx.fetchFn, withToken(`/${id}/insights`, token, { metric }))));
      } catch {
        /* metric not available for this media — leave it null */
      }
    }
    return out;
  }
}

async function accountInsights(ctx: CollectorContext, token: string): Promise<Record<string, number>> {
  const until = Math.floor(ctx.now().getTime() / 1000);
  const since = until - 28 * 86_400;
  try {
    const res = await getJson<InsightsResponse>(
      ctx.fetchFn,
      withToken('/me/insights', token, {
        metric: 'reach,profile_views,website_clicks',
        metric_type: 'total_value',
        period: 'day',
        since: String(since),
        until: String(until),
      }),
    );
    const raw = readInsights(res);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) out[`${k}_28d`] = v;
    return out;
  } catch (err) {
    console.warn('instagram: account insights skipped:', (err as Error).message);
    return {};
  }
}

export const instagram: Collector = {
  platform: 'instagram',

  // A token in the DB also counts, but isConfigured is sync and env-only; the seed is required once.
  isConfigured: (env) => Boolean(env.IG_ACCESS_TOKEN),

  async collect(ctx): Promise<CollectResult> {
    const token = await currentToken(ctx);

    const me = await getJson<Me>(ctx.fetchFn, withToken('/me', token, { fields: 'username,followers_count,media_count' }));

    const media: NonNullable<MediaPage['data']> = [];
    let next: string | undefined = withToken('/me/media', token, {
      fields: 'id,caption,media_product_type,permalink,timestamp,like_count,comments_count',
      limit: '50',
    });
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const res: MediaPage = await getJson<MediaPage>(ctx.fetchFn, next);
      media.push(...(res.data ?? []));
      next = res.paging?.next;
    }

    const posts: CollectedPost[] = [];
    for (const item of media) {
      const isReel = item.media_product_type === 'REELS';
      const ins = await mediaInsights(ctx, token, item.id, isReel ? REEL_METRICS : POST_METRICS);
      const m: PostMetrics = emptyMetrics();
      m.views = ins.views ?? null;
      m.reach = ins.reach ?? null;
      m.saves = ins.saved ?? null;
      m.shares = ins.shares ?? null;
      m.follows = ins.follows ?? null;
      m.profileVisits = ins.profile_visits ?? null;
      m.avgWatchS = ins.ig_reels_avg_watch_time !== undefined ? ins.ig_reels_avg_watch_time / 1000 : null;
      m.likes = item.like_count ?? null;
      m.comments = item.comments_count ?? null;
      const caption = item.caption ?? '';
      posts.push({
        info: {
          externalId: item.id,
          title: caption.split('\n')[0]?.slice(0, 200) ?? '',
          url: item.permalink ?? '',
          kind: isReel ? 'reel' : 'post',
          durationS: null,
          publishedAt: new Date(item.timestamp ?? ctx.now().toISOString()),
          videoNo: parseVideoNo(caption),
        },
        metrics: m,
      });
    }

    return {
      posts,
      account: { followers: me.followers_count ?? null, extra: await accountInsights(ctx, token) },
    };
  },
};
