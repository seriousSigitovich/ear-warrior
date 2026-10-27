// Root navigation shell (T015). expo-router Stack inside the safe-area provider.
// Nocturne: dark ground, headerless Home, slim accent-tinted back headers on inner screens.
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthLifecycle } from '../src/features/auth/useAuth';
import { colors } from '../src/theme/nocturne';
import { initSentry, setSentryUser, wrapWithSentry } from '../src/services/observability/sentry';
import { getAuthService } from '../src/features/auth/authService';
import { track } from '../src/features/analytics/tracker';
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

function RootLayout() {
  useAuthLifecycle();
  useSentryUser();
  // One launch of the app = one `app_open`; day-2 return is read off these server-side.
  useEffect(() => track('app_open'), []);
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
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default wrapWithSentry(RootLayout);
