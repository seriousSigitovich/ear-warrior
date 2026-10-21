import { describeError } from '../../../src/services/auth/messages';

describe('actionable error copy (Constitution III)', () => {
  test('every error says what happened and what to do next', () => {
    const codes = [
      'invalid_email',
      'invalid_payload',
      'rate_limited',
      'mail_failed',
      'wrong_code',
      'code_expired',
      'too_many_attempts',
      'no_code',
      'network',
      'auth_disabled',
      'server_error',
      'store_failed',
      'invalid_session',
    ] as const;
    for (const code of codes) {
      const { title, hint } = describeError({ code });
      expect(title.length).toBeGreaterThan(5);
      expect(hint.length).toBeGreaterThan(5);
    }
  });

  test('wrong_code counts the attempts left, singular and plural', () => {
    expect(describeError({ code: 'wrong_code', attemptsLeft: 3 }).hint).toContain(
      '3 attempts left',
    );
    expect(describeError({ code: 'wrong_code', attemptsLeft: 1 }).hint).toContain('1 attempt left');
  });

  test('rate_limited says when to try again, rounded up to whole minutes', () => {
    expect(describeError({ code: 'rate_limited', retryAfterS: 40 }).hint).toBe(
      'Try again in 1 minute.',
    );
    expect(describeError({ code: 'rate_limited', retryAfterS: 61 }).hint).toBe(
      'Try again in 2 minutes.',
    );
    expect(describeError({ code: 'rate_limited', retryAfterS: 1500 }).hint).toBe(
      'Try again in 25 minutes.',
    );
  });

  test('offline copy reassures that practice keeps working', () => {
    expect(describeError({ code: 'network' }).hint).toMatch(/keep practising/i);
    expect(describeError({ code: 'auth_disabled' }).title).toBe(
      describeError({ code: 'network' }).title,
    );
  });

  test('expired, exhausted and missing codes all point at "Send a new code"', () => {
    for (const code of ['code_expired', 'too_many_attempts', 'no_code'] as const) {
      expect(describeError({ code }).hint).toContain('Send a new code');
    }
  });
});
