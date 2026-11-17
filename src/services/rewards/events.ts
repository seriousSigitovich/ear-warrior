// Analytics events of the reward system, derived from what the server answered to a phrase check: an event exists only
// because the server just paid something, so each fires once however often the same check is resent. Props are small
// scalars — no personal data, no note data.
import type { AppEventName } from '../logging/eventLog';
import type { PhraseResult } from './types';

export interface GameEvent {
  name: AppEventName;
  props: Record<string, number | string | boolean>;
}

/** Events for one answered phrase check. `level` is the tune's level id (`L1`…). */
export function phraseEvents(r: PhraseResult, level: string): GameEvent[] {
  if (r.replay) return [];
  const events: GameEvent[] = [];
  if (r.payout.xp > 0) {
    events.push({
      name: 'xp_earned',
      props: {
        xp_amount: r.payout.xp,
        source: 'phrase',
        difficulty_level: level,
        accuracy: r.grade.accuracy,
      },
    });
  }
  for (const c of r.challengesPaid) {
    events.push({
      name: 'daily_challenge_completed',
      props: { challenge_id: c.id, xp_amount: c.rewardXp },
    });
    events.push({
      name: 'xp_earned',
      props: { xp_amount: c.rewardXp, source: 'challenge', challenge_id: c.id },
    });
  }
  if (r.allBonusXp > 0) {
    events.push({ name: 'all_daily_challenges_completed', props: { xp_amount: r.allBonusXp } });
    events.push({ name: 'xp_earned', props: { xp_amount: r.allBonusXp, source: 'daily_bonus' } });
  }
  if (r.rankUp) events.push({ name: 'rank_up', props: { rank_name: r.rankUp.name } });
  if (r.streakExtended)
    events.push({ name: 'streak_extended', props: { streak_length: r.view.streak.days } });
  return events;
}

/** The melody was finished at or above the pass mark. */
export function completionEvent(
  tuneId: string,
  level: string,
  accuracy: number,
  hintsUsed: number,
): GameEvent {
  return {
    name: 'exercise_completed',
    props: { exercise_id: tuneId, difficulty_level: level, accuracy, hints_used: hintsUsed },
  };
}

/** One event per challenge when the day's challenges are first shown. */
export function challengeStartedEvents(challenges: readonly { id: string }[]): GameEvent[] {
  return challenges.map((c) => ({
    name: 'daily_challenge_started',
    props: { challenge_id: c.id },
  }));
}
