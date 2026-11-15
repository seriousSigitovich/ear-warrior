// The words on Home that depend on the learner's standing (spec 023). Pure.
import type { RankProgress } from './gamification';
import { masteryRequirement } from './levelLabels';

/** A short line under the brand: keeps an open streak going, praises a practised day, else invites. */
export function homeGreeting(streak: { days: number; practicedToday: boolean } | null): string {
  if (!streak) return 'Ready to train?';
  if (streak.practicedToday) return 'Your ear is getting stronger.';
  if (streak.days > 0) return `Keep your ${streak.days}-day streak going.`;
  return 'Ready to train?';
}

/** "40 / 100 XP": total XP against the XP the next rank asks for; just the total at the top rank. */
export function rankXpLine(rank: RankProgress): string {
  return rank.next ? `${rank.xp} / ${rank.next.requiredXp} XP` : `${rank.xp} XP`;
}

/**
 * What the next rank still needs, in one line: XP, a level to master, or both (a rank needs both). Never reads the
 * XP alone, since XP alone does not unlock a rank.
 */
export function rankGoalLine(rank: RankProgress): string {
  if (!rank.next) return 'Top rank reached';
  const xp = rank.missing.xp;
  const levels = rank.missing.levels;
  const target = `to reach ${rank.next.name}`;
  if (xp > 0 && levels.length > 0) {
    return `${xp} XP and mastery of ${masteryRequirement(levels)} ${target}`;
  }
  if (xp > 0) return `${xp} XP ${target}`;
  if (levels.length > 0) return `Master ${masteryRequirement(levels)} ${target}`;
  return `Ready for ${rank.next.name}`;
}
