import { AuthClient, AuthError, Result } from '../../../src/services/auth/client';
import { AuthState, createAuthService } from '../../../src/services/auth/service';
import { SessionStore, StoredSession } from '../../../src/services/auth/session';
import { KeyValueStore } from '../../../src/lib/deviceId';

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: AuthError['code']): Result<never> => ({ ok: false, error: { code } });

function memorySession(
  initial: StoredSession | null = null,
): SessionStore & { current: StoredSession | null } {
  const s = {
    current: initial,
    async get() {
      return s.current;
    },
    async set(v: StoredSession) {
      s.current = v;
    },
    async clear() {
      s.current = null;
    },
  };
  return s;
}
function memoryKv(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    async getItem(k) {
      return k in data ? data[k] : null;
    },
    async setItem(k, v) {
      data[k] = v;
    },
  };
}
function fakeClient(over: Partial<AuthClient> = {}): AuthClient & { calls: string[] } {
  const calls: string[] = [];
  const track =
    <A extends unknown[], R>(name: string, fn: (...a: A) => Promise<R>) =>
    (...a: A) => {
      calls.push(name);
      return fn(...a);
    };
  return {
    calls,
    requestCode: track('requestCode', async () => ok({ resendAfterS: 60, expiresInS: 600 })),
    verify: track('verify', async (email: string) => ok({ token: 'tok', email, created: true })),
    me: track('me', async () => ok({ email: 'a@x.co' })),
    signOut: track('signOut', async () => ok(undefined)),
    deleteAccount: track('deleteAccount', async () => ok(undefined)),
    providers: track('providers', async () => ok({ google: true })),
    googleStart: track('googleStart', async () =>
      ok({ url: 'https://accounts.google.com/x', verifier: 'v'.repeat(43) }),
    ),
    googleExchange: track('googleExchange', async () =>
      ok({ token: 'gtok', email: 'g@x.co', created: true }),
    ),
    ...over,
  } as AuthClient & { calls: string[] };
}

let now = 0;
function make(
  opts: {
    client?: AuthClient | null;
    session?: ReturnType<typeof memorySession>;
    kv?: ReturnType<typeof memoryKv>;
  } = {},
) {
  const session = opts.session ?? memorySession();
  const kv = opts.kv ?? memoryKv();
  const client = opts.client === undefined ? fakeClient() : opts.client;
  const service = createAuthService({
    client,
    session,
    kv,
    getDeviceId: async () => 'dev_1',
    now: () => now,
  });
  const seen: AuthState[] = [];
  service.onAuthChange((s) => seen.push(s));
  return { service, session, kv, client, seen };
}

beforeEach(() => {
  now = 1_000_000;
});

describe('auth service (device-side lifecycle)', () => {
  test('starts anonymous; with no API url sign-in is unavailable and nothing is ever called', async () => {
    const { service } = make({ client: null });
    expect(service.available).toBe(false);
    expect(await service.init()).toEqual({ status: 'anonymous' });
  });

  test('a stored session restores as signed in, then is checked against the server', async () => {
    const session = memorySession({ token: 'tok', email: 'a@x.co' });
    const { service, client } = make({ session });
    expect(await service.init()).toEqual({ status: 'signedIn', email: 'a@x.co' });
    expect((client as ReturnType<typeof fakeClient>).calls).toEqual(['me']);
  });

  test('offline at start: stays signed in and never blocks (R14)', async () => {
    const client = fakeClient({ me: async () => fail('network') });
    const { service, session } = make({
      client,
      session: memorySession({ token: 'tok', email: 'a@x.co' }),
    });
    expect(await service.init()).toEqual({ status: 'signedIn', email: 'a@x.co' });
    expect(session.current).not.toBeNull();
  });

  test('invalid_session at start (deleted elsewhere): token cleared, anonymous, listeners told', async () => {
    const client = fakeClient({ me: async () => fail('invalid_session') });
    const { service, session, seen } = make({
      client,
      session: memorySession({ token: 'tok', email: 'a@x.co' }),
      kv: memoryKv({ 'ew.lastEmail': 'a@x.co' }),
    });
    expect(await service.init()).toEqual({ status: 'anonymous' });
    expect(session.current).toBeNull();
    expect(seen).toContainEqual({ status: 'anonymous' });
  });

  test('verify signs in: stores token + email, remembers the address, tells listeners', async () => {
    const { service, session, kv, seen } = make();
    const res = await service.verify('A@x.co', '123456');
    expect(res.ok).toBe(true);
    expect(session.current).toEqual({ token: 'tok', email: 'a@x.co' });
    expect(kv.data['ew.lastEmail']).toBe('a@x.co');
    expect(service.getState()).toEqual({ status: 'signedIn', email: 'a@x.co' });
    expect(seen).toEqual([{ status: 'signedIn', email: 'a@x.co' }]);
  });

  test('verify passes the anonymous device id to the server (FR-011)', async () => {
    const verify = jest.fn(async (email: string) => ok({ token: 'tok', email, created: false }));
    const { service } = make({ client: fakeClient({ verify }) });
    await service.verify('a@x.co', '123456');
    expect(verify).toHaveBeenCalledWith('a@x.co', '123456', 'dev_1');
  });

  test('a failed verify changes nothing', async () => {
    const client = fakeClient({ verify: async () => fail('wrong_code') });
    const { service, session, seen } = make({ client });
    expect((await service.verify('a@x.co', '000000')).ok).toBe(false);
    expect(session.current).toBeNull();
    expect(seen).toEqual([]);
  });

  test('getToken gives the stored token while signed in and null after sign-out, without any network call', async () => {
    const session = memorySession({ token: 'tok', email: 'a@x.co' });
    const { service, client } = make({ session });
    expect(await service.getToken()).toBe('tok');
    await service.signOut();
    expect(await service.getToken()).toBeNull();
    expect((client as ReturnType<typeof fakeClient>).calls).not.toContain('me');
  });

  test('signOut always clears local state, even if the server call fails (FR-012)', async () => {
    const client = fakeClient({ signOut: async () => fail('network') });
    const { service, session, kv, seen } = make({ client });
    await service.verify('a@x.co', '123456');
    seen.length = 0;
    await service.signOut();
    expect(session.current).toBeNull();
    expect(kv.data['ew.lastEmail']).toBe('');
    expect(service.getState()).toEqual({ status: 'anonymous' });
    expect(seen).toEqual([{ status: 'anonymous' }]);
  });

  test('deleteAccount clears everything on success', async () => {
    const { service, session, kv } = make();
    await service.verify('a@x.co', '123456');
    expect((await service.deleteAccount()).ok).toBe(true);
    expect(session.current).toBeNull();
    expect(kv.data['ew.lastEmail']).toBe('');
    expect(service.getState()).toEqual({ status: 'anonymous' });
  });

  test('deleteAccount on failure keeps the session and reports the error (nothing was deleted)', async () => {
    const client = fakeClient({ deleteAccount: async () => fail('network') });
    const { service, session } = make({ client });
    await service.verify('a@x.co', '123456');
    const res = await service.deleteAccount();
    expect(res).toEqual({ ok: false, error: { code: 'network' } });
    expect(session.current).not.toBeNull();
    expect(service.getState()).toEqual({ status: 'signedIn', email: 'a@x.co' });
  });

  test('deleteAccount with an already-dead session just signs out locally', async () => {
    const client = fakeClient({ deleteAccount: async () => fail('invalid_session') });
    const { service, session } = make({ client });
    await service.verify('a@x.co', '123456');
    expect((await service.deleteAccount()).ok).toBe(true);
    expect(session.current).toBeNull();
  });

  test('revalidate re-checks only after an hour in the background', async () => {
    const { service, client } = make({ session: memorySession({ token: 'tok', email: 'a@x.co' }) });
    await service.init();
    const calls = (client as ReturnType<typeof fakeClient>).calls;
    calls.length = 0;
    now += 59 * 60_000;
    await service.revalidateIfStale();
    expect(calls).toEqual([]);
    now += 2 * 60_000;
    await service.revalidateIfStale();
    expect(calls).toEqual(['me']);
  });

  test('the first-launch offer is made once, only while anonymous and available (FR-003)', async () => {
    const a = make();
    await a.service.init();
    expect(await a.service.shouldOfferSignIn()).toBe(true);
    await a.service.markOfferSeen();
    expect(await a.service.shouldOfferSignIn()).toBe(false);

    const unavailable = make({ client: null });
    expect(await unavailable.service.shouldOfferSignIn()).toBe(false);

    const signedIn = make({ session: memorySession({ token: 't', email: 'a@x.co' }) });
    await signedIn.service.init();
    expect(await signedIn.service.shouldOfferSignIn()).toBe(false);
  });

  test('lastEmail prefills the sign-in field', async () => {
    const { service } = make({ kv: memoryKv({ 'ew.lastEmail': 'me@x.co' }) });
    expect(await service.lastEmail()).toBe('me@x.co');
    expect(await make().service.lastEmail()).toBe('');
  });

  test('unsubscribe stops notifications', async () => {
    const { service } = make();
    const seen: AuthState[] = [];
    const off = service.onAuthChange((s) => seen.push(s));
    off();
    await service.verify('a@x.co', '123456');
    expect(seen).toEqual([]);
  });

  describe('pending code step', () => {
    const step = {
      step: 'code' as const,
      email: 'a@x.co',
      resendAt: 1_000_000 + 60_000,
      expiresAt: 1_000_000 + 600_000,
      needsNewCode: false,
    };

    test('a saved code step comes back on the next visit, resend time intact', async () => {
      const { service } = make();
      await service.savePendingCode(step);
      expect(await service.pendingCode()).toEqual({ ...step, attemptsLeft: undefined });
    });

    test('nothing saved, cleared, or expired means no pending step', async () => {
      const { service } = make();
      expect(await service.pendingCode()).toBeNull();
      await service.savePendingCode(step);
      await service.clearPendingCode();
      expect(await service.pendingCode()).toBeNull();
      await service.savePendingCode(step);
      now = step.expiresAt;
      expect(await service.pendingCode()).toBeNull();
    });

    test('signing in, signing out and deleting the account all drop it', async () => {
      const { service } = make({ session: memorySession({ token: 'tok', email: 'a@x.co' }) });
      await service.savePendingCode(step);
      await service.verify('a@x.co', '123456');
      expect(await service.pendingCode()).toBeNull();
      await service.savePendingCode(step);
      await service.signOut();
      expect(await service.pendingCode()).toBeNull();
    });
  });
});

describe('Google sign-in (spec 022)', () => {
  const link = (url = 'https://accounts.google.com/x') =>
    jest.fn(async (u: string) => void u && url);

  test('googleAvailable follows the server, and any failure hides it', async () => {
    expect(await make().service.googleAvailable()).toBe(true);
    expect(
      await make({
        client: fakeClient({ providers: async () => ok({ google: false }) }),
      }).service.googleAvailable(),
    ).toBe(false);
    expect(
      await make({
        client: fakeClient({ providers: async () => fail('network') }),
      }).service.googleAvailable(),
    ).toBe(false);
    expect(await make({ client: null }).service.googleAvailable()).toBe(false);
  });

  test('startGoogle keeps the verifier before it opens the browser', async () => {
    const { service, kv } = make();
    let stored = '';
    const open = jest.fn(async () => {
      stored = kv.data['ew.googlePending'];
    });
    expect(await service.startGoogle(open)).toEqual(ok(undefined));
    expect(open).toHaveBeenCalledWith('https://accounts.google.com/x');
    expect(JSON.parse(stored)).toEqual({ verifier: 'v'.repeat(43), startedAt: 1_000_000 });
  });

  test('startGoogle: offline or a server refusal opens nothing and keeps nothing', async () => {
    const open = link();
    const a = make({ client: fakeClient({ googleStart: async () => fail('network') }) });
    expect(await a.service.startGoogle(open)).toEqual(fail('network'));
    const b = make({ client: fakeClient({ googleStart: async () => fail('google_disabled') }) });
    expect(await b.service.startGoogle(open)).toEqual(fail('google_disabled'));
    expect(open).not.toHaveBeenCalled();
    expect(a.kv.data['ew.googlePending'] ?? '').toBe('');
  });

  test('startGoogle: a browser that cannot open the link is a clear error and leaves nothing pending', async () => {
    const { service, kv } = make();
    const res = await service.startGoogle(async () => {
      throw new Error('no activity');
    });
    expect(res).toEqual(fail('browser_unavailable'));
    expect(kv.data['ew.googlePending'] ?? '').toBe('');
  });

  test('finishGoogle trades the ticket plus the stored verifier for a session, like a verified code', async () => {
    const { service, session, kv, seen, client } = make();
    await service.startGoogle(link());
    const res = await service.finishGoogle('T'.repeat(43));
    expect(res).toEqual(ok({ email: 'g@x.co', created: true }));
    expect(session.current).toEqual({ token: 'gtok', email: 'g@x.co' });
    expect(service.getState()).toEqual({ status: 'signedIn', email: 'g@x.co' });
    expect(seen).toEqual([{ status: 'signedIn', email: 'g@x.co' }]);
    expect(kv.data['ew.googlePending']).toBe('');
    expect(kv.data['ew.lastEmail']).toBe('g@x.co');
    expect((client as ReturnType<typeof fakeClient>).calls).toContain('googleExchange');
  });

  test('finishGoogle passes ticket, verifier and device id to the client', async () => {
    const googleExchange = jest.fn(async () => ok({ token: 't', email: 'g@x.co', created: false }));
    const { service } = make({ client: fakeClient({ googleExchange }) });
    await service.startGoogle(link());
    await service.finishGoogle('T'.repeat(43));
    expect(googleExchange).toHaveBeenCalledWith('T'.repeat(43), 'v'.repeat(43), 'dev_1');
  });

  test('finishGoogle with nothing pending, or a verifier older than 10 minutes, sends nothing and says "expired"', async () => {
    const a = make();
    expect(await a.service.finishGoogle('T'.repeat(43))).toEqual(fail('expired'));
    expect((a.client as ReturnType<typeof fakeClient>).calls).not.toContain('googleExchange');

    const b = make();
    await b.service.startGoogle(link());
    now += 10 * 60 * 1000 + 1;
    expect(await b.service.finishGoogle('T'.repeat(43))).toEqual(fail('expired'));
    expect(b.service.getState()).toEqual({ status: 'anonymous' });
    expect(b.kv.data['ew.googlePending']).toBe('');
  });

  test('finishGoogle failures leave the learner anonymous and clear the pending verifier', async () => {
    for (const code of ['invalid_ticket', 'network', 'server_error'] as const) {
      const { service, session, kv } = make({
        client: fakeClient({ googleExchange: async () => fail(code) }),
      });
      await service.startGoogle(link());
      expect(await service.finishGoogle('T'.repeat(43))).toEqual(fail(code));
      expect(session.current).toBeNull();
      expect(service.getState()).toEqual({ status: 'anonymous' });
      expect(kv.data['ew.googlePending']).toBe('');
    }
  });

  test('cancelGoogle drops a pending verifier', async () => {
    const { service, kv } = make();
    await service.startGoogle(link());
    await service.cancelGoogle();
    expect(kv.data['ew.googlePending']).toBe('');
  });

  test('sign-out after Google ends anonymous and the next start asks the server for a fresh link (FR-003, FR-009)', async () => {
    const googleStart = jest.fn(async () =>
      ok({ url: 'https://accounts.google.com/x', verifier: 'v'.repeat(43) }),
    );
    const { service, session } = make({ client: fakeClient({ googleStart }) });
    await service.startGoogle(link());
    await service.finishGoogle('T'.repeat(43));
    await service.signOut();
    expect(service.getState()).toEqual({ status: 'anonymous' });
    expect(session.current).toBeNull();
    await service.startGoogle(link());
    expect(googleStart).toHaveBeenCalledTimes(2);
  });

  test('without an API url Google sign-in is unavailable and nothing is called', async () => {
    const { service } = make({ client: null });
    expect(await service.startGoogle(link())).toEqual(fail('auth_disabled'));
    expect(await service.finishGoogle('T'.repeat(43))).toEqual(fail('auth_disabled'));
  });
});
