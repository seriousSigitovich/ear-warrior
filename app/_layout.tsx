// Root navigation shell (T015). expo-router Stack inside the safe-area provider.
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0B1021' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#0B1021' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Ear Warrior' }} />
        <Stack.Screen name="practice" options={{ title: 'Practice' }} />
        <Stack.Screen name="settings" options={{ title: 'Difficulty' }} />
        <Stack.Screen name="progress" options={{ title: 'Progress' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
