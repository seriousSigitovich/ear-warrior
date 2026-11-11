// Root navigation shell (T015). expo-router Stack inside the safe-area provider.
// Nocturne: dark ground, headerless Home, slim accent-tinted back headers on inner screens.
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthLifecycle } from '../src/features/auth/useAuth';
import { colors } from '../src/theme/nocturne';
import { initSentry, setSentryUser, wrapWithSentry } from '../src/services/observability/sentry';
import { getAuthService } from '../src/features/auth/authService';
import { currentPlace, setScreen, track } from '../src/features/analytics/tracker';
import { screenFromPath } from '../src/services/logging/eventLog';
import { requestSync } from '../src/services/sync/instance';
import { getOrCreateDeviceId, keyValueOverRowStore } from '../src/lib/deviceId';
import { KEY_VALUE_TABLE, defaultRowStore } from '../src/services/storage/db';

initSentry();

// Tags every report with the signed-in email, or the anonymous device id for a guest.
function useSentryUser(): void {
  useEffect(() => {
    let deviceId: string | null = null;
    const apply = () => setSentryUser(getAuthService().getState(), deviceId);
    const unsubscribe = getAuthService().onAuthChange(apply);
    getOrCreateDeviceId(keyValueOverRowStore(defaultRowStore(), KEY_VALUE_TABLE))
      .then((id) => {
        deviceId = id;
        apply();
      })
      .catch(() => apply());
    return unsubscribe;
  }, []);
}

// Funnel analytics: every screen the learner reaches, and where they were when they left the app —
// the last `app_background` of a device is where its first run stopped.
function useScreenTracking(): void {
  const pathname = usePathname();
  useEffect(() => {
    const screen = screenFromPath(pathname);
    setScreen(screen);
    track('screen_view', { screen });
  }, [pathname]);

  useEffect(() => {
    let activeSince = Date.now();
    let leftAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && leftAt === null) {
        leftAt = Date.now();
        const { screen, phase } = currentPlace();
        track('app_background', {
          screen,
          phase,
          active_s: Math.round((leftAt - activeSince) / 1000),
        });
      } else if (state === 'active' && leftAt !== null) {
        track('app_resume', { away_s: Math.round((Date.now() - leftAt) / 1000) });
        leftAt = null;
        activeSince = Date.now();
      }
    });
    return () => sub.remove();
  }, []);
}

// Sync (spec 019): at launch and when the app comes back, take what other devices earned; when it goes to the
// background, send what was earned here (a melody left half-way, phrases not yet sent).
function useSync(): void {
  useEffect(() => {
    void requestSync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void requestSync();
      else if (state === 'background') void requestSync({ force: true });
    });
    return () => sub.remove();
  }, []);
}

function RootLayout() {
  useAuthLifecycle();
  useSentryUser();
  // One launch of the app = one `app_open`; day-2 return is read off these server-side.
  useEffect(() => track('app_open'), []);
  useScreenTracking();
  useSync();
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.accent,
          headerTitle: '',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="practice" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="melodies" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="journey" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="first-melody" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default wrapWithSentry(RootLayout);
