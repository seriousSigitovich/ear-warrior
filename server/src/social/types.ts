// Shared shapes for the social-analytics collectors. A collector turns one platform's API into
// these plain objects; storage and the dashboard never see platform-specific JSON.

export type Platform = 'youtube' | 'instagram';

export const PLATFORMS: readonly Platform[] = ['youtube', 'instagram'];

/** Static facts about a post (they do not change from day to day). */
export interface PostInfo {
  externalId: string;
  title: string;
  url: string;
  /** 'short' | 'video' on YouTube, 'reel' | 'post' on Instagram. */
  kind: string;
  durationS: number | null;
  publishedAt: Date;
  /** The "EAR CHALLENGE #N" number when the title/caption carries one. */
  videoNo: number | null;
}

/**
 * Cumulative counters of a post at collection time. `null` means "this platform does not report
 * it" (e.g. YouTube has no `saves`), which must not be confused with a real 0.
 */
export interface PostMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  avgWatchS: number | null;
  avgWatchPct: number | null;
  follows: number | null;
  profileVisits: number | null;
}

export const METRIC_KEYS = [
  'views',
  'likes',
  'comments',
  'shares',
  'saves',
  'reach',
  'avgWatchS',
  'avgWatchPct',
  'follows',
  'profileVisits',
] as const satisfies readonly (keyof PostMetrics)[];

export function emptyMetrics(): PostMetrics {
  return {
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    avgWatchS: null,
    avgWatchPct: null,
    follows: null,
    profileVisits: null,
  };
}

export interface CollectedPost {
  info: PostInfo;
  metrics: PostMetrics;
}

export interface AccountMetrics {
  followers: number | null;
  /** Platform-specific numbers (e.g. Instagram profile_views_28d), keyed by name. */
  extra: Record<string, number>;
}

export interface CollectResult {
  posts: CollectedPost[];
  account: AccountMetrics;
}

/** Credential that rotates and therefore lives in Postgres rather than in the environment. */
export interface TokenStore {
  get(platform: Platform): Promise<{ value: string; expiresAt: Date | null } | null>;
  set(platform: Platform, value: string, expiresAt: Date | null): Promise<void>;
}

export interface CollectorContext {
  fetchFn: typeof fetch;
  env: Record<string, string | undefined>;
  tokens: TokenStore;
  now: () => Date;
}

export interface Collector {
  platform: Platform;
  /** False when the env vars it needs are missing; the run is then skipped, not failed. */
  isConfigured(env: CollectorContext['env']): boolean;
  collect(ctx: CollectorContext): Promise<CollectResult>;
}

/** "EAR CHALLENGE #12", "ear-challenge-12", "#12 ..." -> 12. Hashtags like #shorts do not match. */
export function parseVideoNo(text: string): number | null {
  const m = /ear[\s-]*challenge[\s#-]*(\d{1,3})\b/i.exec(text) ?? /#\s?(\d{1,3})\b/.exec(text);
  return m ? Number(m[1]) : null;
}
