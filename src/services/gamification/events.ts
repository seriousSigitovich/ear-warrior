// Analytics events of the reward system (spec 013), derived from what the service returns: an event
// exists only because an award, unlock or rank-up row was just created, so each fires once however
// often the same thing is reported. Props are small scalars — no personal data, no note data.
import { AppEventName } from '../logging/eventLog';
import { tuneIdOf } from '../melody/curated';
import { CompletionResult, PhraseAward } from './service';

export interface GameEvent {
  name: AppEventName;
  props: Record<string, number | string | boolean>;
}

/** Events for a phrase that paid XP. */
export function phraseEvents(a: PhraseAward): GameEvent[] {
  const events: GameEvent[] = [
    {
      name: 'xp_earned',
      props: { xp_amount: a.xp, source: 'phrase', difficulty_level: a.level, accuracy: a.accuracy },
    },
  ];
  if (a.rankUp) events.push({ name: 'rank_up', props: { rank_name: a.rankUp } });
  if (a.streak.extended)
    events.push({ name: 'streak_extended', props: { streak_length: a.streak.days } });
  return events;
}

/** Events for a melody completed at or above the pass mark. */
export function completionEvents(r: CompletionResult): GameEvent[] {
  const c = r.completion;
  const events: GameEvent[] = [
    {
      name: 'exercise_completed',
      props: {
        exercise_id: tuneIdOf(c.melodyId),
        difficulty_level: c.level,
        accuracy: c.accuracy,
        hints_used: c.hintsUsed,
      },
    },
  ];
  for (const ch of r.challengesCompleted) {
    events.push({
      name: 'daily_challenge_completed',
      props: { challenge_id: ch.id, xp_amount: ch.rewardXp },
    });
    events.push({
      name: 'xp_earned',
      props: { xp_amount: ch.rewardXp, source: 'challenge', challenge_id: ch.id },
    });
  }
  if (r.allChallengesBonus > 0) {
    events.push({
      name: 'all_daily_challenges_completed',
      props: { xp_amount: r.allChallengesBonus },
    });
    events.push({
      name: 'xp_earned',
      props: { xp_amount: r.allChallengesBonus, source: 'daily_bonus' },
    });
  }
  for (const level of r.masteryUnlocked) {
    events.push({ name: 'mastery_unlocked', props: { difficulty_level: level } });
  }
  if (r.rankUp) events.push({ name: 'rank_up', props: { rank_name: r.rankUp } });
  if (r.streak.extended)
    events.push({ name: 'streak_extended', props: { streak_length: r.streak.days } });
  return events;
}

/** One event per challenge when the day's challenges are first shown. */
export function challengeStartedEvents(challenges: readonly { id: string }[]): GameEvent[] {
  return challenges.map((c) => ({
    name: 'daily_challenge_started',
    props: { challenge_id: c.id },
  }));
}
