// What a finished melody shows on its closing card (spec 013): the XP it earned and from what, where
// that leaves the rank, any level just mastered, and how the day stands. Pure, so the card only draws.
import { RankProgress } from '../../lib/gamification';
import { CompletionResult, Snapshot } from './service';

export interface GameSummary {
  earnedXp: number;
  /** What the XP is made of: "phrases +45", "challenges +30", "all challenges +25". */
  parts: string[];
  rank: RankProgress;
  /** Level ids mastered with this melody. */
  masteryUnlocked: string[];
  challengesDone: number;
  challengesTotal: number;
  streakDays: number;
  /** The melody counted as completed (at or above the pass mark). */
  completed: boolean;
}

/**
 * The summary of a melody: `phraseXp` is what its phrases paid while it was played, `result` is the
 * completion (null when it did not reach the pass mark), `snap` the standing afterwards. Null until
 * the standing is known.
 */
export function gameSummary(
  phraseXp: number,
  result: CompletionResult | null,
  snap: Snapshot | null,
): GameSummary | null {
  if (!snap) return null;
  const challengeXp = result?.challengesCompleted.reduce((sum, c) => sum + c.rewardXp, 0) ?? 0;
  const bonusXp = result?.allChallengesBonus ?? 0;
  const parts: string[] = [];
  if (phraseXp > 0) parts.push(`phrases +${phraseXp}`);
  if (challengeXp > 0) parts.push(`challenges +${challengeXp}`);
  if (bonusXp > 0) parts.push(`all challenges +${bonusXp}`);
  return {
    earnedXp: phraseXp + challengeXp + bonusXp,
    parts,
    rank: snap.rank,
    masteryUnlocked: result?.masteryUnlocked ?? [],
    challengesDone: snap.challenges.filter((c) => c.completed).length,
    challengesTotal: snap.challenges.length,
    streakDays: snap.streak.days,
    completed: result !== null,
  };
}
