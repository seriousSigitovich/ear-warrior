// Spec 024 (FR-017): POST /admin/recompute — the one-time recompute of every account's XP from stored attempts.
// `?dry_run=1` (the default) runs against a throwaway ledger and writes nothing; `?dry_run=0` writes. Same Basic auth
// as the other /admin routes. The answer lists, per account, the old client-computed XP and the new XP and rank.
import type { FastifyInstance } from 'fastify';
import { authorize } from '../admin/basicAuth.js';
import type { LedgerStore } from '../progress/ledger.js';
import { recomputeAll } from '../progress/recompute.js';
import type { ProgressStore } from '../progress/store.js';
import type { TuneStore } from '../tunes/store.js';

export function registerAdminRecompute(
  app: FastifyInstance,
  deps: { progress: ProgressStore; tunes: TuneStore; ledger: LedgerStore; now?: () => Date },
): void {
  app.post('/admin/recompute', async (req, reply) => {
    if (!authorize(req, reply)) return reply;
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return reply.status(403).send({ ok: false, error: 'cross_origin' });
    const dryRun = (req.query as { dry_run?: string }).dry_run !== '0';
    try {
      return { ok: true, ...(await recomputeAll({ ...deps, dryRun, now: deps.now?.() ?? new Date() })) };
    } catch (err) {
      req.log.error({ err: (err as Error).message }, 'recompute failed');
      return reply.status(502).send({ ok: false, error: 'recompute_failed' });
    }
  });
}
