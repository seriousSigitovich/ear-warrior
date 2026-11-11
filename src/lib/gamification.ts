// The rules of the reward system (spec 013), pure: what a phrase pays, which rank a total of XP and a
// set of mastered levels stands at, whether a level is mastered, how the day's challenges stand. Nothing
// here stores anything and no number is written in it — they all come from the configuration, so the
// rules are unit-testable and the numbers tunable. The service (services/gamification) persists.
import { ChallengeDef, GAMIFICATION, GamificationConfig, RankDef } from '../config/gamification';

/** One melody completed at or above the pass mark: the unit mastery and the challenges count. */
export interface Completion {
  /** The attempt id: the completion is unique by it. */
  id: string;
  melodyId: string;
  /** The melody's difficulty level id (`L1`…`L9`). */
  level: string;
  /** Percent of notes landed, 0–100. */
  accuracy: number;
  /** How many helps (first note, show answer) were taken during the melody. */
  hintsUsed: number;
  /** ISO time. */
  completedAt: string;
  /** The local calendar day it happened on, fixed at that moment. */
  day: string;
}

/** What a phrase pays: `xp` = `base` + `bonus`. */
export interface PhraseReward {
  base: number;
  bonus: number;
  xp: number;
}

/** XP for a phrase checked with `accuracy` percent of its notes landed; null below the pass mark. */
export function phraseReward(
  accuracy: number,
  cfg: GamificationConfig = GAMIFICATION,
): PhraseReward | null {
  if (accuracy < cfg.passAccuracy) return null;
  const { base, accuracy90, accuracy100 } = cfg.phraseXp;
  const bonus = (accuracy >= 90 ? accuracy90 : 0) + (accuracy >= 100 ? accuracy100 : 0);
  return { base, bonus, xp: base + bonus };
}

const unique = (completions: readonly Completion[]) => [
  ...new Map(completions.map((c) => [c.id, c])).values(),
];
const chronological = (a: Completion, b: Completion) =>
  a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id);

export interface LevelMastery {
  level: string;
  /** Completions in the level. */
  completed: number;
  /** Average accuracy of the latest completions (the window); null with none. */
  recentAverage: number | null;
  withoutHints: number;
  mastered: boolean;
  /** Each criterion as have/need, for showing what is left. */
  needs: {
    completed: { have: number; need: number };
    average: { have: number; need: number };
    withoutHints: { have: number; need: number };
  };
}

/** Whether `level` is mastered by these completions, and how close each criterion is. */
export function levelMastery(
  completions: readonly Completion[],
  level: string,
  cfg: GamificationConfig = GAMIFICATION,
): LevelMastery {
  const ofLevel = unique(completions)
    .filter((c) => c.level === level)
    .sort(chronological);
  const recent = ofLevel.slice(-cfg.mastery.recentWindow);
  const recentAverage = recent.length
    ? Math.round(recent.reduce((sum, c) => sum + c.accuracy, 0) / recent.length)
    : null;
  const withoutHints = ofLevel.filter((c) => c.hintsUsed === 0).length;
  const m = cfg.mastery;
  return {
    level,
    completed: ofLevel.length,
    recentAverage,
    withoutHints,
    mastered:
      ofLevel.length >= m.minCompleted &&
      recentAverage !== null &&
      recentAverage >= m.minRecentAverage &&
      withoutHints >= m.minWithoutHints,
    needs: {
      completed: { have: ofLevel.length, need: m.minCompleted },
      average: { have: recentAverage ?? 0, need: m.minRecentAverage },
      withoutHints: { have: withoutHints, need: m.minWithoutHints },
    },
  };
}

/** When `level` was first mastered: the time of the completion that made the criteria hold, else null. */
export function masteredAt(
  completions: readonly Completion[],
  level: string,
  cfg: GamificationConfig = GAMIFICATION,
): string | null {
  const ordered = unique(completions)
    .filter((c) => c.level === level)
    .sort(chronological);
  for (let n = cfg.mastery.minCompleted; n <= ordered.length; n++) {
    if (levelMastery(ordered.slice(0, n), level, cfg).mastered) return ordered[n - 1].completedAt;
  }
  return null;
}

export interface RankProgress {
  index: number;
  id: string;
  name: string;
  xp: number;
  /** The rank above; null at the top. */
  next: RankDef | null;
  /** What the next rank still needs: XP remaining (0 when met) and the level ids not yet mastered. */
  missing: { xp: number; levels: string[] };
  /** 0–100: how far the XP is through this rank towards the next one's XP. */
  pct: number;
  /** The XP for the next rank is there but its mastery is not: the lock the learner has to clear. */
  locked: boolean;
}

/**
 * The rank for a total of XP and the levels mastered: the highest one whose XP and mastery — and those of
 * every rank below it — are met. XP alone never unlocks a rank.
 */
export function rankProgress(
  xp: number,
  mastered: Iterable<string>,
  cfg: GamificationConfig = GAMIFICATION,
): RankProgress {
  const have = new Set(mastered);
  const missingLevels = (r: RankDef) => r.requiredMastery.filter((l) => !have.has(l));
  let index = 0;
  while (
    cfg.ranks[index + 1] &&
    xp >= cfg.ranks[index + 1].requiredXp &&
    missingLevels(cfg.ranks[index + 1]).length === 0
  ) {
    index++;
  }
  const rank = cfg.ranks[index];
  const next = cfg.ranks[index + 1] ?? null;
  if (!next) {
    return {
      index,
      id: rank.id,
      name: rank.name,
      xp,
      next,
      missing: { xp: 0, levels: [] },
      pct: 100,
      locked: false,
    };
  }
  const span = next.requiredXp - rank.requiredXp;
  const levels = missingLevels(next);
  return {
    index,
    id: rank.id,
    name: rank.name,
    xp,
    next,
    missing: { xp: Math.max(0, next.requiredXp - xp), levels },
    pct: Math.max(0, Math.min(100, Math.round(((xp - rank.requiredXp) / span) * 100))),
    locked: xp >= next.requiredXp && levels.length > 0,
  };
}

/** The new rank's name when going from `before` to `after` raised the rank, else null. */
export function rankUp(before: RankProgress, after: RankProgress): string | null {
  return after.index > before.index ? after.name : null;
}

export interface ChallengeState {
  id: string;
  title: string;
  description: string;
  progress: number;
  /** What `progress` counts up to (a melody at the accuracy mark counts as 1 of 1). */
  target: number;
  rewardXp: number;
  completed: boolean;
}

const progressOf = (
  def: ChallengeDef,
  today: readonly Completion[],
): { progress: number; target: number } => {
  if (def.type === 'accuracy') {
    return { progress: today.some((c) => c.accuracy >= def.target) ? 1 : 0, target: 1 };
  }
  return { progress: Math.min(def.target, today.length), target: def.target };
};

/** The day's challenges as they stand, from the completions of that local day. */
export function challengeStates(
  day: string,
  completions: readonly Completion[],
  cfg: GamificationConfig = GAMIFICATION,
): ChallengeState[] {
  const today = unique(completions).filter((c) => c.day === day);
  return cfg.challenges.map((def) => {
    const { progress, target } = progressOf(def, today);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      progress,
      target,
      rewardXp: def.rewardXp,
      completed: progress >= target,
    };
  });
}

/** How many of the day's challenges are not yet completed. */
export function challengesLeft(states: readonly ChallengeState[]): number {
  return states.filter((c) => !c.completed).length;
}
