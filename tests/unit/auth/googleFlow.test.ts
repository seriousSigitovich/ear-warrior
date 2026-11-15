import {
  GoogleState,
  initialGoogle,
  parseGoogleReturn,
  reduceGoogle,
} from '../../../src/services/auth/googleFlow';

const ok = <T>(value: T) => ({ ok: true as const, value });
const err = (code: string) => ({ ok: false as const, error: { code } }) as never;

describe('parseGoogleReturn (the earwarrior://sign-in link)', () => {
  const ticket = 'a'.repeat(43);
  test('accepts a ticket or a known error', () => {
    expect(parseGoogleReturn({ ticket })).toEqual({ kind: 'ticket', ticket });
    expect(parseGoogleReturn({ error: 'cancelled' })).toEqual({ kind: 'error', code: 'cancelled' });
    expect(parseGoogleReturn({ error: 'unverified_email' })).toEqual({
      kind: 'error',
      code: 'unverified_email',
    });
  });
  test('takes the first value of a repeated parameter', () => {
    expect(parseGoogleReturn({ ticket: [ticket, 'zzz'] })).toEqual({ kind: 'ticket', ticket });
  });
  test('ignores anything unknown, oversized, malformed or ambiguous', () => {
    expect(parseGoogleReturn({})).toBeNull();
    expect(parseGoogleReturn({ ticket: 'short' })).toBeNull();
    expect(parseGoogleReturn({ ticket: 'a'.repeat(101) })).toBeNull();
    expect(parseGoogleReturn({ ticket: 'has space' + 'a'.repeat(30) })).toBeNull();
    expect(parseGoogleReturn({ error: 'rm -rf' })).toBeNull();
    expect(parseGoogleReturn({ ticket, error: 'cancelled' })).toBeNull();
  });
});

describe('Google sign-in state machine', () => {
  const run = (...events: Parameters<typeof reduceGoogle>[1][]): GoogleState =>
    events.reduce(reduceGoogle, initialGoogle());

  test('tap → starting → waiting → exchanging → done', () => {
    expect(run({ type: 'tap' })).toEqual({ step: 'starting' });
    expect(run({ type: 'tap' }, { type: 'started', result: ok(undefined) })).toEqual({
      step: 'waiting',
    });
    expect(
      run(
        { type: 'tap' },
        { type: 'started', result: ok(undefined) },
        { type: 'returned', link: { kind: 'ticket', ticket: 't' } },
      ),
    ).toEqual({ step: 'exchanging' });
    expect(
      run(
        { type: 'tap' },
        { type: 'started', result: ok(undefined) },
        { type: 'returned', link: { kind: 'ticket', ticket: 't' } },
        { type: 'exchanged', result: ok({ email: 'a@x.co', created: true }) },
      ),
    ).toEqual({ step: 'done', email: 'a@x.co' });
  });

  test('a failed start goes back to idle with the error', () => {
    expect(run({ type: 'tap' }, { type: 'started', result: err('network') })).toEqual({
      step: 'idle',
      error: { code: 'network' },
    });
  });

  test('tapping while busy is ignored; tapping while waiting restarts (the browser may have been closed)', () => {
    const starting = run({ type: 'tap' });
    expect(reduceGoogle(starting, { type: 'tap' })).toBe(starting);
    const exchanging = run(
      { type: 'tap' },
      { type: 'started', result: ok(undefined) },
      { type: 'returned', link: { kind: 'ticket', ticket: 't' } },
    );
    expect(reduceGoogle(exchanging, { type: 'tap' })).toBe(exchanging);
    const waiting = run({ type: 'tap' }, { type: 'started', result: ok(undefined) });
    expect(reduceGoogle(waiting, { type: 'tap' })).toEqual({ step: 'starting' });
  });

  test('cancelling at Google is silent; other errors are shown', () => {
    const waiting = run({ type: 'tap' }, { type: 'started', result: ok(undefined) });
    expect(
      reduceGoogle(waiting, { type: 'returned', link: { kind: 'error', code: 'cancelled' } }),
    ).toEqual({
      step: 'idle',
    });
    expect(
      reduceGoogle(waiting, {
        type: 'returned',
        link: { kind: 'error', code: 'unverified_email' },
      }),
    ).toEqual({ step: 'idle', error: { code: 'unverified_email' } });
  });

  test('an invalid ticket reads as "took too long"; offline keeps the network error', () => {
    const exchanging = run(
      { type: 'tap' },
      { type: 'started', result: ok(undefined) },
      { type: 'returned', link: { kind: 'ticket', ticket: 't' } },
    );
    expect(reduceGoogle(exchanging, { type: 'exchanged', result: err('invalid_ticket') })).toEqual({
      step: 'idle',
      error: { code: 'expired' },
    });
    expect(reduceGoogle(exchanging, { type: 'exchanged', result: err('network') })).toEqual({
      step: 'idle',
      error: { code: 'network' },
    });
  });

  test('a link that arrives with no sign-in in progress (a late or repeated link) is still processed once from idle', () => {
    expect(
      reduceGoogle(initialGoogle(), { type: 'returned', link: { kind: 'ticket', ticket: 't' } }),
    ).toEqual({ step: 'exchanging' });
  });

  test('links are ignored while starting, exchanging or done', () => {
    const starting = run({ type: 'tap' });
    expect(
      reduceGoogle(starting, { type: 'returned', link: { kind: 'ticket', ticket: 't' } }),
    ).toBe(starting);
  });
});
