// What a finished melody shows on its closing card (spec 013, 024): the XP it earned and from what, where that leaves
// the rank, and how the day stands. Pure, so the card only draws; every number comes from the server's answers.
import type { RankView, RewardsView } from './types';

export interface GameSummary {
  earnedXp: number;
  /** What the XP is made of: "phrases +45", "challenges +30", "all challenges +25". */
  parts: string[];
  rank: RankView;
  /** Total XP, for the rank bar's label. */
  totalXp: number;
  challengesDone: number;
  challengesTotal: number;
  streakDays: number;
}

/** XP a melody's phrases and the challenges they completed paid while it was played, as the server reported them. */
export interface MelodyEarnings {
  phrases: number;
  challenges: number;
  allBonus: number;
}

/** The summary of a melody; null until the standing is known. */
export function gameSummary(earned: MelodyEarnings, view: RewardsView | null): GameSummary | null {
  if (!view) return null;
  const parts: string[] = [];
  if (earned.phrases > 0) parts.push(`phrases +${earned.phrases}`);
  if (earned.challenges > 0) parts.push(`challenges +${earned.challenges}`);
  if (earned.allBonus > 0) parts.push(`all challenges +${earned.allBonus}`);
  return {
    earnedXp: earned.phrases + earned.challenges + earned.allBonus,
    parts,
    rank: view.rank,
    totalXp: view.totalXp,
    challengesDone: view.challenges.filter((c) => c.completed).length,
    challengesTotal: view.challenges.length,
    streakDays: view.streak.days,
  };
}
