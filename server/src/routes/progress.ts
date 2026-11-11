// The signed-in learner's progress, one endpoint per action (all need `Authorization: Bearer`):
//
//   POST /api/progress/attempts    one finished attempt; idempotent on its id
//   GET  /api/progress/history     tunes played at 100% + the latest tunes played (what the next pick reads)
//   GET  /api/progress/difficulty  the saved difficulty state, 404 when none
//   PUT  /api/progress/difficulty  replace the difficulty state
//   GET  /api/progress/melodies            where the learner stopped in each melody (spec 017)
//   PUT  /api/progress/melodies/:tuneId    save a place; the latest write wins
//   DELETE /api/progress/melodies/:tuneId?updated_at=…   the melody was finished
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

const TUNE_ID = /^[a-z0-9]{1,60}$/;

export const MelodyPlaceBody = z
  .object({
    phrase: z.number().int().min(0).max(99),
    phrases: z.number().int().min(1).max(100),
    grades: z
      .array(z.object({ note_results: z.array(z.unknown()).max(64), answer: z.array(z.number().int()).max(64) }))
      .max(100),
    updated_at: z.string().datetime(),
  })
  .refine((b) => b.phrase < b.phrases, 'the phrase to continue at must exist');

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

  app.get('/api/progress/melodies', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    try {
      const melodies = await progress.listMelodies(userId);
      return {
        ok: true,
        melodies: melodies.map((m) => ({
          tune_id: m.tuneId,
          phrase: m.phrase,
          phrases: m.phrases,
          grades: m.grades,
          updated_at: m.updatedAt.toISOString(),
        })),
      };
    } catch (err) {
      return failed(req, reply, err, 'progress melodies read failed');
    }
  });

  app.put('/api/progress/melodies/:tuneId', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const { tuneId } = req.params as { tuneId: string };
    const parsed = MelodyPlaceBody.safeParse(req.body ?? {});
    if (!TUNE_ID.test(tuneId) || !parsed.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    }
    const b = parsed.data;
    try {
      const stored = await progress.putMelody(userId, {
        tuneId,
        phrase: b.phrase,
        phrases: b.phrases,
        grades: b.grades,
        updatedAt: new Date(b.updated_at),
      });
      return { ok: true, stored };
    } catch (err) {
      return failed(req, reply, err, 'progress melody write failed');
    }
  });

  app.delete('/api/progress/melodies/:tuneId', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const { tuneId } = req.params as { tuneId: string };
    const at = z.string().datetime().safeParse((req.query as { updated_at?: unknown }).updated_at);
    if (!TUNE_ID.test(tuneId) || !at.success) {
      return reply.status(400).send({ ok: false, error: 'invalid_payload' });
    }
    try {
      await progress.deleteMelody(userId, tuneId, new Date(at.data));
      return { ok: true };
    } catch (err) {
      return failed(req, reply, err, 'progress melody delete failed');
    }
  });
}
