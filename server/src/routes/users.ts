// GET /admin/users -> who is who in the usage data (HTML). Behind the same Basic auth as /admin/social.
import type { FastifyInstance } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import { renderUsersPage, type UsageReport } from '../auth/usagePage.js';

export function registerUsers(app: FastifyInstance, load: (now: Date) => Promise<UsageReport>): void {
  app.get('/admin/users', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const now = new Date();
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(renderUsersPage(await load(now), now));
  });
}
