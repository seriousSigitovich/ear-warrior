// Persistence for social analytics: upserts after a collector run, and the one read the dashboard
// needs. Snapshots are keyed by UTC day, so running the collector several times a day just
// overwrites that day's row with fresher numbers.
import { desc, eq, sql as dsql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  socialAccountSnapshots,
  socialPosts,
  socialRuns,
  socialSnapshots,
  socialTokens,
} from '../db/schema.js';
import type { SourceCount } from './signups.js';
import type { CollectResult, Platform, TokenStore } from './types.js';

export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

export async function saveCollected(platform: Platform, result: CollectResult, now: Date): Promise<void> {
  const day = utcDay(now);
  await db.transaction(async (tx) => {
    for (const { info, metrics } of result.posts) {
      await tx
        .insert(socialPosts)
        .values({
          platform,
          externalId: info.externalId,
          title: info.title,
          url: info.url,
          kind: info.kind,
          durationS: info.durationS,
          publishedAt: info.publishedAt,
          videoNo: info.videoNo,
        })
        .onConflictDoUpdate({
          target: [socialPosts.platform, socialPosts.externalId],
          set: { title: info.title, url: info.url, kind: info.kind, durationS: info.durationS, videoNo: info.videoNo },
        });
      await tx
        .insert(socialSnapshots)
        .values({ platform, externalId: info.externalId, day, ...metrics })
        .onConflictDoUpdate({
          target: [socialSnapshots.platform, socialSnapshots.externalId, socialSnapshots.day],
          set: { ...metrics, collectedAt: now },
        });
    }
    await tx
      .insert(socialAccountSnapshots)
      .values({ platform, day, followers: result.account.followers, extra: result.account.extra })
      .onConflictDoUpdate({
        target: [socialAccountSnapshots.platform, socialAccountSnapshots.day],
        set: { followers: result.account.followers, extra: result.account.extra, collectedAt: now },
      });
  });
}

export const tokenStore: TokenStore = {
  async get(platform) {
    const [row] = await db.select().from(socialTokens).where(eq(socialTokens.platform, platform));
    return row ? { value: row.value, expiresAt: row.expiresAt } : null;
  },
  async set(platform, value, expiresAt) {
    await db
      .insert(socialTokens)
      .values({ platform, value, expiresAt })
      .onConflictDoUpdate({ target: socialTokens.platform, set: { value, expiresAt, updatedAt: new Date() } });
  },
};

export async function startRun(platform: Platform): Promise<number> {
  const [row] = await db.insert(socialRuns).values({ platform }).returning({ id: socialRuns.id });
  return row!.id;
}

export async function finishRun(id: number, r: { ok: boolean; posts?: number; error?: string }): Promise<void> {
  await db
    .update(socialRuns)
    .set({ finishedAt: new Date(), ok: r.ok, posts: r.posts ?? null, error: r.error?.slice(0, 500) ?? null })
    .where(eq(socialRuns.id, id));
}

/** When did a collection last start (any platform)? Used as a cooldown for the manual button. */
export async function lastRunStartedAt(): Promise<Date | null> {
  const [row] = await db.select({ t: socialRuns.startedAt }).from(socialRuns).orderBy(desc(socialRuns.startedAt)).limit(1);
  return row?.t ?? null;
}

/** Latest finished run per platform (the "is the data fresh?" strip on the page). */
export async function latestRuns(): Promise<
  { platform: string; startedAt: Date; finishedAt: Date | null; ok: boolean | null; posts: number | null; error: string | null }[]
> {
  const rows = await db.execute(dsql`
    select distinct on (platform) platform, started_at, finished_at, ok, posts, error
    from social_runs
    where finished_at is not null
    order by platform, started_at desc
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    platform: String(r.platform),
    startedAt: new Date(r.started_at as string),
    finishedAt: r.finished_at ? new Date(r.finished_at as string) : null,
    ok: r.ok as boolean | null,
    posts: r.posts as number | null,
    error: r.error as string | null,
  }));
}

export async function loadAll() {
  const [posts, snapshots, accounts] = await Promise.all([
    db.select().from(socialPosts),
    db.select().from(socialSnapshots).orderBy(socialSnapshots.day),
    db.select().from(socialAccountSnapshots).orderBy(socialAccountSnapshots.day),
  ]);
  return { posts, snapshots, accounts };
}

/** Waitlist signups per source tag in the server's own table (counts only — no emails leave the query). */
export async function signupSourceCountsPg(): Promise<SourceCount[]> {
  const rows = await db.execute(dsql`select coalesce(source, 'landing') as source, count(*)::int as n from signups group by 1`);
  return (rows as unknown as { source: string; n: number }[]).map((r) => ({ source: r.source, count: r.n }));
}
