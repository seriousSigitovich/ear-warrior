// Root navigation shell (T015). expo-router Stack inside the safe-area provider.
// Nocturne: dark ground, headerless Home, slim accent-tinted back headers on inner screens.
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthLifecycle } from '../src/features/auth/useAuth';
import { colors } from '../src/theme/nocturne';

export default function RootLayout() {
  useAuthLifecycle();
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
      </Stack>
    </SafeAreaProvider>
  );
}
