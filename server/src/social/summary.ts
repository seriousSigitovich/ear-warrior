// Pure aggregation for the dashboard: turns stored snapshots into "what happened in the last N
// days". No I/O, so it is unit-tested with hand-made snapshots (summary.test.ts).
//
// The key idea: platforms report CUMULATIVE counters ("this video has 1 143 views"), but a
// dashboard wants GROWTH ("+340 this week"). Growth is a difference between two snapshots, and it
// is only knowable when we have a snapshot at the start of the window. Where we don't, the answer
// is `null` ("unknown"), never a made-up number — the page then falls back to lifetime totals.
import { leadsForPost, type SourceCount } from './signups.js';
import type { Platform, PostMetrics } from './types.js';

export interface PostRow {
  platform: string;
  externalId: string;
  title: string;
  url: string;
  kind: string;
  durationS: number | null;
  publishedAt: Date;
  videoNo: number | null;
  /** From post-labels.ts (the manual map), not from the platform. */
  hypothesis?: string | null;
  label?: string | null;
}
export interface SnapshotRow extends PostMetrics {
  platform: string;
  externalId: string;
  day: string; // YYYY-MM-DD (UTC)
}
export interface AccountRow {
  platform: string;
  day: string;
  followers: number | null;
  extra: Record<string, number>;
}

export interface Point {
  day: string;
  value: number;
}

export interface PostView {
  post: PostRow;
  latest: SnapshotRow | null;
  /** Views gained in the window; null = no snapshot at the window start, so unknown. */
  gain: number | null;
  /** Days between the two snapshots `gain` was measured over (T035); can exceed the window. */
  gainSpanDays: number | null;
  /** Waitlist signups whose source tag carries this post's `earNN` campaign; null = unknowable. */
  leads: number | null;
  /** Cumulative views per collected day, oldest first. */
  series: Point[];
}

export interface PlatformSummary {
  platform: Platform;
  postCount: number;
  totalViews: number;
  gain: number | null;
  /** The longest span any post's gain was measured over; > days means the window label would lie. */
  gainSpanDays: number | null;
  prevGain: number | null;
  followers: number | null;
  followersDelta: number | null;
  /** Latest account-level extras (e.g. Instagram profile_views_28d). */
  extra: Record<string, number>;
  best: PostView | null;
}

export interface Dashboard {
  today: string;
  days: number;
  /** First day we have any snapshot for; before it, growth is unknowable. */
  historyFrom: string | null;
  platforms: PlatformSummary[];
  posts: PostView[];
}

export const addDays = (day: string, delta: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

const lastAtOrBefore = (series: Point[], day: string): Point | null => {
  let found: Point | null = null;
  for (const p of series) {
    if (p.day <= day) found = p;
    else break;
  }
  return found;
};

export interface GainResult {
  gain: number;
  /** Days between the snapshots (or publish day) the gain was measured over. */
  spanDays: number;
}

const dayDiff = (a: string, b: string): number => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/**
 * Growth of a cumulative counter over (startDay, endDay].
 *  - end value  = last snapshot on/before endDay
 *  - base value = last snapshot on/before startDay; or 0 if the post was born after startDay
 * Returns null when the base cannot be known. `spanDays` is the real distance between the two
 * points, which is longer than the window when the baseline snapshot is old (irregular collection).
 */
export function windowGainDetail(series: Point[], publishedDay: string, startDay: string, endDay: string): GainResult | null {
  const end = lastAtOrBefore(series, endDay);
  if (!end) return publishedDay > endDay ? { gain: 0, spanDays: 0 } : null; // not born yet vs. simply no data
  const base = lastAtOrBefore(series, startDay);
  if (base) return { gain: Math.max(0, end.value - base.value), spanDays: dayDiff(end.day, base.day) };
  if (publishedDay > startDay) return { gain: Math.max(0, end.value), spanDays: Math.max(0, dayDiff(end.day, publishedDay)) };
  return null;
}

export function windowGain(series: Point[], publishedDay: string, startDay: string, endDay: string): number | null {
  return windowGainDetail(series, publishedDay, startDay, endDay)?.gain ?? null;
}

const sumOrNull = (xs: (number | null)[]): number | null =>
  xs.some((x) => x === null) ? null : xs.reduce<number>((a, b) => a + (b ?? 0), 0);

export function buildDashboard(
  data: { posts: PostRow[]; snapshots: SnapshotRow[]; accounts: AccountRow[] },
  today: string,
  days: number,
  signups: SourceCount[] | null = null,
): Dashboard {
  const startDay = addDays(today, -days);
  const prevStartDay = addDays(today, -2 * days);

  const snapsByPost = new Map<string, SnapshotRow[]>();
  for (const s of data.snapshots) {
    const key = `${s.platform}/${s.externalId}`;
    (snapsByPost.get(key) ?? snapsByPost.set(key, []).get(key)!).push(s);
  }

  const views: PostView[] = [];
  const prevGains = new Map<string, number | null>();
  for (const post of data.posts) {
    const key = `${post.platform}/${post.externalId}`;
    const snaps = (snapsByPost.get(key) ?? []).sort((a, b) => (a.day < b.day ? -1 : 1));
    const series = snaps.filter((s) => s.views !== null).map((s) => ({ day: s.day, value: s.views as number }));
    const publishedDay = post.publishedAt.toISOString().slice(0, 10);
    const g = windowGainDetail(series, publishedDay, startDay, today);
    views.push({
      post,
      latest: snaps[snaps.length - 1] ?? null,
      gain: g?.gain ?? null,
      gainSpanDays: g?.spanDays ?? null,
      leads: signups ? leadsForPost(post, signups) : null,
      series,
    });
    prevGains.set(key, windowGain(series, publishedDay, prevStartDay, startDay));
  }

  const platforms: PlatformSummary[] = [];
  for (const platform of ['youtube', 'instagram'] as const) {
    const mine = views.filter((v) => v.post.platform === platform);
    const acc = data.accounts.filter((a) => a.platform === platform).sort((a, b) => (a.day < b.day ? -1 : 1));
    if (mine.length === 0 && acc.length === 0) continue;

    const latestAcc = acc[acc.length - 1] ?? null;
    const baseAcc = [...acc].reverse().find((a) => a.day <= startDay) ?? null;
    const ranked = [...mine].filter((v) => v.gain !== null).sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0));

    platforms.push({
      platform,
      postCount: mine.length,
      totalViews: mine.reduce((s, v) => s + (v.latest?.views ?? 0), 0),
      gain: sumOrNull(mine.map((v) => v.gain)),
      gainSpanDays: mine.reduce<number | null>((m, v) => (v.gainSpanDays === null ? m : Math.max(m ?? 0, v.gainSpanDays)), null),
      prevGain: sumOrNull(mine.map((v) => prevGains.get(`${v.post.platform}/${v.post.externalId}`) ?? null)),
      followers: latestAcc?.followers ?? null,
      followersDelta:
        latestAcc?.followers != null && baseAcc?.followers != null ? latestAcc.followers - baseAcc.followers : null,
      extra: latestAcc?.extra ?? {},
      best: ranked[0] && (ranked[0].gain ?? 0) > 0 ? ranked[0] : null,
    });
  }

  const days0 = data.snapshots.reduce<string | null>((min, s) => (min === null || s.day < min ? s.day : min), null);
  return { today, days, historyFrom: days0, platforms, posts: views };
}

export type SortKey = 'gain' | 'views' | 'date';

export function sortPosts(posts: PostView[], key: SortKey): PostView[] {
  const byViews = (v: PostView) => v.latest?.views ?? -1;
  const out = [...posts];
  if (key === 'date') return out.sort((a, b) => b.post.publishedAt.getTime() - a.post.publishedAt.getTime());
  if (key === 'views') return out.sort((a, b) => byViews(b) - byViews(a));
  // gain: known growth first (largest on top), unknown last ordered by lifetime views
  return out.sort((a, b) => {
    if (a.gain === null && b.gain === null) return byViews(b) - byViews(a);
    if (a.gain === null) return 1;
    if (b.gain === null) return -1;
    return b.gain - a.gain;
  });
}
