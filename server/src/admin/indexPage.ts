// GET /admin — one page with a link to every owner page, so none has to be remembered by URL.
import type { FastifyInstance } from 'fastify';
import { CSS } from '../social/page.js';
import { authorize } from './basicAuth.js';
import { ADMIN_PAGES } from './nav.js';

export function renderAdminIndex(): string {
  const items = ADMIN_PAGES.map(([href, title, what]) => `<li><a href="${href}"><b>${title}</b></a><br><span class="muted small">${what}</span></li>`).join('\n');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Админка — Ear Warrior</title><style>${CSS}li{margin:0 0 14px;font-size:16px}ul{list-style:none;padding:0}</style></head><body><main>
<header><h1>Админка · Ear Warrior</h1></header>
<ul>
${items}
</ul>
</main></body></html>`;
}

export function registerAdminIndex(app: FastifyInstance): void {
  app.get('/admin', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(renderAdminIndex());
  });
}
