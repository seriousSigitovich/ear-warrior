// POST /api/subscribe { email } -> inserts into `signups`. Insert-only, dedup by lower(email).
// Same posture as the old Vercel function + Supabase RLS, now against our own Postgres.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { signups } from '../db/schema.js';

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  source: z.string().max(64).optional(),
  // Honeypot: bots fill hidden fields. Present => silently succeed.
  company: z.string().optional(),
});

export function registerSubscribe(app: FastifyInstance): void {
  app.post('/api/subscribe', async (req, reply) => {
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_email' });
    }
    const { email, source, company } = parsed.data;

    // Honeypot hit: pretend success, store nothing.
    if (company) return reply.status(200).send({ ok: true });

    const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 300);
    try {
      await db
        .insert(signups)
        .values({ email, source: source ?? 'landing', userAgent })
        // Repeat submit hits the unique lower(email) index -> treat as success.
        .onConflictDoNothing();
      return reply.status(200).send({ ok: true });
    } catch (err) {
      req.log.error({ err }, 'signup insert failed');
      return reply.status(502).send({ ok: false, error: 'store_failed' });
    }
  });
}
