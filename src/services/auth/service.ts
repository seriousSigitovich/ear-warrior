// Device-side sign-in lifecycle (contracts/client-auth.md "Lifecycle rules"), free of React/native so it
// is unit-testable with fakes. Practice itself never depends on this: the progress client only asks it for a token when there is one;
// Sentry and product analytics subscribe through `onAuthChange` (R7).
import { KeyValueStore } from '../../lib/deviceId';
import { normalizeEmail } from '../../lib/email';
import type { AuthClient, Result } from './client';
import { CodeStep, parsePending, serializePending, toPending } from './flow';
import type { SessionStore } from './session';

export type AuthState = { status: 'anonymous' } | { status: 'signedIn'; email: string };

export const LAST_EMAIL_KEY = 'ew.lastEmail';
export const OFFER_SEEN_KEY = 'ew.signInOfferSeen';
export const PENDING_CODE_KEY = 'ew.pendingCode';
export const GOOGLE_PENDING_KEY = 'ew.googlePending';
/** How long the verifier waits for the learner to come back from the browser (spec 022 R5). */
const GOOGLE_PENDING_TTL_MS = 10 * 60 * 1000;
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
    await kv.setItem(PENDING_CODE_KEY, '');
    await kv.setItem(GOOGLE_PENDING_KEY, '');
    setState({ status: 'anonymous' });
  }

  /** A server-issued session becomes the signed-in state — the same effects whichever method produced it. */
  async function adoptSession(token: string, email: string): Promise<void> {
    await session.set({ token, email });
    await kv.setItem(LAST_EMAIL_KEY, email);
    await kv.setItem(PENDING_CODE_KEY, '');
    await kv.setItem(GOOGLE_PENDING_KEY, '');
    lastCheckedAt = now();
    setState({ status: 'signedIn', email });
  }

  /** The verifier kept while the learner is in the browser, or null when none is live. */
  async function pendingVerifier(): Promise<string | null> {
    const raw = await kv.getItem(GOOGLE_PENDING_KEY);
    if (!raw) return null;
    try {
      const p = JSON.parse(raw) as { verifier?: unknown; startedAt?: unknown };
      const fresh = typeof p.startedAt === 'number' && now() - p.startedAt <= GOOGLE_PENDING_TTL_MS;
      return fresh && typeof p.verifier === 'string' ? p.verifier : null;
    } catch {
      return null;
    }
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

    /** The stored session's bearer token, or null when anonymous. Reads the secure store, never the network. */
    async getToken(): Promise<string | null> {
      return (await session.get())?.token ?? null;
    },

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

    /** The code step left unfinished (screen closed after "Send code"), or null when none is live. */
    async pendingCode(): Promise<CodeStep | null> {
      return parsePending(await kv.getItem(PENDING_CODE_KEY), now());
    },

    savePendingCode: (step: CodeStep) =>
      kv.setItem(PENDING_CODE_KEY, serializePending(toPending(step))),

    clearPendingCode: () => kv.setItem(PENDING_CODE_KEY, ''),

    async verify(
      email: string,
      code: string,
    ): Promise<Result<{ token: string; email: string; created: boolean }>> {
      if (!client) return unavailable;
      const res = await client.verify(normalizeEmail(email), code, await getDeviceId());
      if (res.ok) await adoptSession(res.value.token, res.value.email);
      return res;
    },

    /** Spec 022: is the Google button worth showing? Any doubt hides it (FR-014). */
    async googleAvailable(): Promise<boolean> {
      if (!client) return false;
      const res = await client.providers();
      return res.ok && res.value.google;
    },

    /**
     * Spec 022: ask the server for the Google link, keep the verifier for the return trip, open the browser.
     * `openUrl` is injected (React Native `Linking.openURL`), so this stays testable.
     */
    async startGoogle(openUrl: (url: string) => Promise<unknown>): Promise<Result<void>> {
      if (!client) return unavailable;
      const res = await client.googleStart();
      if (!res.ok) return res;
      await kv.setItem(
        GOOGLE_PENDING_KEY,
        JSON.stringify({ verifier: res.value.verifier, startedAt: now() }),
      );
      try {
        await openUrl(res.value.url);
      } catch {
        await kv.setItem(GOOGLE_PENDING_KEY, '');
        return { ok: false, error: { code: 'browser_unavailable' } };
      }
      return { ok: true, value: undefined };
    },

    /** Spec 022: the return link brought a ticket; present it with the verifier kept at the start. */
    async finishGoogle(ticket: string): Promise<Result<{ email: string; created: boolean }>> {
      if (!client) return unavailable;
      const verifier = await pendingVerifier();
      if (!verifier) {
        await kv.setItem(GOOGLE_PENDING_KEY, '');
        return { ok: false, error: { code: 'expired' } };
      }
      const res = await client.googleExchange(ticket, verifier, await getDeviceId());
      if (!res.ok) {
        await kv.setItem(GOOGLE_PENDING_KEY, '');
        return res;
      }
      await adoptSession(res.value.token, res.value.email);
      return { ok: true, value: { email: res.value.email, created: res.value.created } };
    },

    /** Spec 022: the learner backed out at Google (or the link said so): forget the verifier. */
    cancelGoogle: () => kv.setItem(GOOGLE_PENDING_KEY, ''),

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
