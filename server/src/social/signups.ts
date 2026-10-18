// Waitlist signups by source tag (T029). The landing writes tags like "youtube:ear44:desc"
// (utm_source:utm_campaign:utm_content, landing/index.html signupSource) — the campaign segment
// "earNN" is the video number, which is how a signup is joined to a post. Only counts leave this
// module: the stores also hold emails, and the dashboard has no business reading them.
import type { PostRow } from './summary.js';

export interface SourceCount {
  source: string;
  count: number;
}

export interface Leads {
  /** Which store answered: the live landing writes to Upstash; the Fastify server's table is the fallback. */
  via: 'upstash' | 'postgres';
  counts: SourceCount[];
}

export const totalLeads = (counts: SourceCount[]): number => counts.reduce((s, c) => s + c.count, 0);

/** "ear44" for video 44 (matches publish/text.ts utmUrl). */
export const campaignOf = (videoNo: number): string => `ear${String(videoNo).padStart(2, '0')}`;

/** Signups whose tag is `<platform>:<earNN>[:content]` for this post; null when the post has no number. */
export function leadsForPost(post: Pick<PostRow, 'platform' | 'videoNo'>, signups: SourceCount[]): number | null {
  if (post.videoNo === null) return null;
  const want = campaignOf(post.videoNo);
  return signups.reduce((n, s) => {
    const [src, campaign] = s.source.split(':');
    return src === post.platform && campaign === want ? n + s.count : n;
  }, 0);
}

/** Collapses a source→count list to one row per tag, biggest first. */
export function mergeCounts(raw: SourceCount[]): SourceCount[] {
  const m = new Map<string, number>();
  for (const r of raw) m.set(r.source, (m.get(r.source) ?? 0) + r.count);
  return [...m].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || (a.source < b.source ? -1 : 1));
}

type Env = Record<string, string | undefined>;
type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const upstashConf = (env: Env): { url: string; token: string } | null => {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
};

/** HGETALL comes back as a flat [field, value, field, value…] array (or an object, depending on the protocol). */
function sourcesFromHash(result: unknown): string[] {
  if (Array.isArray(result)) return result.filter((_, i) => i % 2 === 1).map(String);
  if (result && typeof result === 'object') return Object.values(result as Record<string, unknown>).map(String);
  return [];
}

/** Reads `signup_sources` (email → source) from Upstash and keeps only the source values. Null when not configured. */
export async function fetchUpstashSources(env: Env, fetchFn: FetchFn): Promise<SourceCount[] | null> {
  const c = upstashConf(env);
  if (!c) return null;
  const r = await fetchFn(`${c.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['HGETALL', 'signup_sources']]),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  const out = (await r.json()) as { result?: unknown; error?: string }[];
  if (!Array.isArray(out) || out[0]?.error) throw new Error(`upstash: ${out?.[0]?.error ?? 'bad response'}`);
  return mergeCounts(sourcesFromHash(out[0]?.result).map((source) => ({ source: source || 'landing', count: 1 })));
}

/** Upstash first (where the live landing writes), Postgres as fallback, null when neither answers. */
export async function loadLeads(env: Env, fetchFn: FetchFn, pg: () => Promise<SourceCount[]>): Promise<Leads | null> {
  try {
    const up = await fetchUpstashSources(env, fetchFn);
    if (up) return { via: 'upstash', counts: up };
  } catch {
    /* fall through to Postgres */
  }
  try {
    return { via: 'postgres', counts: mergeCounts(await pg()) };
  } catch {
    return null;
  }
}
