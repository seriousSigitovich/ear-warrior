// Game-history sync. Postgres is the durable source of truth; the device keeps a local SQLite cache.
//
//   POST /api/sync   { device_id, documents: [{ collection, doc_id, data, updated_at }] }
//     Upsert each document, last-write-wins on `updated_at` (client wall-clock ms). A stale push
//     (older updated_at than what the server holds) is ignored, so replays are safe.
//
//   GET  /api/sync?device_id=...&since=<ms>
//     Return every document for the device with updated_at > since, so a fresh install (since=0)
//     pulls the full history and an incremental sync pulls only what changed.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, gt, sql as dsql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { syncDocuments } from '../db/schema.js';

const COLLECTIONS = [
  'sessions',
  'attempts',
  'melodies',
  'difficulty_settings',
  'key_value',
] as const;

const PushBody = z.object({
  device_id: z.string().min(1).max(80),
  documents: z
    .array(
      z.object({
        collection: z.enum(COLLECTIONS),
        doc_id: z.string().min(1).max(200),
        data: z.record(z.unknown()),
        updated_at: z.number().nonnegative(),
      }),
    )
    .max(2000),
});

const PullQuery = z.object({
  device_id: z.string().min(1).max(80),
  since: z.coerce.number().nonnegative().default(0),
});

export function registerSync(app: FastifyInstance): void {
  app.post('/api/sync', async (req, reply) => {
    const parsed = PushBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    }
    const { device_id, documents } = parsed.data;
    if (documents.length === 0) return reply.status(200).send({ ok: true, applied: 0 });

    try {
      let applied = 0;
      // One upsert per doc keeps the last-write-wins guard simple and correct.
      for (const d of documents) {
        const res = await db
          .insert(syncDocuments)
          .values({
            deviceId: device_id,
            collection: d.collection,
            docId: d.doc_id,
            data: d.data,
            updatedAt: d.updated_at,
          })
          .onConflictDoUpdate({
            target: [syncDocuments.deviceId, syncDocuments.collection, syncDocuments.docId],
            set: {
              data: d.data,
              updatedAt: d.updated_at,
              serverReceivedAt: dsql`now()`,
            },
            // Last-write-wins: only overwrite when the incoming doc is newer.
            setWhere: dsql`${syncDocuments.updatedAt} < ${d.updated_at}`,
          });
        applied += res.count ?? 0;
      }
      return reply.status(200).send({ ok: true, applied });
    } catch (err) {
      req.log.error({ err }, 'sync push failed');
      return reply.status(502).send({ ok: false, error: 'store_failed' });
    }
  });

  app.get('/api/sync', async (req, reply) => {
    const parsed = PullQuery.safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_query' });
    }
    const { device_id, since } = parsed.data;
    try {
      const rows = await db
        .select({
          collection: syncDocuments.collection,
          doc_id: syncDocuments.docId,
          data: syncDocuments.data,
          updated_at: syncDocuments.updatedAt,
        })
        .from(syncDocuments)
        .where(and(eq(syncDocuments.deviceId, device_id), gt(syncDocuments.updatedAt, since)));
      const serverNow = Date.now();
      return reply.status(200).send({ ok: true, documents: rows, serverNow });
    } catch (err) {
      req.log.error({ err }, 'sync pull failed');
      return reply.status(502).send({ ok: false, error: 'read_failed' });
    }
  });
}
