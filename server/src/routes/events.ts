// POST /api/events -> inserts one anonymous product event into `app_events` (closed-beta analytics).
// No audio, no PII (device_id is a random per-install id). Insert-only, like /api/attempts.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { appEvents } from '../db/schema.js';

// Matches AppEventPayload on the client (src/services/logging/eventLog.ts).
export const EventBody = z.object({
  device_id: z.string().min(1).max(80),
  app_version: z.string().min(1).max(40),
  name: z.enum(['app_open', 'onboarding_done', 'session_start', 'session_end']),
  occurred_at: z.string().datetime(),
  // Small scalars only: this is a counter bag, not a place to put free text.
  props: z
    .record(z.string().max(40), z.union([z.number(), z.string().max(80), z.boolean()]))
    .refine((p) => Object.keys(p).length <= 10, 'too many props')
    .default({}),
});

export function registerEvents(app: FastifyInstance): void {
  app.post('/api/events', async (req, reply) => {
    const parsed = EventBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    }
    const p = parsed.data;
    try {
      await db.insert(appEvents).values({
        deviceId: p.device_id,
        appVersion: p.app_version,
        name: p.name,
        occurredAt: new Date(p.occurred_at),
        props: p.props,
      });
      return reply.status(200).send({ ok: true });
    } catch (err) {
      req.log.error({ err }, 'app_events insert failed');
      return reply.status(502).send({ ok: false, error: 'store_failed' });
    }
  });
}
