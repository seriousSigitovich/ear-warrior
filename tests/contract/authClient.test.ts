import { createAuthClient } from '../../src/services/auth/client';

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { status, json: async () => body } as Response;
  };
  return impl as unknown as typeof fetch;
}
const failingFetch = (async () => {
  throw new TypeError('Network request failed');
}) as unknown as typeof fetch;

describe('AuthClient over fetch', () => {
  test('is null when no API url is configured, so the app stays anonymous', () => {
    expect(createAuthClient(undefined)).toBeNull();
    expect(createAuthClient('')).toBeNull();
  });

  test('requestCode posts the email and maps the timings', async () => {
    const calls: Call[] = [];
    const client = createAuthClient(
      'https://api.test/',
      fakeFetch(200, { ok: true, resend_after_s: 60, expires_in_s: 600 }, calls),
    )!;
    const res = await client.requestCode('a@x.co');
    expect(res).toEqual({ ok: true, value: { resendAfterS: 60, expiresInS: 600 } });
    expect(calls[0].url).toBe('https://api.test/api/auth/request');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ email: 'a@x.co' });
  });

  test('verify sends the device id and returns the session', async () => {
    const calls: Call[] = [];
    const client = createAuthClient(
      'https://api.test',
      fakeFetch(200, { ok: true, token: 'tok', email: 'a@x.co', created: true }, calls),
    )!;
    const res = await client.verify('a@x.co', '123456', 'dev_1');
    expect(res).toEqual({ ok: true, value: { token: 'tok', email: 'a@x.co', created: true } });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      email: 'a@x.co',
      code: '123456',
      device_id: 'dev_1',
    });
  });

  test('server errors keep their code and extras', async () => {
    const wrong = createAuthClient(
      'https://api.test',
      fakeFetch(401, { ok: false, error: 'wrong_code', attempts_left: 3 }),
    )!;
    expect(await wrong.verify('a@x.co', '000000', 'd')).toEqual({
      ok: false,
      error: { code: 'wrong_code', attemptsLeft: 3 },
    });
    const limited = createAuthClient(
      'https://api.test',
      fakeFetch(429, { ok: false, error: 'rate_limited', retry_after_s: 90 }),
    )!;
    expect(await limited.requestCode('a@x.co')).toEqual({
      ok: false,
      error: { code: 'rate_limited', retryAfterS: 90 },
    });
  });

  test('an unrecognised or unparsable failure still becomes a typed error, never a throw', async () => {
    const odd = createAuthClient('https://api.test', fakeFetch(500, { message: 'boom' }))!;
    expect(await odd.requestCode('a@x.co')).toEqual({ ok: false, error: { code: 'server_error' } });
    const html = createAuthClient('https://api.test', (async () => ({
      status: 502,
      json: async () => {
        throw new SyntaxError('x');
      },
    })) as unknown as typeof fetch)!;
    expect(await html.me('tok')).toEqual({ ok: false, error: { code: 'server_error' } });
  });

  test('network failures are reported as "network"', async () => {
    const client = createAuthClient('https://api.test', failingFetch)!;
    expect(await client.requestCode('a@x.co')).toEqual({ ok: false, error: { code: 'network' } });
    expect(await client.signOut('tok')).toEqual({ ok: false, error: { code: 'network' } });
  });

  test('me, signOut and deleteAccount send the bearer token with the right verbs', async () => {
    const calls: Call[] = [];
    const ok = createAuthClient(
      'https://api.test',
      fakeFetch(200, { ok: true, email: 'a@x.co' }, calls),
    )!;
    expect(await ok.me('tok')).toEqual({ ok: true, value: { email: 'a@x.co' } });
    await ok.signOut('tok');
    await ok.deleteAccount('tok');
    expect(calls.map((c) => [c.init.method, c.url.replace('https://api.test', '')])).toEqual([
      ['GET', '/api/auth/me'],
      ['POST', '/api/auth/signout'],
      ['DELETE', '/api/auth/account'],
    ]);
    for (const c of calls)
      expect((c.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  test('requests without a body send no Content-Type: Fastify answers 400 to an empty JSON body, which broke sign-out and delete on a real device', async () => {
    const calls: Call[] = [];
    const client = createAuthClient(
      'https://api.test',
      fakeFetch(
        200,
        {
          ok: true,
          email: 'a@x.co',
          token: 't',
          created: false,
          resend_after_s: 60,
          expires_in_s: 600,
        },
        calls,
      ),
    )!;
    await client.me('tok');
    await client.signOut('tok');
    await client.deleteAccount('tok');
    await client.requestCode('a@x.co');
    await client.verify('a@x.co', '123456', 'dev_1');
    const types = calls.map((c) => (c.init.headers as Record<string, string>)['Content-Type']);
    expect(types).toEqual([
      undefined,
      undefined,
      undefined,
      'application/json',
      'application/json',
    ]);
  });

  test('a 401 invalid_session from me is surfaced as such', async () => {
    const client = createAuthClient(
      'https://api.test',
      fakeFetch(401, { ok: false, error: 'invalid_session' }),
    )!;
    expect(await client.me('tok')).toEqual({ ok: false, error: { code: 'invalid_session' } });
  });
  describe('Google sign-in (spec 022)', () => {
    test('providers maps the google flag, and any failure is a typed error', async () => {
      const calls: Call[] = [];
      const client = createAuthClient(
        'https://api.test',
        fakeFetch(200, { ok: true, email: true, google: true }, calls),
      )!;
      expect(await client.providers()).toEqual({ ok: true, value: { google: true } });
      expect(calls[0].url).toBe('https://api.test/api/auth/providers');
      expect(calls[0].init.method).toBe('GET');
      const off = createAuthClient('https://api.test', failingFetch)!;
      expect(await off.providers()).toEqual({ ok: false, error: { code: 'network' } });
    });

    test('googleStart posts nothing and returns the browser link and the verifier', async () => {
      const calls: Call[] = [];
      const client = createAuthClient(
        'https://api.test',
        fakeFetch(
          200,
          { ok: true, url: 'https://accounts.google.com/x?y=1', verifier: 'v'.repeat(43) },
          calls,
        ),
      )!;
      expect(await client.googleStart()).toEqual({
        ok: true,
        value: { url: 'https://accounts.google.com/x?y=1', verifier: 'v'.repeat(43) },
      });
      expect(calls[0].url).toBe('https://api.test/api/auth/google/start');
      expect(calls[0].init.method).toBe('POST');
      expect(calls[0].init.body).toBeUndefined();
    });

    test('googleStart maps google_disabled', async () => {
      const client = createAuthClient(
        'https://api.test',
        fakeFetch(503, { ok: false, error: 'google_disabled' }),
      )!;
      expect(await client.googleStart()).toEqual({ ok: false, error: { code: 'google_disabled' } });
    });

    test('googleExchange sends ticket, verifier and device id and maps the session', async () => {
      const calls: Call[] = [];
      const client = createAuthClient(
        'https://api.test',
        fakeFetch(200, { ok: true, token: 'tok', email: 'a@x.co', created: true }, calls),
      )!;
      expect(await client.googleExchange('T', 'V', 'dev_1')).toEqual({
        ok: true,
        value: { token: 'tok', email: 'a@x.co', created: true },
      });
      expect(calls[0].url).toBe('https://api.test/api/auth/google/exchange');
      expect(JSON.parse(String(calls[0].init.body))).toEqual({
        ticket: 'T',
        verifier: 'V',
        device_id: 'dev_1',
      });
    });

    test('googleExchange maps invalid_ticket and network failures', async () => {
      const refused = createAuthClient(
        'https://api.test',
        fakeFetch(401, { ok: false, error: 'invalid_ticket' }),
      )!;
      expect(await refused.googleExchange('T', 'V', 'dev_1')).toEqual({
        ok: false,
        error: { code: 'invalid_ticket' },
      });
      const off = createAuthClient('https://api.test', failingFetch)!;
      expect(await off.googleExchange('T', 'V', 'dev_1')).toEqual({
        ok: false,
        error: { code: 'network' },
      });
    });
  });
});
