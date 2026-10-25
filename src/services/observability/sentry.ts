// Crash and error reporting (Sentry). Inert without EXPO_PUBLIC_SENTRY_DSN, so local and test builds send nothing.
import * as Sentry from '@sentry/react-native';
import type { AuthState } from '../auth/service';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let started = false;

export function initSentry(): void {
  if (started || !DSN) return;
  started = true;
  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
    // Crashes only for now: no traces, no replays, no automatic PII (IP, headers).
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

/** The signed-in email, or the anonymous device id, becomes the Sentry user (beta-checklist). */
export function setSentryUser(state: AuthState, deviceId: string | null): void {
  if (!started) return;
  if (state.status === 'signedIn') Sentry.setUser({ id: deviceId ?? undefined, email: state.email });
  else Sentry.setUser(deviceId ? { id: deviceId } : null);
}

export const wrapWithSentry = <T extends React.ComponentType<any>>(component: T): T =>
  started ? (Sentry.wrap(component) as unknown as T) : component;
