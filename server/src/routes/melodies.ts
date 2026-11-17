// GET /api/melodies (spec 024): the catalog devices download — every visible tune with its audio url and
// fingerprint, never its answer notes. Public (no login): the library is not a secret, the answers are.
// `ETag` lets a device ask "has it changed?" and get an empty 304.
import type { FastifyInstance } from 'fastify';
import { buildCatalog } from '../tunes/catalog.js';
import type { TuneStore } from '../tunes/store.js';

export function registerMelodies(app: FastifyInstance, tunes: TuneStore): void {
  app.get('/api/melodies', async (req, reply) => {
    let catalog;
    try {
      catalog = buildCatalog(await tunes.list());
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'catalog failed');
      return reply.status(502).send({ ok: false, error: 'store_failed' });
    }
    const etag = `"${catalog.etag}"`;
    reply.header('etag', etag).header('cache-control', 'public, max-age=0, must-revalidate');
    if (req.headers['if-none-match'] === etag) return reply.status(304).send();
    return { ok: true, etag: catalog.etag, tunes: catalog.tunes };
  });
}
