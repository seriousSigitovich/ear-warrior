// Challenge progress from the phrases the server accepted (spec 024, FR-018). Pure.
//
//   A melody is completed on the day its last phrase was passed, when every one of its phrases has been passed. A
//   melody that is played again changes nothing: its phrases passed once, so its completion day is fixed.
//   `melodies` counts the melodies completed that day; `accuracy` is met by one melody completed that day whose
//   phrases' first-try accuracies average at least the target.
import type { PhraseRecord } from '../progress/ledger.js';
import type { DailyChallenge } from './daily.js';

export interface ChallengeState {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward_xp: number;
  completed: boolean;
}

interface Completion {
  day: string;
  accuracy: number;
}

/** The completed melodies of the account with the day each was completed and its mean first-try accuracy. */
export function completions(records: readonly PhraseRecord[], phraseCounts: Readonly<Record<string, number>>): Completion[] {
  const byTune = new Map<string, PhraseRecord[]>();
  for (const r of records) byTune.set(r.tuneId, [...(byTune.get(r.tuneId) ?? []), r]);
  const out: Completion[] = [];
  for (const [tuneId, rs] of byTune) {
    const count = phraseCounts[tuneId];
    if (!count) continue;
    const passed = rs.filter((r) => r.passedDay !== null && r.phrase < count);
    if (passed.length !== count) continue;
    const day = passed.map((r) => r.passedDay as string).sort().at(-1) as string;
    out.push({ day, accuracy: passed.reduce((sum, r) => sum + r.firstAccuracy, 0) / count });
  }
  return out;
}

export function evaluateChallenges(
  defs: readonly DailyChallenge[],
  records: readonly PhraseRecord[],
  phraseCounts: Readonly<Record<string, number>>,
  day: string,
): ChallengeState[] {
  const today = completions(records, phraseCounts).filter((c) => c.day === day);
  return defs.map((def) => {
    const [progress, target] =
      def.type === 'accuracy'
        ? [today.some((c) => c.accuracy >= def.target) ? 1 : 0, 1]
        : [Math.min(def.target, today.length), def.target];
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      progress,
      target,
      reward_xp: def.rewardXp,
      completed: progress >= target,
    };
  });
}
