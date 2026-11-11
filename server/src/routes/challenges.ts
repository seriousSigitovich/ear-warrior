// GET /api/challenges/today?date=YYYY-MM-DD → the three challenges of the learner's local day (spec 018).
// Public: the answer depends on the date alone and carries nothing about the learner. The app sends its own
// local date, so the server never has to guess a timezone; any date within two days of now is accepted
// (every timezone is within one), anything else is refused.
import type { FastifyInstance } from 'fastify';
import { challengesFor, isValidDate } from '../challenges/daily.js';

export interface ChallengesDeps {
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 2;

export function registerChallenges(app: FastifyInstance, { now = () => new Date() }: ChallengesDeps = {}): void {
  app.get('/api/challenges/today', async (req, reply) => {
    const date = String((req.query as { date?: unknown }).date ?? '');
    const asked = isValidDate(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
    const today = Date.parse(`${now().toISOString().slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(asked) || Math.abs(asked - today) > WINDOW_DAYS * DAY_MS) {
      return reply.status(400).send({ ok: false, error: 'invalid_date' });
    }
    const { challenges, allBonusXp } = challengesFor(date);
    void reply.header('Cache-Control', 'public, max-age=300');
    return {
      ok: true,
      date,
      all_bonus_xp: allBonusXp,
      challenges: challenges.map((c) => ({
        id: c.id,
        type: c.type,
        target: c.target,
        reward_xp: c.rewardXp,
        title: c.title,
        description: c.description,
      })),
    };
  });
}
