// The signed-in learner's progress, one endpoint per action (all need `Authorization: Bearer`):
//
//   POST /api/progress/attempts    one finished attempt; idempotent on its id
//   GET  /api/progress/history     tunes played at 100% + the latest tunes played (what the next pick reads)
//   GET  /api/progress/difficulty  the saved difficulty state, 404 when none
//   PUT  /api/progress/difficulty  replace the difficulty state
//
// Without a valid session every route answers 401 and the app simply stays on its local cache.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthStore } from '../auth/store.js';
import { hashToken, parseBearer } from '../auth/tokens.js';
import type { ProgressStore } from '../progress/store.js';

export interface ProgressDeps {
  auth: AuthStore;
  progress: ProgressStore;
  now?: () => Date;
}

/** `<tune id>-<seed>`; tune ids hold no hyphen (src/services/melody/curated.ts). */
const tuneIdOf = (melodyId: string) => melodyId.split('-')[0];

export const AttemptBody = z.object({
  id: z.string().min(1).max(200),
  session_id: z.string().min(1).max(200),
  melody_id: z.string().min(1).max(200),
  verdict: z.enum(['correct', 'incorrect']),
  confidence: z.number(),
  low_confidence: z.boolean(),
  timed_out: z.boolean(),
  input_mode: z.enum(['mic', 'fretboard']).default('mic'),
  note_results: z.array(z.unknown()).max(64),
  created_at: z.string().datetime(),
});

export const DifficultyBody = z.object({
  mode: z.enum(['adaptive', 'fixed']),
  adaptive_rank: z.number().int().min(1).max(9),
  fixed_rank: z.number().int().min(1).max(9),
  streak_kind: z.enum(['correct', 'incorrect', 'none']),
  streak_count: z.number().int().nonnegative(),
});

export function registerProgress(app: FastifyInstance, { auth, progress, now = () => new Date() }: ProgressDeps): void {
  /** The account behind the bearer token, or null after answering 401. */
  async function userOf(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const token = parseBearer(req.headers.authorization);
    const info = token ? await auth.sessionByToken(hashToken(token)) : null;
    if (!info) {
      void reply.status(401).send({ ok: false, error: 'invalid_session' });
      return null;
    }
    return info.userId;
  }

  const failed = (req: FastifyRequest, reply: FastifyReply, err: unknown, what: string) => {
    req.log.error({ err: (err as Error).message }, what);
    return reply.status(502).send({ ok: false, error: 'store_failed' });
  };

  app.post('/api/progress/attempts', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const parsed = AttemptBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    const b = parsed.data;
    try {
      await progress.addAttempt(userId, {
        id: b.id,
        sessionId: b.session_id,
        melodyId: b.melody_id,
        tuneId: tuneIdOf(b.melody_id),
        verdict: b.verdict,
        confidence: b.confidence,
        lowConfidence: b.low_confidence,
        timedOut: b.timed_out,
        inputMode: b.input_mode,
        noteResults: b.note_results,
        createdAt: new Date(b.created_at),
      });
    } catch (err) {
      return failed(req, reply, err, 'progress attempt failed');
    }
    return { ok: true };
  });

  app.get('/api/progress/history', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    try {
      const { mastered, recent } = await progress.history(userId);
      return { ok: true, mastered, recent };
    } catch (err) {
      return failed(req, reply, err, 'progress history failed');
    }
  });

  app.get('/api/progress/difficulty', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    try {
      const d = await progress.getDifficulty(userId);
      if (!d) return reply.status(404).send({ ok: false, error: 'not_found' });
      return {
        ok: true,
        mode: d.mode,
        adaptive_rank: d.adaptiveRank,
        fixed_rank: d.fixedRank,
        streak_kind: d.streakKind,
        streak_count: d.streakCount,
      };
    } catch (err) {
      return failed(req, reply, err, 'progress difficulty read failed');
    }
  });

  app.put('/api/progress/difficulty', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const parsed = DifficultyBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    const b = parsed.data;
    try {
      await progress.putDifficulty(
        userId,
        { mode: b.mode, adaptiveRank: b.adaptive_rank, fixedRank: b.fixed_rank, streakKind: b.streak_kind, streakCount: b.streak_count },
        now(),
      );
    } catch (err) {
      return failed(req, reply, err, 'progress difficulty write failed');
    }
    return { ok: true };
  });
}
