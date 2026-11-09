// GET /admin/funnel -> where first runs stop (HTML). Behind the same Basic auth as /admin/users.
import type { FastifyInstance } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import { FUNNEL_SORTS, renderFunnelPage, type DeviceRun, type FunnelSort } from '../funnel/page.js';

export function registerFunnel(app: FastifyInstance, load: () => Promise<DeviceRun[]>): void {
  app.get('/admin/funnel', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const asked = (req.query as { sort?: string }).sort;
    const sort: FunnelSort = FUNNEL_SORTS.includes(asked as FunnelSort) ? (asked as FunnelSort) : 'first';
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(renderFunnelPage(await load(), new Date(), sort));
  });
}
