// POST /api/attempts -> inserts one anonymous aggregate telemetry row into `attempt_log`.
// No audio, no per-note pitches, no PII (device_id is a random per-install id). Insert-only.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { attemptLog } from '../db/schema.js';

// Matches AttemptLogPayload on the client (src/services/logging/attemptLog.ts).
const Body = z.object({
  device_id: z.string().min(1).max(80),
  app_version: z.string().min(1).max(40),
  difficulty_id: z.string().min(1).max(40),
  difficulty_rank: z.number().int(),
  note_count: z.number().int().nonnegative(),
  verdict: z.enum(['correct', 'incorrect']),
  matched_count: z.number().int().nonnegative(),
  wrong_count: z.number().int().nonnegative(),
  missed_count: z.number().int().nonnegative(),
  extra_count: z.number().int().nonnegative(),
  confidence: z.number(),
  octave_mismatch: z.boolean(),
});

export function registerTelemetry(app: FastifyInstance): void {
  app.post('/api/attempts', async (req, reply) => {
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    }
    const p = parsed.data;
    try {
      await db.insert(attemptLog).values({
        deviceId: p.device_id,
        appVersion: p.app_version,
        difficultyId: p.difficulty_id,
        difficultyRank: p.difficulty_rank,
        noteCount: p.note_count,
        verdict: p.verdict,
        matchedCount: p.matched_count,
        wrongCount: p.wrong_count,
        missedCount: p.missed_count,
        extraCount: p.extra_count,
        confidence: p.confidence,
        octaveMismatch: p.octave_mismatch,
      });
      return reply.status(200).send({ ok: true });
    } catch (err) {
      req.log.error({ err }, 'attempt_log insert failed');
      return reply.status(502).send({ ok: false, error: 'store_failed' });
    }
  });
}
