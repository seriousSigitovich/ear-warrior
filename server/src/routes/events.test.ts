// Payload contract of POST /api/events. The insert itself is a one-line Drizzle call, so the schema is what is tested.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventBody } from './events.js';

const base = { device_id: 'dev_abc', app_version: '0.1.0', name: 'app_open', occurred_at: '2026-10-27T10:00:00.000Z' };

test('accepts a bare event and defaults props to empty', () => {
  const r = EventBody.safeParse(base);
  assert.equal(r.success, true);
  if (r.success) assert.deepEqual(r.data.props, {});
});

test('accepts scalar props', () => {
  assert.equal(EventBody.safeParse({ ...base, name: 'session_end', props: { attempt_count: 4, duration_s: 90 } }).success, true);
});

test('accepts the funnel events with their props', () => {
  assert.equal(EventBody.safeParse({ ...base, name: 'app_background', props: { screen: 'practice', phase: 'awaitingInput', active_s: 42 } }).success, true);
  assert.equal(EventBody.safeParse({ ...base, name: 'signin_error', props: { step: 'requesting', error: 'mail_failed' } }).success, true);
});

test('accepts draft mode events (spec 008)', () => {
  assert.equal(EventBody.safeParse({ ...base, name: 'draft_on', props: { rank: 3, phrase: 2, phrases: 4 } }).success, true);
  const check = { verdict: 'correct', rank: 3, n: 1, speed: 1, phrase: 2, phrases: 4, first: true, help: 'none', draft: true };
  assert.equal(EventBody.safeParse({ ...base, name: 'answer_check', props: check }).success, true);
});

test('accepts the gamification events (spec 013)', () => {
  const events: [string, Record<string, number | string | boolean>][] = [
    ['exercise_completed', { exercise_id: 'mary', difficulty_level: 'L1', accuracy: 95, hints_used: 0 }],
    ['xp_earned', { xp_amount: 15, source: 'phrase', difficulty_level: 'L1', accuracy: 92 }],
    ['rank_up', { rank_name: 'Apprentice' }],
    ['mastery_unlocked', { difficulty_level: 'L1' }],
    ['daily_challenge_started', { challenge_id: 'practice' }],
    ['daily_challenge_completed', { challenge_id: 'practice', xp_amount: 10 }],
    ['all_daily_challenges_completed', { xp_amount: 25 }],
    ['streak_extended', { streak_length: 3 }],
  ];
  for (const [name, props] of events) {
    assert.equal(EventBody.safeParse({ ...base, name, props }).success, true, name);
  }
});

test('rejects an unknown event name', () => {
  assert.equal(EventBody.safeParse({ ...base, name: 'purchase' }).success, false);
});

test('rejects a non-ISO timestamp', () => {
  assert.equal(EventBody.safeParse({ ...base, occurred_at: 'yesterday' }).success, false);
});

test('rejects nested or oversized props', () => {
  assert.equal(EventBody.safeParse({ ...base, props: { a: { b: 1 } } }).success, false);
  const many = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, i]));
  assert.equal(EventBody.safeParse({ ...base, props: many }).success, false);
});
