// Device-side sign-in lifecycle (contracts/client-auth.md "Lifecycle rules"), free of React/native so it
// is unit-testable with fakes. The practice loop, sync and the attempt outbox never read this (R15);
// Sentry and product analytics subscribe through `onAuthChange` (R7).
import { KeyValueStore } from '../../lib/deviceId';
import { normalizeEmail } from '../../lib/email';
import type { AuthClient, Result } from './client';
import type { SessionStore } from './session';

export type AuthState = { status: 'anonymous' } | { status: 'signedIn'; email: string };

export const LAST_EMAIL_KEY = 'ew.lastEmail';
export const OFFER_SEEN_KEY = 'ew.signInOfferSeen';
const STALE_AFTER_MS = 60 * 60 * 1000;

interface Deps {
  /** null when the build has no API url: sign-in is then unavailable and the app is anonymous. */
  client: AuthClient | null;
  session: SessionStore;
  kv: KeyValueStore;
  getDeviceId: () => Promise<string>;
  now: () => number;
}

const unavailable = { ok: false, error: { code: 'auth_disabled' } } as const;

export function createAuthService({ client, session, kv, getDeviceId, now }: Deps) {
  let state: AuthState = { status: 'anonymous' };
  let lastCheckedAt = 0;
  const listeners = new Set<(s: AuthState) => void>();

  const setState = (next: AuthState) => {
    const same =
      next.status === state.status &&
      (next.status === 'anonymous' || (state.status === 'signedIn' && state.email === next.email));
    if (same) return;
    state = next;
    listeners.forEach((l) => l(state));
  };

  /** Back to the first-time anonymous state: no token, no remembered email (FR-012). */
  async function clearLocal(): Promise<void> {
    await session.clear();
    await kv.setItem(LAST_EMAIL_KEY, '');
    setState({ status: 'anonymous' });
  }

  async function revalidate(token: string): Promise<void> {
    if (!client) return;
    const res = await client.me(token);
    if (res.ok) {
      lastCheckedAt = now();
      setState({ status: 'signedIn', email: res.value.email });
    } else if (res.error.code === 'invalid_session') {
      lastCheckedAt = now();
      await clearLocal(); // deleted or revoked elsewhere
    } // offline or server trouble: stay signed in, never block
  }

  return {
    available: client !== null,
    getState: (): AuthState => state,

    onAuthChange(listener: (s: AuthState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Restore the stored session at app start, then confirm it with the server when reachable. */
    async init(): Promise<AuthState> {
      if (!client) return state;
      const stored = await session.get();
      if (!stored) return state;
      setState({ status: 'signedIn', email: stored.email });
      await revalidate(stored.token);
      return state;
    },

    /** Called when the app returns to the foreground. */
    async revalidateIfStale(): Promise<void> {
      if (state.status !== 'signedIn' || now() - lastCheckedAt < STALE_AFTER_MS) return;
      const stored = await session.get();
      if (stored) await revalidate(stored.token);
    },

    requestCode(email: string) {
      return client ? client.requestCode(normalizeEmail(email)) : Promise.resolve(unavailable);
    },

    async verify(
      email: string,
      code: string,
    ): Promise<Result<{ token: string; email: string; created: boolean }>> {
      if (!client) return unavailable;
      const res = await client.verify(normalizeEmail(email), code, await getDeviceId());
      if (res.ok) {
        await session.set({ token: res.value.token, email: res.value.email });
        await kv.setItem(LAST_EMAIL_KEY, res.value.email);
        lastCheckedAt = now();
        setState({ status: 'signedIn', email: res.value.email });
      }
      return res;
    },

    async signOut(): Promise<void> {
      const stored = await session.get();
      if (stored && client) await client.signOut(stored.token); // best effort: local state is cleared regardless
      await clearLocal();
    },

    /** On any failure but a dead session nothing was deleted, so the session is kept and the error shown. */
    async deleteAccount(): Promise<Result<void>> {
      const stored = await session.get();
      if (stored && client) {
        const res = await client.deleteAccount(stored.token);
        if (!res.ok && res.error.code !== 'invalid_session') return res;
      }
      await clearLocal();
      return { ok: true, value: undefined };
    },

    async shouldOfferSignIn(): Promise<boolean> {
      if (!client || state.status !== 'anonymous') return false;
      return (await kv.getItem(OFFER_SEEN_KEY)) !== '1';
    },

    markOfferSeen: () => kv.setItem(OFFER_SEEN_KEY, '1'),

    async lastEmail(): Promise<string> {
      return (await kv.getItem(LAST_EMAIL_KEY)) ?? '';
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
