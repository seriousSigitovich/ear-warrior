// HTTP transport for the optional email sign-in (spec 005; contract: contracts/auth-api.md).
// Never throws: every failure — server answer, unreadable answer, no network — is a typed `AuthError`,
// so the screens only branch on `code`.

export type AuthErrorCode =
  | 'invalid_email'
  | 'invalid_payload'
  | 'rate_limited'
  | 'mail_failed'
  | 'wrong_code'
  | 'code_expired'
  | 'too_many_attempts'
  | 'no_code'
  | 'invalid_session'
  | 'auth_disabled'
  | 'store_failed'
  | 'server_error'
  | 'network';

export interface AuthError {
  code: AuthErrorCode;
  attemptsLeft?: number;
  retryAfterS?: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AuthError };

export interface AuthClient {
  requestCode(email: string): Promise<Result<{ resendAfterS: number; expiresInS: number }>>;
  verify(
    email: string,
    code: string,
    deviceId: string,
  ): Promise<Result<{ token: string; email: string; created: boolean }>>;
  me(token: string): Promise<Result<{ email: string }>>;
  signOut(token: string): Promise<Result<void>>;
  deleteAccount(token: string): Promise<Result<void>>;
}

const KNOWN_CODES: ReadonlySet<string> = new Set<AuthErrorCode>([
  'invalid_email',
  'invalid_payload',
  'rate_limited',
  'mail_failed',
  'wrong_code',
  'code_expired',
  'too_many_attempts',
  'no_code',
  'invalid_session',
  'auth_disabled',
  'store_failed',
]);

type Body = Record<string, unknown>;

/**
 * Real HTTP client. Returns null when no API base URL is configured, so a build without
 * `EXPO_PUBLIC_API_URL` simply has no sign-in and stays anonymous (like the sync client).
 */
export function createAuthClient(
  baseUrl?: string,
  fetchImpl: typeof fetch = fetch,
): AuthClient | null {
  if (!baseUrl) return null;
  const root = baseUrl.replace(/\/$/, '');

  async function call<T>(
    method: string,
    path: string,
    map: (b: Body) => T,
    opts: { body?: Body; token?: string } = {},
  ): Promise<Result<T>> {
    // Content-Type only with a body: the server rejects an empty body declared as JSON with a 400,
    // which would make sign-out and account deletion fail on a real device.
    const headers: Record<string, string> = opts.body ? { 'Content-Type': 'application/json' } : {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    let body: Body;
    try {
      const res = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      try {
        body = (await res.json()) as Body;
      } catch {
        return { ok: false, error: { code: 'server_error' } };
      }
    } catch {
      return { ok: false, error: { code: 'network' } };
    }
    if (body.ok === true) return { ok: true, value: map(body) };
    const code =
      typeof body.error === 'string' && KNOWN_CODES.has(body.error)
        ? (body.error as AuthErrorCode)
        : 'server_error';
    const error: AuthError = { code };
    if (typeof body.attempts_left === 'number') error.attemptsLeft = body.attempts_left;
    if (typeof body.retry_after_s === 'number') error.retryAfterS = body.retry_after_s;
    return { ok: false, error };
  }

  return {
    requestCode: (email) =>
      call(
        'POST',
        '/api/auth/request',
        (b) => ({ resendAfterS: Number(b.resend_after_s), expiresInS: Number(b.expires_in_s) }),
        { body: { email } },
      ),
    verify: (email, code, deviceId) =>
      call(
        'POST',
        '/api/auth/verify',
        (b) => ({ token: String(b.token), email: String(b.email), created: b.created === true }),
        {
          body: { email, code, device_id: deviceId },
        },
      ),
    me: (token) => call('GET', '/api/auth/me', (b) => ({ email: String(b.email) }), { token }),
    signOut: (token) => call('POST', '/api/auth/signout', () => undefined, { token }),
    deleteAccount: (token) => call('DELETE', '/api/auth/account', () => undefined, { token }),
  };
}
