// Spec 024 (FR-017, research D10): XP for what a learner did before the server graded phrases. Both the one-time
// recompute from stored attempts and the one-time import from a device go through here: each item is a phrase that
// was passed, with the accuracy it was passed at. The server computes the XP — first attempt, no hint — through the
// same checks as a live phrase, so the daily cap, the "pays once" rule and the ledger keys are the live ones, and the
// phrase counts as passed afterwards. `legacy:<tune>:<phrase>` is the check id: running it again changes nothing.
import { PASS_ACCURACY } from '../game/config.js';
import { payout } from '../game/xp.js';
import type { TuneStore } from '../tunes/store.js';
import type { LedgerStore } from './ledger.js';

export interface LegacyPhrase {
  tuneId: string;
  phrase: number;
  /** Percent of the phrase's notes landed when it was passed. */
  accuracy: number;
  at: Date;
}

export interface LegacyResult {
  imported: number;
  /** Items skipped: unknown tune or phrase, below the pass mark, or already counted. */
  skipped: number;
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

export async function importLegacyPhrases(
  ledger: LedgerStore,
  tunes: TuneStore,
  userId: string,
  items: readonly LegacyPhrase[],
  now: Date,
): Promise<LegacyResult> {
  let imported = 0;
  let skipped = 0;
  // Oldest first, so the daily cap fills the way it would have then.
  const ordered = [...items].sort((a, b) => a.at.getTime() - b.at.getTime());
  const known = new Map<string, Awaited<ReturnType<TuneStore['get']>>>();
  for (const item of ordered) {
    if (!known.has(item.tuneId)) known.set(item.tuneId, await tunes.get(item.tuneId));
    const tune = known.get(item.tuneId);
    const accuracy = Math.max(0, Math.min(100, Math.round(item.accuracy)));
    if (!tune || item.phrase < 0 || item.phrase >= tune.phrases.length || !(accuracy >= PASS_ACCURACY) || Number.isNaN(item.at.getTime())) {
      skipped++;
      continue;
    }
    const at = item.at.getTime() > now.getTime() ? now : item.at;
    const { replay, check } = await ledger.recordCheck(
      { userId, checkId: `legacy:${item.tuneId}:${item.phrase}`, tuneId: item.tuneId, phrase: item.phrase, played: [], noteResults: [], accuracy, passed: true, localDay: utcDay(at), checkedAt: at, now },
      (ctx) => payout({ accuracy, level: tune.level, attemptNo: 1, hint: false, answerShown: false, baseUsedToday: ctx.baseUsedToday }),
    );
    // A phrase the account already passed live comes back as `already_paid`: counted once, not imported.
    if (replay || check.payout.reason === 'already_paid') skipped++;
    else imported++;
  }
  return { imported, skipped };
}

/** Percent of the answer's notes landed in each phrase, from an old attempt's per-note results; null when they cannot be split. */
export function legacyPhraseAccuracies(noteResults: readonly unknown[], phrases: readonly number[]): number[] | null {
  const targets: { index: number; matched: boolean }[] = [];
  for (const r of noteResults) {
    const o = r as { targetIndex?: unknown; status?: unknown } | null;
    if (!o || typeof o !== 'object') return null;
    if (o.targetIndex === null) continue; // an extra note belongs to no phrase
    if (typeof o.targetIndex !== 'number' || typeof o.status !== 'string') return null;
    targets.push({ index: o.targetIndex, matched: o.status === 'matched' });
  }
  targets.sort((a, b) => a.index - b.index);
  if (targets.length !== phrases.reduce((a, b) => a + b, 0)) return null;
  let from = 0;
  return phrases.map((len) => {
    const slice = targets.slice(from, from + len);
    from += len;
    return slice.length === 0 ? 0 : Math.round((slice.filter((t) => t.matched).length / slice.length) * 100);
  });
}
