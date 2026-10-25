// GET  /admin/social          -> the analytics dashboard (HTML).
// POST /admin/social/collect  -> run the collectors now (the page's "refresh now" button).
// GET  /api/cron/social       -> run the collectors from a scheduler (Bearer CRON_SECRET; 404 if unset).
// Both sit behind HTTP Basic auth (admin/basicAuth.ts).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authorize, safeEqual } from '../admin/basicAuth.js';
import { runCollectors, COLLECTORS } from '../social/collect.js';
import { renderPage } from '../social/page.js';
import { applyLabels } from '../social/post-labels.js';
import { loadLeads } from '../social/signups.js';
import { lastRunStartedAt, latestRuns, loadAll, signupSourceCountsPg, utcDay } from '../social/store.js';
import { buildDashboard } from '../social/summary.js';
import type { Platform } from '../social/types.js';

const MANUAL_COOLDOWN_MS = 2 * 60 * 1000;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET the route does not exist. */
function authorizeCron(req: FastifyRequest, reply: FastifyReply): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    void reply.status(404).send({ ok: false, error: 'not_found' });
    return false;
  }
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ') && safeEqual(header.slice(7), secret)) return true;
  void reply.status(401).send({ ok: false, error: 'unauthorized' });
  return false;
}

const Query = z.object({
  days: z.coerce.number().int().refine((n) => [7, 28, 90].includes(n)).catch(7),
  platform: z.enum(['youtube', 'instagram']).optional().catch(undefined),
  sort: z.enum(['gain', 'views', 'date']).catch('gain'),
});

export function registerSocial(root: FastifyInstance): void {
  // Encapsulated so the extra parser below only applies to these routes.
  root.register(async (app) => {
    // The "refresh now" button is a plain HTML <form method="post">: browsers send it with
    // Content-Type: application/x-www-form-urlencoded (empty body), which Fastify rejects with 415
    // unless a parser exists. The body carries nothing we need, so accept it and ignore it.
    app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, _body, done) => done(null, {}));

  app.get('/admin/social', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const q = Query.parse(req.query ?? {});
    const now = new Date();
    const [data, runs, leads] = await Promise.all([
      loadAll(),
      latestRuns(),
      loadLeads(process.env, (url, init) => fetch(url, init), signupSourceCountsPg),
    ]);
    const dashboard = buildDashboard({ ...data, posts: applyLabels(data.posts) }, utcDay(now), q.days, leads ? leads.counts : null);
    const configured = Object.fromEntries(COLLECTORS.map((c) => [c.platform, c.isConfigured(process.env)])) as Record<Platform, boolean>;
    return reply
      .header('cache-control', 'no-store')
      .type('text/html; charset=utf-8')
      .send(renderPage({ dashboard, runs, leads, configured, platformFilter: q.platform ?? null, sort: q.sort, now }));
  });

  // Scheduled collection (Vercel Cron, once a day). No cooldown: the scheduler is the only caller.
  app.get('/api/cron/social', async (req, reply) => {
    if (!authorizeCron(req, reply)) return reply;
    const reports = await runCollectors();
    return reply.send({ ok: reports.every((r) => r.status !== 'failed'), reports });
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
  });
}
