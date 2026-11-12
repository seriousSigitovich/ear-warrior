// Owner pages for the daily challenges (spec 020), behind the same Basic auth as the other /admin pages:
//   GET  /admin/challenges              -> the next days, manual or auto
//   GET  /admin/challenges/:date        -> one day's form (prefilled from the override, or from the generator)
//   POST /admin/challenges/:date        -> save an override
//   POST /admin/challenges/:date/reset  -> back to the generator
// Only days from tomorrow (UTC) may be changed; see isEditable.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import { renderChallengeForm, renderChallengesList, formFromDay, type DayRow, type FormValues } from '../challenges/adminPage.js';
import { challengesFor, isValidDate } from '../challenges/daily.js';
import { addDays, isEditable, parseDay, utcDay, type ChallengeStore } from '../challenges/override.js';

const LIST_DAYS = 14;

/** A browser form post from another site carries a different Origin; refuse it (Basic auth is sent along by the browser). */
function sameOrigin(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const field = (body: Record<string, string>, key: string): string => body[key] ?? '';

function valuesFromBody(body: Record<string, string>): FormValues {
  return {
    slots: [1, 2, 3].map((n) => ({
      type: field(body, `type${n}`),
      target: field(body, `target${n}`),
      xp: field(body, `xp${n}`),
      title: field(body, `title${n}`),
      desc: field(body, `desc${n}`),
    })),
    bonus: field(body, 'bonus'),
  };
}

export function registerAdminChallenges(
  root: FastifyInstance,
  store: ChallengeStore,
  now: () => Date = () => new Date(),
): void {
  // Encapsulated so the form parser only applies to these routes.
  root.register(async (app) => {
    app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) =>
      done(null, Object.fromEntries(new URLSearchParams(String(body)))),
    );

    const html = (reply: FastifyReply, page: string, status = 200) =>
      reply.status(status).header('cache-control', 'no-store').type('text/html; charset=utf-8').send(page);

    /** The day's date from the path when it is a real day the owner may change; otherwise the refusal is sent. */
    const editableDate = (req: FastifyRequest, reply: FastifyReply): string | null => {
      const date = String((req.params as { date?: unknown }).date ?? '');
      if (!isValidDate(date)) {
        void reply.status(404).send({ ok: false, error: 'not_found' });
        return null;
      }
      if (!isEditable(date, now())) {
        void reply.status(400).send({ ok: false, error: 'not_editable' });
        return null;
      }
      return date;
    };

    app.get('/admin/challenges', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      const today = utcDay(now());
      const to = addDays(today, LIST_DAYS - 1);
      const manual = new Map((await store.list(today, to)).map((d) => [d.date, d]));
      const rows: DayRow[] = Array.from({ length: LIST_DAYS }, (_, i) => {
        const date = addDays(today, i);
        const override = manual.get(date);
        return { date, source: override ? 'manual' : 'auto', day: override ?? challengesFor(date), editable: isEditable(date, now()) };
      });
      const saved = (req.query as { saved?: string }).saved;
      return html(reply, renderChallengesList(rows, today, saved ? `Сохранено: ${saved}` : undefined));
    });

    app.get('/admin/challenges/:date', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      const date = editableDate(req, reply);
      if (!date) return reply;
      const override = await store.get(date);
      return html(reply, renderChallengeForm(date, override ? 'manual' : 'auto', formFromDay(override ?? challengesFor(date))));
    });

    app.post('/admin/challenges/:date', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      if (!sameOrigin(req)) return reply.status(403).send({ ok: false, error: 'cross_origin' });
      const date = editableDate(req, reply);
      if (!date) return reply;
      const body = (req.body ?? {}) as Record<string, string>;
      const values = valuesFromBody(body);
      const parsed = parseDay(date, {
        challenges: values.slots.map((s) => ({ type: s.type, target: s.target, rewardXp: s.xp, title: s.title, description: s.desc })),
        allBonusXp: values.bonus,
      });
      if (!parsed.ok) {
        const source = (await store.get(date)) ? 'manual' : 'auto';
        return html(reply, renderChallengeForm(date, source, values, parsed.errors), 400);
      }
      await store.set(parsed.day);
      return reply.redirect(`/admin/challenges?saved=${date}`, 303);
    });

    app.post('/admin/challenges/:date/reset', async (req, reply) => {
      if (!authorize(req, reply)) return reply;
      if (!sameOrigin(req)) return reply.status(403).send({ ok: false, error: 'cross_origin' });
      const date = editableDate(req, reply);
      if (!date) return reply;
      await store.remove(date);
      return reply.redirect(`/admin/challenges?saved=${date}`, 303);
    });
  });
}
