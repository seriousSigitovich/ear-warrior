import {
  challengeStartedEvents,
  completionEvent,
  phraseEvents,
} from '../../../src/services/rewards/events';
import { parseResult } from '../../../src/services/rewards/client';
import type { PhraseResult } from '../../../src/services/rewards/types';
import { checkBody } from './fixtures';

const result = (
  state: Record<string, unknown> = {},
  over: Record<string, unknown> = {},
): PhraseResult => {
  const body = checkBody(over);
  Object.assign(body.state, state);
  return parseResult(body, '2026-11-16')!;
};
const names = (r: PhraseResult) => phraseEvents(r, 'L2').map((e) => e.name);

describe('phraseEvents', () => {
  it('reports the XP a phrase paid, with its level and accuracy', () => {
    expect(phraseEvents(result(), 'L2')[0]).toEqual({
      name: 'xp_earned',
      props: { xp_amount: 20, source: 'phrase', difficulty_level: 'L2', accuracy: 100 },
    });
  });
  it('reports a phrase that paid nothing as nothing (no xp event)', () => {
    const r = result(
      {},
      {
        payout: {
          paid: false,
          xp: 0,
          base: 0,
          level_mult: 1,
          attempt_no: 3,
          attempt_factor: 0,
          hint_factor: 1,
          cap_factor: 1,
          reason: 'attempts',
        },
      },
    );
    expect(names(r)).not.toContain('xp_earned');
  });
  it('reports challenges, the all-done bonus, a rank-up and a streak that grew', () => {
    const r = result({
      rank_up: { id: 'apprentice', name: 'Apprentice' },
      challenges_paid: [{ id: 'melodies-3', reward_xp: 15 }],
      all_bonus_xp: 25,
    });
    expect(names(r)).toEqual([
      'xp_earned',
      'daily_challenge_completed',
      'xp_earned',
      'all_daily_challenges_completed',
      'xp_earned',
      'rank_up',
      'streak_extended',
    ]);
    expect(phraseEvents(r, 'L1').find((e) => e.name === 'rank_up')!.props).toEqual({
      rank_name: 'Apprentice',
    });
  });
  it('reports nothing for a check the server had already answered', () => {
    expect(phraseEvents(result({}, { replay: true }), 'L1')).toEqual([]);
  });
  it('does not report a streak that did not grow', () => {
    expect(names(result({ streak: { days: 3, extended: false } }))).not.toContain(
      'streak_extended',
    );
  });
});

describe('other events', () => {
  it('a finished melody', () => {
    expect(completionEvent('mary', 'L1', 95, 0)).toEqual({
      name: 'exercise_completed',
      props: { exercise_id: 'mary', difficulty_level: 'L1', accuracy: 95, hints_used: 0 },
    });
  });
  it('one event per challenge shown', () => {
    expect(
      challengeStartedEvents([{ id: 'a' }, { id: 'b' }]).map((e) => e.props.challenge_id),
    ).toEqual(['a', 'b']);
  });
});
