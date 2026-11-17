// The server-authoritative practice routes (spec 024; all need `Authorization: Bearer`, an account or an anonymous
// session). The device sends raw taps; the server grades them against the stored answer, pays by game/xp.ts, keeps the
// ledger and answers with everything the screen shows:
//
//   POST /api/progress/phrase   one phrase check, idempotent on `check_id`
//   POST /api/phrase/hint       the first note of a phrase; recorded, halves the phrase's payout
//   POST /api/phrase/answer     the whole phrase; recorded, the phrase then pays nothing
//   GET  /api/progress/state    total XP, rank, streak, today's challenges, which phrases are passed
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthStore } from '../auth/store.js';
import { hashToken, parseBearer } from '../auth/tokens.js';
import { challengesFor, isValidDate, type DailyChallenge } from '../challenges/daily.js';
import { evaluateChallenges } from '../challenges/evaluate.js';
import type { ChallengeStore } from '../challenges/override.js';
import { PASS_ACCURACY, RANKS } from '../game/config.js';
import { gradePhrase, type PhraseGrade } from '../game/grade.js';
import { rankOf, rankUp } from '../game/rank.js';
import { streakDays } from '../game/streak.js';
import { payout } from '../game/xp.js';
import { importLegacyPhrases } from '../progress/legacy.js';
import type { LedgerStore, StoredCheck } from '../progress/ledger.js';
import { phraseMidis } from '../tunes/notes.js';
import type { Tune, TuneStore } from '../tunes/store.js';
import { isVisible } from '../tunes/validate.js';

export interface PhraseDeps {
  auth: AuthStore;
  tunes: TuneStore;
  ledger: LedgerStore;
  /** The owner's manual challenge days (spec 020); without one, or when it fails, the generator is used. */
  challenges?: ChallengeStore;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The learner's local day may be at most this many days before (an offline queue) or one day after the server's UTC day. */
const DAYS_BACK = 14;
const DAYS_AHEAD = 1;
const CLOCK_SKEW_MS = 5 * 60_000;
const ACTIVE_DAYS = 14;

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TUNE_ID = z.string().regex(/^[a-z0-9]{1,60}$/);

export const CheckBody = z.object({
  check_id: z.string().min(1).max(100),
  tune_id: TUNE_ID,
  phrase: z.number().int().min(0).max(99),
  played: z.array(z.number().int().min(28).max(88)).max(64),
  checked_at: z.string().datetime(),
  local_day: DAY,
});
export const LegacyBody = z.object({
  phrases: z
    .array(z.object({ tune_id: TUNE_ID, phrase: z.number().int().min(0).max(99), accuracy: z.number().min(0).max(100), at: z.string().datetime() }))
    .max(500),
});
const LEGACY_MARK = 'legacy-import:done';
const RevealBody = z.object({ tune_id: TUNE_ID, phrase: z.number().int().min(0).max(99) });
const StateQuery = z.object({ date: DAY.optional() });

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** The learner's local day, kept within what a real clock can say; anything else is the server's own day. */
export function boundedDay(claimed: string, now: Date): string {
  if (!isValidDate(claimed)) return utcDay(now);
  const diff = Math.round((Date.parse(`${claimed}T00:00:00Z`) - Date.parse(`${utcDay(now)}T00:00:00Z`)) / DAY_MS);
  return diff > DAYS_AHEAD || diff < -DAYS_BACK ? utcDay(now) : claimed;
}

const noteView = (r: PhraseGrade['noteResults'][number]) => ({
  status: r.status,
  target_index: r.targetIndex,
  expected_midi: r.expectedMidi,
  detected_midi: r.detectedMidi,
});

function gradeView(check: StoredCheck) {
  const results = check.noteResults as PhraseGrade['noteResults'];
  return {
    accuracy: check.accuracy,
    passed: check.passed,
    verdict: results.length > 0 && results.every((r) => r.status === 'matched') ? 'correct' : 'incorrect',
    note_results: results.map(noteView),
  };
}

const payoutView = (check: StoredCheck) => ({
  paid: check.xp > 0,
  xp: check.xp,
  base: check.payout.base,
  level_mult: check.payout.level_mult,
  attempt_no: check.payout.attempt_no,
  attempt_factor: check.payout.attempt_factor,
  hint_factor: check.payout.hint_factor,
  cap_factor: check.payout.cap_factor,
  reason: check.payout.reason,
});

export function registerPhrase(app: FastifyInstance, deps: PhraseDeps): void {
  const { auth, tunes, ledger, challenges, now = () => new Date() } = deps;

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

  /** The visible tune and the phrase's answer notes, or the refusal that has been sent. */
  async function phraseOf(tuneId: string, phrase: number, reply: FastifyReply): Promise<{ tune: Tune; answer: number[] } | null> {
    const tune = await tunes.get(tuneId);
    const answers = tune && isVisible(tune) ? phraseMidis(tune.notes, tune.phrases) : null;
    const answer = answers?.[phrase];
    if (!tune || !answer) {
      void reply.status(404).send({ ok: false, error: 'unknown_tune' });
      return null;
    }
    return { tune, answer };
  }

  async function defsFor(day: string): Promise<{ defs: DailyChallenge[]; allBonusXp: number }> {
    const manual = await challenges?.get(day).catch(() => null);
    const { challenges: defs, allBonusXp } = manual ?? challengesFor(day);
    return { defs, allBonusXp };
  }

  async function phraseCounts(): Promise<Record<string, number>> {
    return Object.fromEntries((await tunes.list()).map((t) => [t.id, t.phrases.length]));
  }

  /** Everything the screens show, as of `day`. */
  async function stateOf(userId: string, day: string) {
    const [totals, records, counts, { defs, allBonusXp }] = await Promise.all([
      ledger.totals(userId),
      ledger.phraseRecords(userId),
      phraseCounts(),
      defsFor(day),
    ]);
    const states = evaluateChallenges(defs, records, counts, day);
    return { totals, records, counts, states, allBonusXp };
  }

  /** Pays the challenges (and the all-done bonus) the day's phrases completed and that are not paid yet. */
  async function payChallenges(userId: string, day: string, at: Date) {
    const { states, allBonusXp } = await stateOf(userId, day);
    const paid: { id: string; reward_xp: number }[] = [];
    for (const s of states) {
      if (!s.completed) continue;
      const added = await ledger.addLedger(userId, { key: `challenge:${day}:${s.id}`, kind: 'challenge', xp: s.reward_xp, breakdown: {}, localDay: day, at });
      if (added) paid.push({ id: s.id, reward_xp: s.reward_xp });
    }
    let allBonus = 0;
    if (states.every((s) => s.completed) && (await ledger.addLedger(userId, { key: `daily-all:${day}`, kind: 'daily-all', xp: allBonusXp, breakdown: {}, localDay: day, at }))) {
      allBonus = allBonusXp;
    }
    return { paid, allBonus };
  }

  function stateView(totalXp: number, days: string[], day: string, extended: boolean, states: ReturnType<typeof evaluateChallenges>, dailyBonusXp: number) {
    const recent = new Date(Date.parse(`${day}T00:00:00Z`) - ACTIVE_DAYS * DAY_MS).toISOString().slice(0, 10);
    return {
      total_xp: totalXp,
      rank: rankOf(totalXp),
      streak: { days: streakDays(days, day), extended },
      /** The local days of the last fortnight with any XP, for the week strip. */
      active_days: days.filter((d) => d >= recent && d <= day),
      challenges: states,
      /** What finishing all of the day's challenges pays on top. */
      daily_bonus_xp: dailyBonusXp,
    };
  }

  app.post('/api/progress/phrase', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const body = CheckBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ ok: false, error: 'bad_request' });
    const b = body.data;
    try {
      const t = now();
      const found = await phraseOf(b.tune_id, b.phrase, reply);
      if (!found) return reply;
      const day = boundedDay(b.local_day, t);
      const checkedAt = new Date(Math.min(Date.parse(b.checked_at), t.getTime() + CLOCK_SKEW_MS));

      const before = await ledger.totals(userId);
      const grade = gradePhrase(found.answer, b.played);
      const { check, replay } = await ledger.recordCheck(
        { userId, checkId: b.check_id, tuneId: b.tune_id, phrase: b.phrase, played: b.played, noteResults: grade.noteResults, accuracy: grade.accuracy, passed: grade.accuracy >= PASS_ACCURACY, localDay: day, checkedAt, now: t },
        (ctx) => payout({ accuracy: grade.accuracy, level: found.tune.level, attemptNo: ctx.attemptNo, hint: ctx.hint, answerShown: ctx.answerShown, baseUsedToday: ctx.baseUsedToday }),
      );

      const { paid, allBonus } = replay ? { paid: [], allBonus: 0 } : await payChallenges(userId, check.localDay, t);
      const { totals, states, allBonusXp } = await stateOf(userId, check.localDay);
      const up = replay ? null : rankUp(before.totalXp, totals.totalXp);
      return {
        ok: true,
        replay,
        grade: gradeView(check),
        payout: payoutView(check),
        state: {
          ...stateView(totals.totalXp, totals.days, check.localDay, !replay && !before.days.includes(check.localDay) && totals.days.includes(check.localDay), states, allBonusXp),
          rank_up: up,
          challenges_paid: paid,
          all_bonus_xp: allBonus,
        },
      };
    } catch (err) {
      return failed(req, reply, err, 'phrase check failed');
    }
  });

  app.post('/api/phrase/hint', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const body = RevealBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ ok: false, error: 'bad_request' });
    try {
      const found = await phraseOf(body.data.tune_id, body.data.phrase, reply);
      if (!found) return reply;
      await ledger.recordEvent(userId, body.data.tune_id, body.data.phrase, 'hint', now());
      return { ok: true, first_midi: found.answer[0] };
    } catch (err) {
      return failed(req, reply, err, 'hint failed');
    }
  });

  app.post('/api/phrase/answer', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const body = RevealBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ ok: false, error: 'bad_request' });
    try {
      const found = await phraseOf(body.data.tune_id, body.data.phrase, reply);
      if (!found) return reply;
      await ledger.recordEvent(userId, body.data.tune_id, body.data.phrase, 'answer', now());
      return { ok: true, notes: found.answer };
    } catch (err) {
      return failed(req, reply, err, 'answer failed');
    }
  });

  // One time per identity: what a learner did before the server graded phrases (research D10). The device sends the
  // accuracies it had recorded, never XP; the server pays them as first attempts under the live rules and the daily
  // cap. The mark is a zero-XP ledger row on a sentinel day, so a second call is refused.
  app.post('/api/progress/legacy-import', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const body = LegacyBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ ok: false, error: 'bad_request' });
    const t = now();
    const until = Date.parse(`${process.env.LEGACY_IMPORT_UNTIL ?? '2026-12-31'}T23:59:59Z`);
    if (t.getTime() > until) return reply.status(410).send({ ok: false, error: 'gone' });
    try {
      const marked = await ledger.addLedger(userId, { key: LEGACY_MARK, kind: 'legacy', xp: 0, breakdown: {}, localDay: '1970-01-01', at: t });
      if (!marked) return reply.status(409).send({ ok: false, error: 'already_imported' });
      const items = body.data.phrases.map((p) => ({ tuneId: p.tune_id, phrase: p.phrase, accuracy: p.accuracy, at: new Date(p.at) }));
      const { imported } = await importLegacyPhrases(ledger, tunes, userId, items, t);
      await payChallenges(userId, utcDay(t), t);
      return { ok: true, imported, total_xp: (await ledger.totals(userId)).totalXp };
    } catch (err) {
      return failed(req, reply, err, 'legacy import failed');
    }
  });

  app.get('/api/progress/state', async (req, reply) => {
    const userId = await userOf(req, reply);
    if (!userId) return reply;
    const q = StateQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ ok: false, error: 'bad_request' });
    try {
      const day = boundedDay(q.data.date ?? utcDay(now()), now());
      const { totals, records, counts, states, allBonusXp } = await stateOf(userId, day);
      const phrases: Record<string, ('passed' | 'open')[]> = {};
      for (const r of records) {
        const n = counts[r.tuneId];
        if (!n || r.phrase >= n) continue;
        phrases[r.tuneId] ??= new Array<'passed' | 'open'>(n).fill('open');
        if (r.passedDay !== null) phrases[r.tuneId][r.phrase] = 'passed';
      }
      return { ok: true, ...stateView(totals.totalXp, totals.days, day, false, states, allBonusXp), ranks: RANKS.map((r) => ({ id: r.id, name: r.name, xp: r.xp })), phrases };
    } catch (err) {
      return failed(req, reply, err, 'state failed');
    }
  });
}
