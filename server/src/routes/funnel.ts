// GET /admin/funnel -> where first runs stop (HTML). Behind the same Basic auth as /admin/users.
import type { FastifyInstance } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import { renderFunnelPage, type DeviceRun } from '../funnel/page.js';

export function registerFunnel(app: FastifyInstance, load: () => Promise<DeviceRun[]>): void {
  app.get('/admin/funnel', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(renderFunnelPage(await load(), new Date()));
  });
}
