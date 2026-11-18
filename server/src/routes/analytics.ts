// GET /admin/analytics -> everything the owner knows about each person (HTML). Behind the same Basic auth as /admin/social.
// /admin/users and /admin/funnel were folded into it and now redirect here.
import type { FastifyInstance } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import { buildUsers, type AnalyticsData } from '../analytics/model.js';
import { parseView, renderAnalyticsPage } from '../analytics/page.js';

export function registerAnalytics(app: FastifyInstance, load: () => Promise<AnalyticsData>): void {
  app.get('/admin/analytics', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const view = parseView(req.query as Record<string, unknown>);
    const data = await load();
    const html = renderAnalyticsPage(buildUsers(data), new Date(), view, data.totals);
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(html);
  });
  for (const old of ['/admin/users', '/admin/funnel']) {
    app.get(old, async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      return reply.redirect('/admin/analytics', 301);
    });
  }
}
