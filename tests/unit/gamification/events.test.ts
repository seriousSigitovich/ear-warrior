import { GAMIFICATION } from '../../../src/config/gamification';
import { rankProgress } from '../../../src/lib/gamification';
import {
  challengeStartedEvents,
  completionEvents,
  phraseEvents,
} from '../../../src/services/gamification/events';
import { CompletionResult, PhraseAward } from '../../../src/services/gamification/service';
import { allLevels } from '../../../src/services/melody/levels';

const [L1] = allLevels().map((l) => l.id);

const phraseAward = (over: Partial<PhraseAward> = {}): PhraseAward => ({
  id: 'phrase:mary-7:0',
  xp: 15,
  base: 10,
  bonus: 5,
  level: L1,
  accuracy: 92,
  totalXp: 55,
  rank: rankProgress(55, []),
  rankUp: null,
  streak: { days: 3, extended: false },
  ...over,
});

const completion = (over: Partial<CompletionResult> = {}): CompletionResult => ({
  completion: {
    id: 'att1',
    melodyId: 'mary-7',
    level: L1,
    accuracy: 95,
    hintsUsed: 0,
    completedAt: '2026-11-10T10:00:00.000Z',
    day: '2026-11-10',
  },
  masteryUnlocked: [],
  challengesCompleted: [],
  allChallengesBonus: 0,
  rankUp: null,
  totalXp: 100,
  rank: rankProgress(100, []),
  streak: { days: 3, extended: false },
  ...over,
});

describe('analytics events', () => {
  test('a paid phrase is one xp_earned', () => {
    expect(phraseEvents(phraseAward())).toEqual([
      {
        name: 'xp_earned',
        props: { xp_amount: 15, source: 'phrase', difficulty_level: L1, accuracy: 92 },
      },
    ]);
  });

  test('a rank-up and a first practice of the day add their events', () => {
    const names = phraseEvents(
      phraseAward({ rankUp: 'Apprentice', streak: { days: 4, extended: true } }),
    ).map((e) => e.name);
    expect(names).toEqual(['xp_earned', 'rank_up', 'streak_extended']);
    const events = phraseEvents(
      phraseAward({ rankUp: 'Apprentice', streak: { days: 4, extended: true } }),
    );
    expect(events[1].props).toEqual({ rank_name: 'Apprentice' });
    expect(events[2].props).toEqual({ streak_length: 4 });
  });

  test('a completed melody is one exercise_completed with the tune, level, accuracy and hints', () => {
    expect(completionEvents(completion())).toEqual([
      {
        name: 'exercise_completed',
        props: { exercise_id: 'mary', difficulty_level: L1, accuracy: 95, hints_used: 0 },
      },
    ]);
  });

  test('challenges, the all-done bonus, mastery and a rank-up each give their events once', () => {
    const events = completionEvents(
      completion({
        masteryUnlocked: [L1],
        challengesCompleted: [
          { id: 'practice', rewardXp: 10 },
          { id: 'accuracy', rewardXp: 20 },
        ],
        allChallengesBonus: 25,
        rankUp: 'Apprentice',
      }),
    );
    expect(events.map((e) => e.name)).toEqual([
      'exercise_completed',
      'daily_challenge_completed',
      'xp_earned',
      'daily_challenge_completed',
      'xp_earned',
      'all_daily_challenges_completed',
      'xp_earned',
      'mastery_unlocked',
      'rank_up',
    ]);
    expect(events[1].props).toEqual({ challenge_id: 'practice', xp_amount: 10 });
    expect(events[6].props).toEqual({ xp_amount: 25, source: 'daily_bonus' });
    expect(events[7].props).toEqual({ difficulty_level: L1 });
  });

  test('starting the day’s challenges is one event per challenge', () => {
    expect(challengeStartedEvents(GAMIFICATION.challenges.map((c) => ({ id: c.id })))).toEqual([
      { name: 'daily_challenge_started', props: { challenge_id: 'practice' } },
      { name: 'daily_challenge_started', props: { challenge_id: 'accuracy' } },
      { name: 'daily_challenge_started', props: { challenge_id: 'consistency' } },
    ]);
  });

  test('no event carries more than the allowed small scalars', () => {
    const all = [
      ...phraseEvents(phraseAward({ rankUp: 'X', streak: { days: 2, extended: true } })),
      ...completionEvents(
        completion({
          masteryUnlocked: [L1],
          challengesCompleted: [{ id: 'a', rewardXp: 1 }],
          allChallengesBonus: 1,
          rankUp: 'X',
        }),
      ),
    ];
    for (const e of all) {
      expect(Object.keys(e.props).length).toBeLessThanOrEqual(10);
      for (const [k, v] of Object.entries(e.props)) {
        expect(k.length).toBeLessThanOrEqual(40);
        expect(['number', 'boolean', 'string']).toContain(typeof v);
        if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(80);
      }
    }
  });
});
