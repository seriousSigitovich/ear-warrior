// Spec 024 (FR-017): the one-time recompute of every account's XP from the attempts the server already stores, under
// the new rules. Idempotent (see legacy.ts). With `dryRun` it runs against a throwaway ledger and writes nothing, and
// reports per account what the old client-computed XP was and what the new rules give, so the owner can look at it.
import { rankOf } from '../game/rank.js';
import type { TuneStore } from '../tunes/store.js';
import type { LedgerStore } from './ledger.js';
import { createMemoryLedgerStore } from './ledgerMemoryStore.js';
import { importLegacyPhrases, legacyPhraseAccuracies, type LegacyPhrase } from './legacy.js';
import type { ProgressStore } from './store.js';

export interface RecomputeRow {
  userId: string;
  attempts: number;
  /** What the client had computed and pushed: the sum of its award rows (the old rules). */
  oldXp: number;
  newXp: number;
  newRank: string;
  phrases: number;
}

export interface RecomputeReport {
  dryRun: boolean;
  accounts: number;
  rows: RecomputeRow[];
  /** How many accounts end on each rank (new rules). */
  byRank: Record<string, number>;
}

const PAGE = 500;

async function oldXpOf(progress: ProgressStore, userId: string): Promise<number> {
  let after = 0;
  let sum = 0;
  for (;;) {
    const page = await progress.gameRowsAfter(userId, after, PAGE);
    for (const r of page.rows) if (r.kind === 'award') sum += Number((r.data as { xp?: unknown }).xp) || 0;
    if (!page.more) return sum;
    after = page.next;
  }
}

/** The passed phrases of an account, the first attempt that passed each (the old rule), oldest first. */
async function passedPhrases(progress: ProgressStore, tunes: TuneStore, userId: string): Promise<{ items: LegacyPhrase[]; attempts: number }> {
  const items = new Map<string, LegacyPhrase>();
  let after = 0;
  let attempts = 0;
  const library = new Map<string, number[] | null>();
  const ordered = [];
  for (;;) {
    const page = await progress.attemptsAfter(userId, after, PAGE);
    ordered.push(...page.attempts);
    attempts += page.attempts.length;
    if (!page.more) break;
    after = page.next;
  }
  ordered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const a of ordered) {
    if (a.inputMode !== 'fretboard' || a.timedOut) continue;
    if (!library.has(a.tuneId)) library.set(a.tuneId, (await tunes.get(a.tuneId))?.phrases ?? null);
    const phrases = library.get(a.tuneId);
    if (!phrases) continue;
    const accuracies = legacyPhraseAccuracies(a.noteResults, phrases);
    accuracies?.forEach((accuracy, phrase) => {
      const key = `${a.tuneId}:${phrase}`;
      if (accuracy >= 80 && !items.has(key)) items.set(key, { tuneId: a.tuneId, phrase, accuracy, at: a.createdAt });
    });
  }
  return { items: [...items.values()], attempts };
}

export async function recomputeAll(deps: {
  progress: ProgressStore;
  tunes: TuneStore;
  ledger: LedgerStore;
  dryRun: boolean;
  now: Date;
}): Promise<RecomputeReport> {
  const ledger = deps.dryRun ? createMemoryLedgerStore() : deps.ledger;
  const users = await deps.progress.accountsWithAttempts();
  const rows: RecomputeRow[] = [];
  for (const userId of users) {
    const { items, attempts } = await passedPhrases(deps.progress, deps.tunes, userId);
    await importLegacyPhrases(ledger, deps.tunes, userId, items, deps.now);
    const { totalXp } = await ledger.totals(userId);
    rows.push({ userId, attempts, oldXp: await oldXpOf(deps.progress, userId), newXp: totalXp, newRank: rankOf(totalXp).id, phrases: items.length });
  }
  const byRank: Record<string, number> = {};
  for (const r of rows) byRank[r.newRank] = (byRank[r.newRank] ?? 0) + 1;
  return { dryRun: deps.dryRun, accounts: rows.length, rows, byRank };
}
