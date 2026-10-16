// GET  /admin/social          -> the analytics dashboard (HTML).
// POST /admin/social/collect  -> run the collectors now (also the hook for an external scheduler).
// Both sit behind HTTP Basic auth (ADMIN_USER / ADMIN_PASSWORD). With no ADMIN_PASSWORD configured
// they answer 404, so a fresh deploy never exposes the page by accident.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { runCollectors, COLLECTORS } from '../social/collect.js';
import { renderPage } from '../social/page.js';
import { lastRunStartedAt, latestRuns, loadAll, utcDay } from '../social/store.js';
import { buildDashboard } from '../social/summary.js';
import type { Platform } from '../social/types.js';

const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

const sha = (s: string): Buffer => createHash('sha256').update(s).digest();
const safeEqual = (a: string, b: string): boolean => timingSafeEqual(sha(a), sha(b));

/** Returns true if the request may proceed; otherwise it has already replied. */
function authorize(req: FastifyRequest, reply: FastifyReply): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    void reply.status(404).send({ ok: false, error: 'not_found' });
    return false;
  }
  const user = process.env.ADMIN_USER ?? 'admin';
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i > 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), password)) return true;
  }
  void reply.header('www-authenticate', 'Basic realm="ear-warrior admin", charset="UTF-8"').status(401).send('Authentication required');
  return false;
}

const Query = z.object({
  days: z.coerce.number().int().refine((n) => [7, 28, 90].includes(n)).catch(7),
  platform: z.enum(['youtube', 'instagram']).optional().catch(undefined),
  sort: z.enum(['gain', 'views', 'date']).catch('gain'),
});

export function registerSocial(app: FastifyInstance): void {
  app.get('/admin/social', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const q = Query.parse(req.query ?? {});
    const now = new Date();
    const [data, runs] = await Promise.all([loadAll(), latestRuns()]);
    const dashboard = buildDashboard(data, utcDay(now), q.days);
    const configured = Object.fromEntries(COLLECTORS.map((c) => [c.platform, c.isConfigured(process.env)])) as Record<Platform, boolean>;
    return reply
      .header('cache-control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(renderPage({ dashboard, runs, configured, platformFilter: q.platform ?? null, sort: q.sort, now }));
  });

  app.post('/admin/social/collect', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    // A browser that cached Basic credentials sends them on cross-site form posts too, so keep this
    // endpoint cheap to abuse: it only ever refreshes data, and not more than once per cooldown.
    const last = await lastRunStartedAt();
    const accept = String(req.headers.accept ?? '');
    if (last && Date.now() - last.getTime() < MANUAL_COOLDOWN_MS) {
      return accept.includes('text/html') ? reply.redirect('/admin/social', 303) : reply.status(429).send({ ok: false, error: 'cooldown' });
    }
    const reports = await runCollectors();
    if (accept.includes('text/html')) return reply.redirect('/admin/social', 303);
    return reply.send({ ok: reports.every((r) => r.status !== 'failed'), reports });
  });
}
