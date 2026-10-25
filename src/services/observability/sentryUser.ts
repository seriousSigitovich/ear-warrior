// Who a crash report is attributed to. Kept apart from sentry.ts (which imports the native SDK) so it runs under jest.
import type { AuthState } from '../auth/service';

export interface SentryUser {
  id?: string;
  email?: string;
}

/** Signed in → email (plus the device id when known); anonymous → the device id; neither yet → null (clears the user). */
export function sentryUserFor(state: AuthState, deviceId: string | null): SentryUser | null {
  if (state.status === 'signedIn') return { id: deviceId ?? undefined, email: state.email };
  return deviceId ? { id: deviceId } : null;
}
