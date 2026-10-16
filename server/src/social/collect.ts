// Orchestrates one collection pass: each configured platform runs independently, so a broken
// Instagram token never stops YouTube from being recorded. Every run leaves a row in social_runs.
import { finishRun, saveCollected, startRun, tokenStore } from './store.js';
import { instagram } from './instagram.js';
import { youtube } from './youtube.js';
import type { Collector, CollectorContext, Platform } from './types.js';

export const COLLECTORS: readonly Collector[] = [youtube, instagram];

export interface RunReport {
  platform: Platform;
  status: 'ok' | 'failed' | 'skipped';
  posts?: number;
  error?: string;
}

let running = false;

export async function runCollectors(
  ctx: CollectorContext = { fetchFn: fetch, env: process.env, tokens: tokenStore, now: () => new Date() },
  collectors: readonly Collector[] = COLLECTORS,
): Promise<RunReport[]> {
  if (running) return collectors.map((c) => ({ platform: c.platform, status: 'skipped', error: 'already running' }));
  running = true;
  try {
    const reports: RunReport[] = [];
    for (const c of collectors) {
      if (!c.isConfigured(ctx.env)) {
        reports.push({ platform: c.platform, status: 'skipped', error: 'not configured' });
        continue;
      }
      const runId = await startRun(c.platform);
      try {
        const result = await c.collect(ctx);
        await saveCollected(c.platform, result, ctx.now());
        await finishRun(runId, { ok: true, posts: result.posts.length });
        reports.push({ platform: c.platform, status: 'ok', posts: result.posts.length });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await finishRun(runId, { ok: false, error });
        reports.push({ platform: c.platform, status: 'failed', error });
      }
    }
    return reports;
  } finally {
    running = false;
  }
}
