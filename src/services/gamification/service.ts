// The XP service (spec 013): the one place XP is awarded, mastery recorded and challenges paid. It
// persists over the local `RowStore` and nothing else decides a reward.
//
// Every award is an append-only row with a deterministic id (`phrase:<melody>:<n>`,
// `challenge:<day>:<id>`, `daily-all:<day>`), so reporting something twice — a retry, a crash, two
// taps — finds the row and does nothing: awards are idempotent by construction, and what was paid stays
// paid when the configuration changes later. Calls are serialised, so two reports at once cannot both
// find the row missing. Days are the learner's local calendar day, fixed when the award is made.
import { GAMIFICATION, GamificationConfig } from '../../config/gamification';
import {
  ChallengeState,
  Completion,
  LevelMastery,
  RankProgress,
  challengeStates,
  levelMastery,
  masteredAt,
  phraseReward,
  rankProgress,
  rankUp,
} from '../../lib/gamification';
import { phraseLengths } from '../../lib/phrases';
import { scoreOf } from '../../lib/review';
import { activeStreak, dayKey } from '../../lib/streak';
import { Attempt, Melody, NoteResult } from '../../models';
import {
  ATTEMPTS_TABLE,
  COMPLETIONS_TABLE,
  GAMIFICATION_META_TABLE,
  MASTERY_TABLE,
  MELODIES_TABLE,
  RowStore,
  XP_AWARDS_TABLE,
} from '../storage/db';
import { allLevels } from '../melody/levels';

interface AwardRow {
  id: string;
  kind: 'phrase' | 'challenge' | 'daily-all';
  xp: number;
  /** Local calendar day, fixed at award time. */
  day: string;
  at: string;
  level?: string;
  accuracy?: number;
}

interface MasteryRow {
  id: string;
  level: string;
  achievedAt: string;
}

export interface StreakChange {
  days: number;
  /** This was the day's first practice. */
  extended: boolean;
}

export interface PhraseInput {
  /** The play of the melody (its served id): a phrase pays once per play. */
  melodyId: string;
  phrase: number;
  /** Percent of the phrase's notes landed. */
  accuracy: number;
  level: string;
  /** The answer was shown to the learner for this phrase (Show answer): it pays nothing. */
  answerShown?: boolean;
  at?: Date;
}

export interface PhraseAward {
  id: string;
  xp: number;
  base: number;
  bonus: number;
  level: string;
  accuracy: number;
  totalXp: number;
  rank: RankProgress;
  rankUp: string | null;
  streak: StreakChange;
}

export interface CompletionInput {
  /** The attempt id: a completion is unique by it. */
  id: string;
  melodyId: string;
  level: string;
  accuracy: number;
  hintsUsed: number;
  at?: Date;
}

export interface CompletionResult {
  completion: Completion;
  /** Level ids that reached Mastered with this melody. */
  masteryUnlocked: string[];
  challengesCompleted: { id: string; rewardXp: number }[];
  /** The XP for finishing all the day's challenges, 0 unless this melody finished them. */
  allChallengesBonus: number;
  rankUp: string | null;
  totalXp: number;
  rank: RankProgress;
  streak: StreakChange;
}

export interface LevelStatus extends LevelMastery {
  /** ISO time mastery was reached; null while not mastered. */
  achievedAt: string | null;
}

export interface Snapshot {
  totalXp: number;
  rank: RankProgress;
  /** One per level of the ladder, easiest first. */
  mastery: LevelStatus[];
  /** The local day the snapshot is for. */
  today: string;
  challenges: (ChallengeState & { claimed: boolean })[];
  allChallengesDone: boolean;
  streak: { days: number; practicedToday: boolean };
  /** Days with practice, for the week strip. */
  activeDays: ReadonlySet<string>;
}

export interface GamificationService {
  /** Convert attempts recorded before this system existed, once. Safe to call every launch. */
  init(): Promise<void>;
  /** A phrase was checked. Null when it pays nothing (below the pass mark, or already paid). */
  phraseChecked(input: PhraseInput): Promise<PhraseAward | null>;
  /** A melody was finished. Null when it is not a completion (below the pass mark, or reported before). */
  exerciseCompleted(input: CompletionInput): Promise<CompletionResult | null>;
  snapshot(): Promise<Snapshot>;
  /** The day's challenges were shown. True the first time on a local day. */
  markChallengesStarted(): Promise<boolean>;
}

export interface GamificationDeps {
  store: RowStore;
  now?: () => Date;
  cfg?: GamificationConfig;
}

const BACKFILL_KEY = 'backfill_v1';

/** Percent of notes landed in each phrase of a tune, from its note results. */
function phraseAccuracies(results: readonly NoteResult[], lengths: readonly number[]): number[] {
  const targets = results
    .filter((r) => r.targetIndex !== null)
    .sort((a, b) => (a.targetIndex as number) - (b.targetIndex as number));
  let from = 0;
  return lengths.map((len) => {
    const pct = scoreOf(targets.slice(from, from + len)).pct;
    from += len;
    return pct;
  });
}

export function createGamificationService(deps: GamificationDeps): GamificationService {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const cfg = deps.cfg ?? GAMIFICATION;
  const ladder = allLevels().map((l) => l.id);

  // One call at a time: the check-then-insert of an award must not interleave with another's.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const load = async () => {
    const [completions, awards, mastery] = await Promise.all([
      store.all<Completion>(COMPLETIONS_TABLE),
      store.all<AwardRow>(XP_AWARDS_TABLE),
      store.all<MasteryRow>(MASTERY_TABLE),
    ]);
    const totalXp = awards.reduce((sum, a) => sum + Math.max(0, a.xp), 0);
    const mastered = mastery.map((m) => m.level);
    const activeDays = new Set<string>([
      ...awards.map((a) => a.day),
      ...completions.map((c) => c.day),
    ]);
    return {
      completions,
      awards,
      mastery,
      totalXp,
      mastered,
      activeDays,
      rank: rankProgress(totalXp, mastered, cfg),
    };
  };

  const streakAfter = (
    before: ReadonlySet<string>,
    after: ReadonlySet<string>,
    day: string,
  ): StreakChange => ({
    days: activeStreak(after, day),
    extended: !before.has(day),
  });

  async function awardPhrase(input: PhraseInput): Promise<PhraseAward | null> {
    const reward =
      Number.isFinite(input.accuracy) && !input.answerShown
        ? phraseReward(input.accuracy, cfg)
        : null;
    if (!reward || reward.xp <= 0) return null;
    const id = `phrase:${input.melodyId}:${input.phrase}`;
    if (await store.getById(XP_AWARDS_TABLE, id)) return null;

    const before = await load();
    const at = input.at ?? now();
    const day = dayKey(at);
    const row: AwardRow = {
      id,
      kind: 'phrase',
      xp: reward.xp,
      day,
      at: at.toISOString(),
      level: input.level,
      accuracy: input.accuracy,
    };
    await store.insert(XP_AWARDS_TABLE, id, row as unknown as Record<string, unknown>);
    const after = await load();
    return {
      id,
      xp: reward.xp,
      base: reward.base,
      bonus: reward.bonus,
      level: input.level,
      accuracy: input.accuracy,
      totalXp: after.totalXp,
      rank: after.rank,
      rankUp: rankUp(before.rank, after.rank),
      streak: streakAfter(before.activeDays, after.activeDays, day),
    };
  }

  async function recordCompletion(input: CompletionInput): Promise<CompletionResult | null> {
    if (!Number.isFinite(input.accuracy) || input.accuracy < cfg.passAccuracy) return null;
    if (await store.getById(COMPLETIONS_TABLE, input.id)) return null;

    const before = await load();
    const at = input.at ?? now();
    const day = dayKey(at);
    const completion: Completion = {
      id: input.id,
      melodyId: input.melodyId,
      level: input.level,
      accuracy: input.accuracy,
      hintsUsed: input.hintsUsed,
      completedAt: at.toISOString(),
      day,
    };
    await store.insert(
      COMPLETIONS_TABLE,
      completion.id,
      completion as unknown as Record<string, unknown>,
    );
    const completions = [...before.completions, completion];

    // Mastery: recorded the first time the criteria hold, never removed.
    const masteryUnlocked: string[] = [];
    if (
      !before.mastered.includes(input.level) &&
      levelMastery(completions, input.level, cfg).mastered
    ) {
      const row: MasteryRow = {
        id: input.level,
        level: input.level,
        achievedAt: completion.completedAt,
      };
      await store.insert(MASTERY_TABLE, row.id, row as unknown as Record<string, unknown>);
      masteryUnlocked.push(input.level);
    }

    // Challenges: each reward and the all-done bonus are rows too, so each is paid once.
    const states = challengeStates(day, completions, cfg);
    const challengesCompleted: { id: string; rewardXp: number }[] = [];
    for (const state of states) {
      const id = `challenge:${day}:${state.id}`;
      if (!state.completed || (await store.getById(XP_AWARDS_TABLE, id))) continue;
      const row: AwardRow = {
        id,
        kind: 'challenge',
        xp: state.rewardXp,
        day,
        at: completion.completedAt,
      };
      await store.insert(XP_AWARDS_TABLE, id, row as unknown as Record<string, unknown>);
      challengesCompleted.push({ id: state.id, rewardXp: state.rewardXp });
    }
    let allChallengesBonus = 0;
    const allId = `daily-all:${day}`;
    if (states.every((s) => s.completed) && !(await store.getById(XP_AWARDS_TABLE, allId))) {
      const row: AwardRow = {
        id: allId,
        kind: 'daily-all',
        xp: cfg.allChallengesBonus,
        day,
        at: completion.completedAt,
      };
      await store.insert(XP_AWARDS_TABLE, allId, row as unknown as Record<string, unknown>);
      allChallengesBonus = cfg.allChallengesBonus;
    }

    const after = await load();
    return {
      completion,
      masteryUnlocked,
      challengesCompleted,
      allChallengesBonus,
      rankUp: rankUp(before.rank, after.rank),
      totalXp: after.totalXp,
      rank: after.rank,
      streak: streakAfter(before.activeDays, after.activeDays, day),
    };
  }

  async function convertPastAttempts(): Promise<void> {
    if (await store.getById(GAMIFICATION_META_TABLE, BACKFILL_KEY)) return;
    const pending: { table: string; id: string; row: Record<string, unknown> }[] = [];
    const [attempts, melodies] = await Promise.all([
      store.all<Attempt>(ATTEMPTS_TABLE),
      store.all<Melody>(MELODIES_TABLE),
    ]);
    const melodyOf = new Map(melodies.map((m) => [m.id, m]));
    const completions: Completion[] = [];
    const ordered = attempts
      .filter((a) => a.inputMode === 'fretboard' && !a.timedOut)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const a of ordered) {
      const melody = melodyOf.get(a.melodyId);
      if (!melody) continue;
      const at = new Date(a.createdAt);
      if (Number.isNaN(at.getTime())) continue;
      const day = dayKey(at);
      // Past phrases: the first try at each, as the attempt kept them.
      const lengths = phraseLengths(melody);
      phraseAccuracies(a.noteResults, lengths).forEach((accuracy, i) => {
        const reward = phraseReward(accuracy, cfg);
        const id = `phrase:${a.melodyId}:${i}`;
        if (!reward) return;
        const row: AwardRow = {
          id,
          kind: 'phrase',
          xp: reward.xp,
          day,
          at: a.createdAt,
          level: melody.difficultyId,
          accuracy,
        };
        pending.push({
          table: XP_AWARDS_TABLE,
          id,
          row: row as unknown as Record<string, unknown>,
        });
      });
      const accuracy = scoreOf(a.noteResults).pct;
      if (accuracy >= cfg.passAccuracy) {
        // Hints were not recorded before this system: past completions count as without hints.
        completions.push({
          id: a.id,
          melodyId: a.melodyId,
          level: melody.difficultyId,
          accuracy,
          hintsUsed: 0,
          completedAt: a.createdAt,
          day,
        });
      }
    }
    for (const c of completions) {
      pending.push({
        table: COMPLETIONS_TABLE,
        id: c.id,
        row: c as unknown as Record<string, unknown>,
      });
    }
    for (const level of ladder) {
      const achievedAt = masteredAt(completions, level, cfg);
      if (achievedAt) {
        const row: MasteryRow = { id: level, level, achievedAt };
        pending.push({
          table: MASTERY_TABLE,
          id: level,
          row: row as unknown as Record<string, unknown>,
        });
      }
    }
    for (const p of pending.splice(0)) {
      if (!(await store.getById(p.table, p.id))) await store.insert(p.table, p.id, p.row);
    }
    await store.insert(GAMIFICATION_META_TABLE, BACKFILL_KEY, {
      id: BACKFILL_KEY,
      at: now().toISOString(),
    });
  }

  return {
    init: () => serial(convertPastAttempts),
    phraseChecked: (input) => serial(() => awardPhrase(input)),
    exerciseCompleted: (input) => serial(() => recordCompletion(input)),

    snapshot: () =>
      serial(async () => {
        const s = await load();
        const today = dayKey(now());
        const claimed = new Set(s.awards.map((a) => a.id));
        const challenges = challengeStates(today, s.completions, cfg).map((c) => ({
          ...c,
          claimed: claimed.has(`challenge:${today}:${c.id}`),
        }));
        const achieved = new Map(s.mastery.map((m) => [m.level, m.achievedAt]));
        return {
          totalXp: s.totalXp,
          rank: s.rank,
          mastery: ladder.map((level) => ({
            ...levelMastery(s.completions, level, cfg),
            // Mastery is kept for good: a recorded level stays mastered whatever the numbers say now.
            mastered: achieved.has(level) || levelMastery(s.completions, level, cfg).mastered,
            achievedAt: achieved.get(level) ?? null,
          })),
          today,
          challenges,
          allChallengesDone: challenges.every((c) => c.completed),
          streak: {
            days: activeStreak(s.activeDays, today),
            practicedToday: s.activeDays.has(today),
          },
          activeDays: s.activeDays,
        };
      }),

    markChallengesStarted: () =>
      serial(async () => {
        const id = `started:${dayKey(now())}`;
        if (await store.getById(GAMIFICATION_META_TABLE, id)) return false;
        await store.insert(GAMIFICATION_META_TABLE, id, { id, at: now().toISOString() });
        return true;
      }),
  };
}
