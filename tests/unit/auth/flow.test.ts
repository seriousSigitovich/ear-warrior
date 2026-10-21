import { AuthError } from '../../../src/services/auth/client';
import {
  FlowState,
  initialFlow,
  isSixDigits,
  reduce,
  resendSecondsLeft,
} from '../../../src/services/auth/flow';

const NOW = 1_000_000;
const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (error: AuthError) => ({ ok: false as const, error });
const timings = ok({ resendAfterS: 60, expiresInS: 600 });

/** Walk the happy path up to the code step. */
function atCodeStep(): FlowState {
  let s = reduce(initialFlow('a@x.co'), { type: 'submit_email', email: ' A@x.co ' }, NOW);
  s = reduce(s, { type: 'request_done', result: timings }, NOW);
  return s;
}

describe('sign-in flow state machine', () => {
  test('starts on the email step, prefilled with the last email', () => {
    expect(initialFlow('a@x.co')).toEqual({ step: 'email', email: 'a@x.co' });
    expect(initialFlow()).toEqual({ step: 'email', email: '' });
  });

  test('an invalid email stays put with an error and sends nothing', () => {
    const s = reduce(initialFlow(), { type: 'submit_email', email: 'nope' }, NOW);
    expect(s).toEqual({ step: 'email', email: 'nope', error: { code: 'invalid_email' } });
  });

  test('a valid email moves to requesting, normalised', () => {
    const s = reduce(initialFlow(), { type: 'submit_email', email: ' A@x.co ' }, NOW);
    expect(s).toEqual({ step: 'requesting', email: 'a@x.co' });
  });

  test('a successful request opens the code step with the resend and expiry times', () => {
    const s = atCodeStep();
    expect(s).toMatchObject({
      step: 'code',
      email: 'a@x.co',
      resendAt: NOW + 60_000,
      expiresAt: NOW + 600_000,
      needsNewCode: false,
    });
  });

  test('a failed first request goes back to the email step with the error', () => {
    let s = reduce(initialFlow(), { type: 'submit_email', email: 'a@x.co' }, NOW);
    s = reduce(s, { type: 'request_done', result: fail({ code: 'mail_failed' }) }, NOW);
    expect(s).toEqual({ step: 'email', email: 'a@x.co', error: { code: 'mail_failed' } });
  });

  test('the resend countdown runs from the server time and clamps at zero', () => {
    const s = atCodeStep();
    expect(resendSecondsLeft(s, NOW)).toBe(60);
    expect(resendSecondsLeft(s, NOW + 59_001)).toBe(1);
    expect(resendSecondsLeft(s, NOW + 60_000)).toBe(0);
    expect(resendSecondsLeft(s, NOW + 999_999)).toBe(0);
    expect(resendSecondsLeft(initialFlow(), NOW)).toBe(0);
  });

  test('resend is ignored while the countdown runs, and works after it', () => {
    const s = atCodeStep();
    expect(reduce(s, { type: 'resend' }, NOW + 10_000)).toBe(s);
    const again = reduce(s, { type: 'resend' }, NOW + 60_000);
    expect(again).toMatchObject({ step: 'requesting', email: 'a@x.co' });
  });

  test('a failed resend returns to the code step (the old code may still be valid) with the error', () => {
    const s = atCodeStep();
    let r = reduce(s, { type: 'resend' }, NOW + 60_000);
    r = reduce(
      r,
      { type: 'request_done', result: fail({ code: 'rate_limited', retryAfterS: 300 }) },
      NOW + 61_000,
    );
    expect(r).toMatchObject({
      step: 'code',
      error: { code: 'rate_limited', retryAfterS: 300 },
      resendAt: NOW + 61_000 + 300_000,
    });
  });

  test('a code that is not six digits is not submitted', () => {
    const s = atCodeStep();
    expect(reduce(s, { type: 'submit_code', code: '12345' }, NOW)).toBe(s);
    expect(isSixDigits('123456')).toBe(true);
    expect(isSixDigits('12345a')).toBe(false);
    expect(isSixDigits('1234567')).toBe(false);
  });

  test('a correct code finishes', () => {
    let s = reduce(atCodeStep(), { type: 'submit_code', code: '123456' }, NOW);
    expect(s).toMatchObject({ step: 'verifying', email: 'a@x.co' });
    s = reduce(
      s,
      { type: 'verify_done', result: ok({ token: 't', email: 'a@x.co', created: true }) },
      NOW,
    );
    expect(s).toEqual({ step: 'done', email: 'a@x.co' });
  });

  test('a wrong code stays on the code step and shows the attempts left', () => {
    let s = reduce(atCodeStep(), { type: 'submit_code', code: '000000' }, NOW);
    s = reduce(
      s,
      { type: 'verify_done', result: fail({ code: 'wrong_code', attemptsLeft: 3 }) },
      NOW,
    );
    expect(s).toMatchObject({
      step: 'code',
      needsNewCode: false,
      attemptsLeft: 3,
      error: { code: 'wrong_code', attemptsLeft: 3 },
    });
  });

  test('expired, exhausted and missing codes demand a new code and block further code entry', () => {
    for (const code of ['code_expired', 'too_many_attempts', 'no_code'] as const) {
      let s = reduce(atCodeStep(), { type: 'submit_code', code: '000000' }, NOW);
      s = reduce(s, { type: 'verify_done', result: fail({ code }) }, NOW + 10_000);
      expect(s).toMatchObject({ step: 'code', needsNewCode: true, error: { code } });
      // submitting more codes is pointless; the screen offers "Send a new code" instead
      expect(reduce(s, { type: 'submit_code', code: '123456' }, NOW + 10_000)).toBe(s);
    }
  });

  test('a network drop while verifying keeps the code step so entry can resume (edge case)', () => {
    let s = reduce(atCodeStep(), { type: 'submit_code', code: '123456' }, NOW);
    s = reduce(s, { type: 'verify_done', result: fail({ code: 'network' }) }, NOW);
    expect(s).toMatchObject({ step: 'code', needsNewCode: false, error: { code: 'network' } });
    expect(reduce(s, { type: 'submit_code', code: '123456' }, NOW)).toMatchObject({
      step: 'verifying',
    });
  });

  test('change_email goes back keeping the typed address; skip dismisses from anywhere', () => {
    expect(reduce(atCodeStep(), { type: 'change_email' }, NOW)).toEqual({
      step: 'email',
      email: 'a@x.co',
    });
    for (const s of [initialFlow(), atCodeStep()])
      expect(reduce(s, { type: 'skip' }, NOW)).toEqual({ step: 'dismissed' });
  });

  test('events that do not apply to the current step are ignored', () => {
    const s = initialFlow('a@x.co');
    expect(reduce(s, { type: 'request_done', result: timings }, NOW)).toBe(s);
    expect(
      reduce(
        s,
        { type: 'verify_done', result: ok({ token: 't', email: 'a@x.co', created: false }) },
        NOW,
      ),
    ).toBe(s);
    expect(reduce(s, { type: 'submit_code', code: '123456' }, NOW)).toBe(s);
  });
});
