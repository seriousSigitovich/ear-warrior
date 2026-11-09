// GET /admin/users -> who is who in the usage data (HTML). Behind the same Basic auth as /admin/social.
import type { FastifyInstance } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import { USERS_SORTS, renderUsersPage, type UsageReport, type UsersSort } from '../auth/usagePage.js';

export function registerUsers(app: FastifyInstance, load: (now: Date) => Promise<UsageReport>): void {
  app.get('/admin/users', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const now = new Date();
    const asked = (req.query as { sort?: string }).sort;
    const sort: UsersSort = USERS_SORTS.includes(asked as UsersSort) ? (asked as UsersSort) : 'last';
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(renderUsersPage(await load(now), now, sort));
  });
}
